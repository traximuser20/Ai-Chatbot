import { File } from '@nativescript/core';
import type { PickedFile } from '../services/media';
import type { Attachment } from '../stores/chat';

/**
 * Turning a picked file into something a message can carry.
 *
 * The choice follows one rule: a text document is inlined into the message,
 * because every model can read text; an image becomes a vision part; and
 * anything else - a PDF, an archive - travels as a base64 file part, which
 * the models that accept files can open.
 */

/** Mimes that are read as text and inlined. */
const TEXT_MIMES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'application/x-yaml',
  'application/yaml',
  'application/javascript',
  'application/x-sh',
  'application/sql',
]);

/** Extensions that are read as text even when the mime type is vague. */
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml',
  'js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'sh', 'bash', 'zsh', 'log', 'ini', 'conf', 'cfg', 'env', 'sql', 'gradle',
  'properties', 'toml', 'env',
]);

/** A document larger than this is sent as a file part rather than inlined. */
const MAX_INLINE_CHARS = 120_000;

/** The extension of a file name, lowercased and without the dot. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
}

/** True when a picked file should be read as text. */
function isTextLike(picked: PickedFile): boolean {
  if (picked.mime.startsWith('text/')) {
    return true;
  }
  if (TEXT_MIMES.has(picked.mime)) {
    return true;
  }
  return TEXT_EXTENSIONS.has(extensionOf(picked.name));
}

/** Reads a file as text, or returns undefined when it is not a small text file. */
function readTextSafely(picked: PickedFile): string | undefined {
  try {
    if (picked.size > MAX_INLINE_CHARS * 4) {
      return undefined;
    }
    const text = File.fromPath(picked.path).readTextSync();
    if (typeof text !== 'string') {
      return undefined;
    }
    // A binary file read as text is full of replacement characters - if there
    // are many, it is not really text and belongs in a file part instead.
    const sample = text.slice(0, 4000);
    const replacements = (sample.match(/\uFFFD/g) ?? []).length;
    if (sample.length > 0 && replacements / sample.length > 0.02) {
      return undefined;
    }
    return text.slice(0, MAX_INLINE_CHARS);
  } catch {
    return undefined;
  }
}

/** Builds the attachment a message carries for a picked file. */
export function buildAttachment(picked: PickedFile): Attachment {
  const base = {
    name: picked.name,
    mime: picked.mime,
    size: picked.size,
    path: picked.path,
  };

  if (picked.isImage) {
    // The image travels as a vision part - the bytes are already downscaled.
    return { ...base, kind: 'image', data: picked.base64 };
  }

  const text = isTextLike(picked) ? readTextSafely(picked) : undefined;
  if (text !== undefined) {
    return { ...base, kind: 'document', text };
  }

  // A PDF or any other binary: a file part, base64 encoded.
  return { ...base, kind: 'document', data: picked.base64 };
}

/** A short human size - "2.1 MB", "340 KB". */
export function formatSize(bytes: number): string {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
