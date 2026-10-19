/**
 * A very small Markdown parser.
 *
 * NativeScript has no HTML renderer, so model replies arrive as raw Markdown
 * ("**bold**", "- bullets", "```js ... ```") and used to be dumped verbatim
 * into a Label. This module turns a reply into a small block list that
 * `MarkdownView.vue` can render with native components.
 *
 * Supported:
 *   - paragraphs
 *   - ATX headings (# .. ######)
 *   - fenced code blocks (``` or ~~~) with an optional language tag
 *   - unordered lists (-, *, +) and ordered lists (1. / 1))
 *   - block quotes (> text)
 *   - horizontal rules (---, ***, ___)
 *   - inline `code`, **bold**, *italic*, ~~strike~~
 *
 * Everything else is treated as plain text, which is the safe default.
 */

export interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
}

export type Block =
  | { kind: 'paragraph'; tokens: InlineToken[] }
  | { kind: 'heading'; level: number; tokens: InlineToken[] }
  | { kind: 'list'; ordered: boolean; items: InlineToken[][] }
  | { kind: 'code'; code: string; lang: string }
  | { kind: 'quote'; tokens: InlineToken[] }
  | { kind: 'rule' };

const FENCE_RE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const RULE_RE = /^\s*(?:-\s*-\s*-[\s-]*|\*\s*\*\s*\*[\s*]*|_\s*_\s*_[\s_]*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d{1,3}[.)]\s+(.*)$/;

const WORD_RE = /[A-Za-z0-9]/;

/**
 * Splits a line of text into styled inline tokens.
 *
 * Emphasis markers are only recognised when they are well formed, so text
 * such as `snake_case_name` and `2 * 3` survives untouched.
 */
export function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = '';
  let index = 0;

  const flush = () => {
    if (buffer.length) {
      tokens.push({ text: buffer });
      buffer = '';
    }
  };

  const push = (inner: string, flag: 'bold' | 'italic' | 'strike' | 'code') => {
    flush();
    if (flag === 'code') {
      tokens.push({ text: inner, code: true });
      return;
    }
    // Recurse so nested emphasis ("**bold _and_ italic**") keeps working.
    const nested = parseInline(inner);
    if (!nested.length) {
      tokens.push({ text: inner, [flag]: true } as InlineToken);
      return;
    }
    nested.forEach((token) => tokens.push({ ...token, [flag]: true } as InlineToken));
  };

  while (index < input.length) {
    const char = input[index];

    // `inline code`
    if (char === '`') {
      const close = input.indexOf('`', index + 1);
      if (close > index + 1) {
        push(input.slice(index + 1, close), 'code');
        index = close + 1;
        continue;
      }
    }

    // ~~strike~~
    if (char === '~' && input[index + 1] === '~') {
      const close = input.indexOf('~~', index + 2);
      if (close > index + 1) {
        push(input.slice(index + 2, close), 'strike');
        index = close + 2;
        continue;
      }
    }

    if (char === '*' || char === '_') {
      const doubled = input[index + 1] === char;

      if (doubled) {
        const close = input.indexOf(char + char, index + 2);
        const inner = close > -1 ? input.slice(index + 2, close) : '';
        if (inner.length) {
          push(inner, 'bold');
          index = close + 2;
          continue;
        }
      } else {
        // `_` inside a word (snake_case) is not emphasis.
        const before = index > 0 ? input[index - 1] : '';
        const after = input[index + 1] ?? '';
        const wordInternal = char === '_' && WORD_RE.test(before) && WORD_RE.test(after);
        const close = wordInternal ? -1 : input.indexOf(char, index + 1);
        const inner = close > -1 ? input.slice(index + 1, close) : '';
        if (inner.length && !/\s/.test(inner[0]) && !/\s/.test(inner[inner.length - 1])) {
          push(inner, 'italic');
          index = close + 1;
          continue;
        }
      }
    }

    buffer += char;
    index += 1;
  }

  flush();
  return tokens;
}

/**
 * Parses a Markdown document into a list of renderable blocks.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  const isBlockStart = (line: string) =>
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    RULE_RE.test(line) ||
    QUOTE_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line);

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    // ---- fenced code block -------------------------------------------------
    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1][0];
      const length = fence[1].length;
      const lang = fence[2] ?? '';
      const buffer: string[] = [];
      index += 1;
      while (index < lines.length) {
        const current = lines[index];
        const closing = current.match(FENCE_RE);
        if (closing && closing[1][0] === marker && closing[1].length >= length) {
          index += 1;
          break;
        }
        buffer.push(current);
        index += 1;
      }
      blocks.push({ kind: 'code', code: buffer.join('\n'), lang });
      continue;
    }

    // ---- heading -----------------------------------------------------------
    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        tokens: parseInline(heading[2]),
      });
      index += 1;
      continue;
    }

    // ---- horizontal rule ---------------------------------------------------
    if (RULE_RE.test(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }

    // ---- block quote -------------------------------------------------------
    if (QUOTE_RE.test(line)) {
      const buffer: string[] = [];
      while (index < lines.length) {
        const quote = lines[index].match(QUOTE_RE);
        if (!quote) {
          break;
        }
        buffer.push(quote[1]);
        index += 1;
      }
      blocks.push({ kind: 'quote', tokens: parseInline(buffer.join(' ')) });
      continue;
    }

    // ---- list --------------------------------------------------------------
    const unordered = line.match(UL_RE);
    const ordered = line.match(OL_RE);
    if (unordered || ordered) {
      const isOrdered = !!ordered;
      const items: InlineToken[][] = [];
      while (index < lines.length) {
        const current = lines[index];
        const asUnordered = current.match(UL_RE);
        const asOrdered = current.match(OL_RE);
        if (isOrdered && asOrdered) {
          items.push(parseInline(asOrdered[2]));
        } else if (!isOrdered && asUnordered) {
          items.push(parseInline(asUnordered[1]));
        } else {
          break;
        }
        index += 1;
      }
      blocks.push({ kind: 'list', ordered: isOrdered, items });
      continue;
    }

    // ---- paragraph ---------------------------------------------------------
    const buffer: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      buffer.push(lines[index].trim());
      index += 1;
    }
    if (buffer.length) {
      blocks.push({ kind: 'paragraph', tokens: parseInline(buffer.join(' ')) });
    }
  }

  return blocks;
}

/** Flattens inline tokens back into plain text (used for titles and previews). */
export function inlineToPlain(tokens: InlineToken[]): string {
  return tokens.map((token) => token.text).join('');
}
