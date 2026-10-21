import { Application } from '@nativescript/core';

/**
 * Runtime permissions.
 *
 * NativeScript 9 dropped the old `Permissions` helper from core, so the
 * Android framework is asked directly: `Context.checkSelfPermission` for the
 * state and `Activity.requestPermissions` for the prompt. The answer arrives
 * on the `activityRequestPermissions` event of the application.
 *
 * Only the permissions that need a runtime grant are requested here - they
 * are the dangerous ones (microphone, camera, media, notifications). Every
 * request is resolved as a single boolean: "all of them are granted".
 *
 * All of this is Android only. On any other platform every permission is
 * reported as granted, so the features degrade to "already allowed".
 */

/** The dangerous permissions the app asks for. */
export const PERMISSION = {
  recordAudio: 'android.permission.RECORD_AUDIO',
  camera: 'android.permission.CAMERA',
  /** Android 13+ (API 33) media access. */
  mediaImages: 'android.permission.READ_MEDIA_IMAGES',
  mediaVideo: 'android.permission.READ_MEDIA_VIDEO',
  mediaAudio: 'android.permission.READ_MEDIA_AUDIO',
  /** Legacy storage access, up to Android 12 (API 32). */
  externalStorage: 'android.permission.READ_EXTERNAL_STORAGE',
  /** Android 13+ (API 33) notifications. */
  postNotifications: 'android.permission.POST_NOTIFICATIONS',
} as const;

/** The highest request code the app uses. Each request gets its own. */
let nextRequestCode = 4600;

/** Pending requests, keyed by their request code. */
const pending = new Map<number, (granted: boolean) => void>();

/** True when the app is not running on Android. */
function notAndroid(): boolean {
  return !Application.android;
}

/** The running Android level (0 when unknown). */
function sdkInt(): number {
  try {
    return android.os.Build.VERSION.SDK_INT ?? 0;
  } catch {
    return 0;
  }
}

/** The context used for every permission call. */
function context(): android.content.Context | undefined {
  try {
    return Application.android?.context;
  } catch {
    return undefined;
  }
}

/** The activity that can show the permission prompt. */
function activity(): android.app.Activity | undefined {
  try {
    return (
      Application.android?.foregroundActivity ?? Application.android?.startActivity
    );
  } catch {
    return undefined;
  }
}

/** True when a single permission is already granted. */
export function hasPermission(permission: string): boolean {
  if (notAndroid()) {
    return true;
  }
  try {
    const ctx = context();
    if (!ctx) {
      return false;
    }
    return (
      ctx.checkSelfPermission(permission) ===
      android.content.pm.PackageManager.PERMISSION_GRANTED
    );
  } catch {
    return false;
  }
}

/** True when every permission in the list is granted. */
export function hasPermissions(permissions: string[]): boolean {
  return permissions.every((permission) => hasPermission(permission));
}

/**
 * Asks for a set of permissions.
 *
 * Resolves `true` when every one of them is granted afterwards. A request
 * that cannot be shown (no activity, or the permissions are already decided)
 * resolves with the current state rather than hanging.
 */
export function requestPermissions(permissions: string[]): Promise<boolean> {
  if (notAndroid()) {
    return Promise.resolve(true);
  }

  const missing = permissions.filter((permission) => !hasPermission(permission));
  if (!missing.length) {
    return Promise.resolve(true);
  }

  const act = activity();
  if (!act) {
    // Without an activity the prompt cannot be shown - report the state.
    return Promise.resolve(hasPermissions(permissions));
  }

  const requestCode = nextRequestCode++;

  return new Promise<boolean>((resolve) => {
    pending.set(requestCode, resolve);

    try {
      act.requestPermissions(missing, requestCode);
    } catch (err) {
      console.error('Could not request permissions:', err);
      pending.delete(requestCode);
      resolve(hasPermissions(permissions));
    }

    // A safety net: if the callback never fires, do not leave the caller
    // waiting for ever - resolve with the state after a short while.
    setTimeout(() => {
      if (pending.has(requestCode)) {
        pending.delete(requestCode);
        resolve(hasPermissions(permissions));
      }
    }, 30000);
  });
}

// The answer to a permission prompt arrives here.
if (!notAndroid()) {
  Application.on('activityRequestPermissions', (args: any) => {
    const code = args?.requestCode;
    if (!pending.has(code)) {
      return;
    }
    const resolve = pending.get(code);
    pending.delete(code);

    const results: number[] = args?.grantResults ?? [];
    const granted =
      results.length > 0 &&
      results.every(
        (result) => result === android.content.pm.PackageManager.PERMISSION_GRANTED,
      );
    resolve(granted);
  });
}

/* ------------------------------------------------------------------ */
/* The permissions each feature needs                                  */
/* ------------------------------------------------------------------ */

/** Voice search and voice chat both need the microphone. */
export function ensureMicrophone(): Promise<boolean> {
  return requestPermissions([PERMISSION.recordAudio]);
}

/** Taking a photo needs the camera. */
export function ensureCamera(): Promise<boolean> {
  return requestPermissions([PERMISSION.camera]);
}

/**
 * Picking an attachment.
 *
 * The storage access picker (SAF) grants access to the chosen file on its
 * own, so a media permission is not strictly required. It is asked for
 * anyway on the versions where it is a dangerous permission, because
 * reading the file back through the content resolver is more robust when it
 * is held - and it is what the platform expects of a gallery-style flow.
 */
export function ensureAttachments(): Promise<boolean> {
  if (sdkInt() >= 33) {
    return requestPermissions([
      PERMISSION.mediaImages,
      PERMISSION.mediaVideo,
      PERMISSION.mediaAudio,
    ]);
  }
  return requestPermissions([PERMISSION.externalStorage]);
}

/** Notifications are a runtime permission from Android 13 (API 33) on. */
export function ensureNotifications(): Promise<boolean> {
  if (sdkInt() < 33) {
    // Below 33 a notification channel is enough - there is no permission.
    return Promise.resolve(true);
  }
  return requestPermissions([PERMISSION.postNotifications]);
}
