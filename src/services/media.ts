import { Application, knownFolders, path as nsPath } from '@nativescript/core';

/**
 * Attachments: picking a document or an image, and taking a photo.
 *
 * Everything here drives the Android framework directly through the
 * NativeScript runtime - there is no plugin. Two flows are used:
 *
 *  - **Picking** goes through the Storage Access Framework
 *    (`ACTION_GET_CONTENT`), whose system picker grants access to the chosen
 *    file on its own. The result is a `content://` Uri that is read back
 *    through the content resolver.
 *  - **The camera** (`ACTION_IMAGE_CAPTURE`) writes into a row the app first
 *    inserts into `MediaStore`. That gives a `content://` Uri to hand to the
 *    camera as its output, so no `FileProvider` is needed, and the photo is
 *    read back from the same Uri.
 *
 * A picked or captured file is copied into the app's temp folder so the path
 * stays valid for a thumbnail and for a later read. Images are downscaled
 * before they are base64 encoded - a phone photo is many megapixels, and the
 * payload only needs to be large enough for a vision model (1568 px on the
 * long edge is what the multimodal models are trained for).
 */

/** A file that was picked or captured, ready to be attached. */
export interface PickedFile {
  /** Absolute path of the copy in the app's temp folder. */
  path: string;
  /** Name shown in the UI. */
  name: string;
  /** Mime type of the content. */
  mime: string;
  /** Size in bytes after any compression. */
  size: number;
  /**
   * Base64 of the bytes, without the `data:` prefix. Only an image carries
   * its bytes here; a document is read back from `path`.
   */
  base64: string;
  /** True when the file is an image. */
  isImage: boolean;
}

/** Request codes for the two flows. */
const REQ_PICK = 5200;
const REQ_CAMERA = 5201;

/** The long edge an attached image is scaled down to. */
const MAX_IMAGE_EDGE = 1568;

/** The single operation that can be in flight (one picker at a time). */
let pending:
  | { kind: 'pick'; resolve: (file: PickedFile | null) => void }
  | { kind: 'camera'; resolve: (file: PickedFile | null) => void; uri: android.net.Uri }
  | undefined;

function context(): android.content.Context {
  return Application.android.context;
}

function activity(): android.app.Activity | undefined {
  try {
    return Application.android.foregroundActivity ?? Application.android.startActivity;
  } catch {
    return undefined;
  }
}

/** A unique, safe file name for the temp copy. */
function tempPath(extension: string): string {
  const unique = `attach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return nsPath.join(knownFolders.temp().path, `${unique}.${extension}`);
}

/** Extension guessed from a mime type (used for the temp copy). */
function extensionFor(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/json': 'json',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/csv': 'csv',
    'application/zip': 'zip',
  };
  if (map[mime]) {
    return map[mime];
  }
  const slash = mime.indexOf('/');
  return slash > -1 ? mime.slice(slash + 1) : 'bin';
}

/** Writes a Java byte array to a file. Returns the byte count. */
function writeBytes(target: string, bytes: any): number {
  const fos = new java.io.FileOutputStream(target);
  try {
    fos.write(bytes);
  } finally {
    fos.close();
  }
  return bytes.length;
}

/** Reads a `content://` Uri into a Java byte array. */
function readUriBytes(uri: android.net.Uri): { bytes: any; mime: string; name: string } | null {
  try {
    const cr = context().getContentResolver();
    const mime = cr.getType(uri) || 'application/octet-stream';
    const name = queryDisplayName(cr, uri) || `attachment.${extensionFor(mime)}`;

    const stream = cr.openInputStream(uri);
    if (!stream) {
      return null;
    }
    const baos = new java.io.ByteArrayOutputStream();
    const buffer = Array.create('byte', 64 * 1024);
    let read: number;
    while ((read = stream.read(buffer)) > 0) {
      baos.write(buffer, 0, read);
    }
    stream.close();
    return { bytes: baos.toByteArray(), mime, name };
  } catch (err) {
    console.error('Could not read the picked file:', err);
    return null;
  }
}

/** Asks the content resolver for the human name of a Uri. */
function queryDisplayName(cr: android.content.ContentResolver, uri: android.net.Uri): string {
  let cursor: android.database.Cursor | null = null;
  try {
    cursor = cr.query(uri, [android.provider.OpenableColumns.DISPLAY_NAME], null, null, null);
    if (cursor && cursor.moveToFirst()) {
      const index = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
      if (index >= 0) {
        return cursor.getString(index) ?? '';
      }
    }
  } catch {
    /* the name is a nicety - ignore any failure */
  } finally {
    cursor?.close();
  }
  return '';
}

/** Base64 of a Java byte array, without line breaks. */
function toBase64(bytes: any): string {
  return android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
}

/** True when a mime type is an image. */
function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

/**
 * Downscales an image file and re-encodes it as JPEG.
 *
 * Returns the compressed base64, and rewrites the temp copy so a thumbnail
 * and a later read use the smaller file. Falls back to the raw bytes when
 * the bitmap cannot be decoded.
 */
function compressImage(
  filePath: string,
  original: { bytes: any; mime: string },
): { base64: string; mime: string; size: number } {
  try {
    const bounds = new android.graphics.BitmapFactory.Options();
    bounds.inJustDecodeBounds = true;
    android.graphics.BitmapFactory.decodeFile(filePath, bounds);

    let sample = 1;
    while (
      bounds.outWidth / (sample * 2) >= MAX_IMAGE_EDGE ||
      bounds.outHeight / (sample * 2) >= MAX_IMAGE_EDGE
    ) {
      sample *= 2;
    }

    const options = new android.graphics.BitmapFactory.Options();
    options.inSampleSize = sample;
    const bitmap = android.graphics.BitmapFactory.decodeFile(filePath, options);
    if (!bitmap) {
      return { base64: toBase64(original.bytes), mime: original.mime, size: original.bytes.length };
    }

    const baos = new java.io.ByteArrayOutputStream();
    bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 88, baos);
    bitmap.recycle();

    const bytes = baos.toByteArray();
    writeBytes(filePath, bytes);
    return { base64: toBase64(bytes), mime: 'image/jpeg', size: bytes.length };
  } catch (err) {
    console.error('Could not scale the image:', err);
    return { base64: toBase64(original.bytes), mime: original.mime, size: original.bytes.length };
  }
}

/** Turns a read Uri into a `PickedFile`, copying and scaling as needed. */
function toPickedFile(read: { bytes: any; mime: string; name: string }): PickedFile | null {
  const extension = extensionFor(read.mime);
  const filePath = tempPath(extension);
  writeBytes(filePath, read.bytes);

  if (isImageMime(read.mime)) {
    const scaled = compressImage(filePath, read);
    return {
      path: filePath,
      name: read.name,
      mime: scaled.mime,
      size: scaled.size,
      base64: scaled.base64,
      isImage: true,
    };
  }

  // A document is read back from its temp copy when it is turned into text
  // or page images, so there is no reason to hold the whole file as base64
  // as well - a long PDF would double its own memory cost.
  return {
    path: filePath,
    name: read.name,
    mime: read.mime,
    size: read.bytes.length,
    base64: '',
    isImage: false,
  };
}

/* ------------------------------------------------------------------ */
/* Launching the flows                                                 */
/* ------------------------------------------------------------------ */

/** Reads the result of either flow and completes the pending operation. */
function completeFromUri(uri: android.net.Uri | null) {
  const op = pending;
  pending = undefined;
  console.log('[media] completeFromUri', String(uri), 'op=', op?.kind);
  if (!op) {
    return;
  }
  if (!uri) {
    // The picker or the camera was cancelled.
    op.resolve(null);
    return;
  }
  const read = readUriBytes(uri);
  if (!read) {
    op.resolve(null);
    return;
  }
  op.resolve(toPickedFile(read));
}

/**
 * Opens the system picker for one or more kinds of file.
 *
 * `mimes` lists the accepted mime types - pass a catch-all type for any
 * document. Resolves with the chosen file, or `null` when the picker was
 * cancelled.
 */
export function pickFile(mimes: string[] = ['*/*']): Promise<PickedFile | null> {
  const act = activity();
  console.log('[media] pickFile activity=', !!act);
  if (!act) {
    return Promise.resolve(null);
  }

  const intent = new android.content.Intent(android.content.Intent.ACTION_GET_CONTENT);
  intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);

  if (mimes.length === 1) {
    intent.setType(mimes[0]);
  } else {
    intent.setType('*/*');
    intent.putExtra(android.content.Intent.EXTRA_MIME_TYPES, mimes);
  }

  return new Promise<PickedFile | null>((resolve) => {
    pending = { kind: 'pick', resolve };
    try {
      act.startActivityForResult(intent, REQ_PICK);
    } catch (err) {
      console.error('Could not open the file picker:', err);
      pending = undefined;
      resolve(null);
    }
  });
}

/** Opens the picker for images from the gallery. */
export function pickImage(): Promise<PickedFile | null> {
  return pickFile(['image/*']);
}

/**
 * Starts the camera to take a photo.
 *
 * A row is inserted into `MediaStore` first, and its `content://` Uri is
 * handed to the camera as the output. The photo is read back from that Uri,
 * so no `FileProvider` is involved. Resolves with the photo, or `null` when
 * the camera was cancelled or is missing.
 */
export function takePhoto(): Promise<PickedFile | null> {
  const act = activity();
  if (!act) {
    return Promise.resolve(null);
  }

  const cr = context().getContentResolver();
  const values = new android.content.ContentValues();
  values.put(
    android.provider.MediaStore.MediaColumns.DISPLAY_NAME,
    `omni_${Date.now()}.jpg`,
  );
  values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, 'image/jpeg');

  let uri: android.net.Uri | null = null;
  try {
    uri = cr.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
  } catch (err) {
    console.error('Could not create a MediaStore row for the photo:', err);
    return Promise.resolve(null);
  }
  if (!uri) {
    return Promise.resolve(null);
  }

  const intent = new android.content.Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
  intent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri);
  intent.addFlags(
    android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
      android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION,
  );

  // Grant the camera app access to the output Uri explicitly - some camera
  // apps ignore the flags on the intent and refuse to write without it.
  try {
    const resolved = context()
      .getPackageManager()
      .queryIntentActivities(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
    for (let i = 0; i < resolved.size(); i++) {
      const info = resolved.get(i);
      const packageName = info.activityInfo.packageName;
      context().grantUriPermission(
        packageName,
        uri,
        android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
          android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION,
      );
    }
  } catch {
    /* the explicit grant is a best effort */
  }

  return new Promise<PickedFile | null>((resolve) => {
    pending = { kind: 'camera', resolve, uri };
    try {
      act.startActivityForResult(intent, REQ_CAMERA);
    } catch (err) {
      console.error('Could not start the camera:', err);
      pending = undefined;
      resolve(null);
    }
  });
}

// The result of the picker or the camera arrives here.
if (Application.android) {
  Application.on('activityResult', (args: any) => {
    const code = args?.requestCode;
    if (code !== REQ_PICK && code !== REQ_CAMERA) {
      return;
    }
    if (!pending) {
      return;
    }

    const result = args?.resultCode;
    const ok = result === android.app.Activity.RESULT_OK;
    console.log(
      '[media] activityResult code=',
      code,
      'resultCode=',
      result,
      'pending=',
      pending?.kind,
      'intent=',
      !!args?.intent,
      'result=',
      !!args?.result,
    );

    if (code === REQ_CAMERA) {
      const op = pending;
      if (!op || op.kind !== 'camera') {
        return;
      }
      if (!ok) {
        pending = undefined;
        // Cancelled: drop the MediaStore row that was created for it.
        try {
          context().getContentResolver().delete(op.uri, null, null);
        } catch {
          /* ignore */
        }
        op.resolve(null);
        return;
      }
      // Keep the pending operation in place: completeFromUri() consumes it
      // after it has read the camera output Uri.
      completeFromUri(op.uri);
      return;
    }

    // The picker returns the chosen file in the intent's data.
    //
    // NativeScript 9 carries the result intent as `intent`; older versions
    // used `result`. Reading only one of the two silently turns every pick
    // into a cancellation, so both are tried.
    const data = args?.intent ?? args?.result;
    let uri: android.net.Uri | null = null;
    try {
      uri = ok ? ((data?.getData?.() as android.net.Uri | null) ?? null) : null;
    } catch {
      uri = null;
    }
    completeFromUri(uri);
  });
}
