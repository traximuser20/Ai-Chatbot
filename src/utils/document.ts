import { File } from '@nativescript/core';

/**
 * Reading a document on the device.
 *
 * A gateway route can be talked into looking at an image, but only a handful
 * of routes accept a raw PDF or a Word file, and those that do are not the
 * ones a phone usually reaches. So the document is turned into something
 * every vision-capable route understands before it leaves the phone:
 *
 *  - **A PDF** is rasterised, page by page, with the `PdfRenderer` of
 *    Android. The pages travel as ordinary images and the vision route reads
 *    them like a photo of the page.
 *  - **A Word, PowerPoint or Excel file** is an OOXML archive - a zip of XML.
 *    The text is pulled out of the archive and inlined into the message,
 *    which every route can read.
 *
 * Everything here runs through the Android framework directly; no plugin is
 * involved.
 */

/** One rendered page of a document, ready to be sent as an image part. */
export interface DocumentPage {
  /** Always `image/jpeg` - the renderer writes JPEG. */
  mime: string;
  /** Base64 of the page, without the `data:` prefix. */
  data: string;
}

/** How many pages of a PDF are sent. Enough for a letter or a contract. */
export const MAX_PDF_PAGES = 4;

/** The long edge a page is rendered at. Matches what vision models expect. */
const MAX_PAGE_EDGE = 1400;

/** A page is never scaled up beyond this - a phone screen is not a printer. */
const MAX_PAGE_SCALE = 2.5;

/** Text pulled out of an office file is capped, like an inlined text file. */
const MAX_OFFICE_CHARS = 120_000;

/** True when the runtime is Android (the app only ships for Android today). */
function isAndroid(): boolean {
  return typeof globalThis.android !== 'undefined' && !!globalThis.android;
}

/** Base64 of a Java byte array, without line breaks. */
function toBase64(bytes: any): string {
  return globalThis.android.util.Base64.encodeToString(
    bytes,
    globalThis.android.util.Base64.NO_WRAP,
  );
}

/**
 * Renders the first pages of a PDF to JPEG images.
 *
 * Returns an empty list when the file cannot be opened - an encrypted PDF,
 * a corrupt download, or a file that is not a PDF at all. The caller turns
 * that into a message for the reader.
 */
export function renderPdfPages(filePath: string, maxPages = MAX_PDF_PAGES): DocumentPage[] {
  if (!isAndroid()) {
    return [];
  }

  let descriptor: any;
  let renderer: any;
  try {
    descriptor = globalThis.android.os.ParcelFileDescriptor.open(
      new java.io.File(filePath),
      globalThis.android.os.ParcelFileDescriptor.MODE_READ_ONLY,
    );
    renderer = new globalThis.android.graphics.pdf.PdfRenderer(descriptor);

    const count = Math.min(renderer.getPageCount(), Math.max(1, maxPages));
    const pages: DocumentPage[] = [];

    for (let index = 0; index < count; index++) {
      const page = renderer.openPage(index);
      try {
        // A PDF is measured in points (72 per inch). Scale it up to the edge
        // a vision model was trained on, but never so far that the bitmap
        // becomes a memory problem on a phone.
        const sourceEdge = Math.max(page.getWidth(), page.getHeight(), 1);
        const scale = Math.min(MAX_PAGE_SCALE, MAX_PAGE_EDGE / sourceEdge);
        const width = Math.max(1, Math.round(page.getWidth() * scale));
        const height = Math.max(1, Math.round(page.getHeight() * scale));

        const bitmap = globalThis.android.graphics.Bitmap.createBitmap(
          width,
          height,
          globalThis.android.graphics.Bitmap.Config.ARGB_8888,
        );
        try {
          // A PDF page is transparent where it has no ink. JPEG has no alpha,
          // so the page is painted white first - otherwise those areas turn
          // out black.
          const canvas = new globalThis.android.graphics.Canvas(bitmap);
          canvas.drawColor(globalThis.android.graphics.Color.WHITE);
          page.render(
            bitmap,
            null,
            null,
            globalThis.android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY,
          );

          const stream = new java.io.ByteArrayOutputStream();
          bitmap.compress(globalThis.android.graphics.Bitmap.CompressFormat.JPEG, 82, stream);
          pages.push({ mime: 'image/jpeg', data: toBase64(stream.toByteArray()) });
        } finally {
          bitmap.recycle();
        }
      } finally {
        page.close();
      }
    }

    return pages;
  } catch (err) {
    console.error('Could not render the PDF:', err);
    return [];
  } finally {
    try {
      renderer?.close();
    } catch {
      /* already closed */
    }
    try {
      descriptor?.close();
    } catch {
      /* already closed */
    }
  }
}

/** Reads one entry of a zip archive as UTF-8 text. */
function readZipEntry(zip: any, name: string): string | undefined {
  const entry = zip.getEntry(name);
  if (!entry) {
    return undefined;
  }
  const stream = zip.getInputStream(entry);
  // Android's Java bridge does not consistently resolve the overload that
  // accepts a Java charset name. OOXML is UTF-8, which is also Android's
  // default for InputStreamReader, so use the one-argument overload here.
  const reader = new java.io.BufferedReader(new java.io.InputStreamReader(stream));
  try {
    const lines: string[] = [];
    let line: string | null;
    while ((line = reader.readLine()) !== null) {
      lines.push(String(line));
    }
    return lines.join('\n');
  } finally {
    reader.close();
  }
}

/** All entries of a zip archive, in archive order. */
function zipEntryNames(zip: any): string[] {
  const names: string[] = [];
  const entries = zip.entries();
  while (entries.hasMoreElements()) {
    names.push(String(entries.nextElement().getName()));
  }
  return names;
}

/** Turns the five XML entities and numeric escapes back into characters. */
function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** The text of every `<tag>` element in an XML string. */
function textsOf(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    found.push(decodeXml(match[1].replace(/<[^>]+>/g, '')));
  }
  return found;
}

/** Extracts the readable text of a `.docx` archive. */
function extractDocx(zip: any): string {
  const body = readZipEntry(zip, 'word/document.xml');
  if (!body) {
    return '';
  }
  // A paragraph break in Word is a closing `</w:p>`; a tab is its own element.
  const withBreaks = body
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n');
  const text = decodeXml(withBreaks.replace(/<[^>]+>/g, ''));
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Extracts the readable text of a `.pptx` archive, slide by slide. */
function extractPptx(zip: any): string {
  const slides = zipEntryNames(zip)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const number = (name: string) => parseInt(name.match(/(\d+)\.xml$/)?.[1] ?? '0', 10);
      return number(a) - number(b);
    });

  const parts: string[] = [];
  slides.forEach((name, index) => {
    const xml = readZipEntry(zip, name);
    if (!xml) {
      return;
    }
    const lines = textsOf(xml, 'a:t').filter((line) => line.trim().length > 0);
    if (lines.length) {
      parts.push(`Slide ${index + 1}:\n${lines.join('\n')}`);
    }
  });
  return parts.join('\n\n').trim();
}

/** Extracts the cell values of a `.xlsx` archive as tab separated rows. */
function extractXlsx(zip: any): string {
  const shared: string[] = [];
  const sharedXml = readZipEntry(zip, 'xl/sharedStrings.xml');
  if (sharedXml) {
    shared.push(...textsOf(sharedXml, 't'));
  }

  const sheets = zipEntryNames(zip)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort();

  const parts: string[] = [];
  for (const name of sheets) {
    const xml = readZipEntry(zip, name);
    if (!xml) {
      continue;
    }
    // A cell carries its value in a `<v>`; a string cell points at the shared
    // string table by index (`t="s"`), and an inline string carries its text
    // in an `<is><t>`.
    const rows: string[] = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cell: RegExpExecArray | null;
    let currentRow = '';
    let currentRowNumber = 0;
    while ((cell = cellPattern.exec(xml)) !== null) {
      const attrs = cell[1] ?? '';
      const inner = cell[2] ?? '';
      const rowMatch = attrs.match(/\br="([A-Z]+)(\d+)"/);
      const rowNumber = rowMatch ? parseInt(rowMatch[2], 10) : currentRowNumber;
      const isShared = /\bt="s"/.test(attrs);
      const isInline = /\bt="(inlineStr|str)"/.test(attrs);
      let value = '';
      if (isInline) {
        value = textsOf(inner, 't').join(' ');
      } else {
        const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (raw !== undefined) {
          value = isShared ? shared[parseInt(raw, 10)] ?? '' : decodeXml(raw);
        }
      }
      if (rowNumber !== currentRowNumber) {
        if (currentRow.trim()) {
          rows.push(currentRow.trimEnd());
        }
        currentRow = '';
        currentRowNumber = rowNumber;
      }
      currentRow += `${value}\t`;
    }
    if (currentRow.trim()) {
      rows.push(currentRow.trimEnd());
    }
    if (rows.length) {
      parts.push(rows.join('\n'));
    }
  }

  return parts.join('\n\n').trim();
}

/**
 * Reads the text out of an OOXML file - `.docx`, `.pptx` or `.xlsx`.
 *
 * Returns an empty string when the file is not one of those, or when the
 * archive cannot be opened.
 */
export function extractOfficeText(filePath: string): string {
  if (!isAndroid()) {
    return '';
  }
  let zip: any;
  try {
    zip = new java.util.zip.ZipFile(filePath);
    const lower = filePath.toLowerCase();
    let text = '';
    if (lower.endsWith('.docx')) {
      text = extractDocx(zip);
    } else if (lower.endsWith('.pptx')) {
      text = extractPptx(zip);
    } else if (lower.endsWith('.xlsx')) {
      text = extractXlsx(zip);
    }
    return text.slice(0, MAX_OFFICE_CHARS);
  } catch (err) {
    console.error('Could not read the office document:', err);
    return '';
  } finally {
    try {
      zip?.close();
    } catch {
      /* already closed */
    }
  }
}
