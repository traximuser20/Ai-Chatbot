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
  | { kind: 'list'; list: ListBlock }
  | { kind: 'code'; code: string; lang: string }
  | { kind: 'quote'; tokens: InlineToken[] }
  | { kind: 'rule' };

/** One entry of a list. */
export interface ListItem {
  tokens: InlineToken[];
  /** Lists that are indented under this item. */
  children: ListBlock[];
}

/** A list, with the items that belong to it. */
export interface ListBlock {
  ordered: boolean;
  items: ListItem[];
}

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
  // Guard against a missing/blank input: a single malformed block must never
  // take the whole app down.
  const text = input ?? '';
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

  while (index < text.length) {
    const char = text[index];

    // `inline code`
    if (char === '`') {
      const close = text.indexOf('`', index + 1);
      if (close > index + 1) {
        push(text.slice(index + 1, close), 'code');
        index = close + 1;
        continue;
      }
    }

    // ~~strike~~
    if (char === '~' && text[index + 1] === '~') {
      const close = text.indexOf('~~', index + 2);
      if (close > index + 1) {
        push(text.slice(index + 2, close), 'strike');
        index = close + 2;
        continue;
      }
    }

    if (char === '*' || char === '_') {
      const doubled = text[index + 1] === char;

      if (doubled) {
        const close = text.indexOf(char + char, index + 2);
        const inner = close > -1 ? text.slice(index + 2, close) : '';
        if (inner.length) {
          push(inner, 'bold');
          index = close + 2;
          continue;
        }
      } else {
        // `_` inside a word (snake_case) is not emphasis.
        const before = index > 0 ? text[index - 1] : '';
        const after = text[index + 1] ?? '';
        const wordInternal = char === '_' && WORD_RE.test(before) && WORD_RE.test(after);
        const close = wordInternal ? -1 : text.indexOf(char, index + 1);
        const inner = close > -1 ? text.slice(index + 1, close) : '';
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

/** Number of leading whitespace characters on a line. */
function indentOf(line: string): number {
  const match = line.match(/^[ \t]*/);
  return match ? match[0].length : 0;
}

/**
 * Parses one list (and any lists nested inside it).
 *
 * Returns the list plus the index of the first line that does not belong to
 * it. A list that is indented under an item becomes a *child* of that item,
 * so "1. a" / "   - b" / "2. c" stays a single numbered list of two items
 * with a bullet under the first one.
 */
function parseList(
  lines: string[],
  start: number,
): { list: ListBlock; next: number } {
  const first = lines[start];
  const ordered = !!first.match(OL_RE);
  const baseIndent = indentOf(first);
  const items: ListItem[] = [];
  let index = start;

  while (index < lines.length) {
    const current = lines[index];
    const asOrdered = current.match(OL_RE);
    const asUnordered = current.match(UL_RE);
    const match = ordered ? asOrdered : asUnordered;
    const indent = indentOf(current);

    if (!current.trim()) {
      /*
        A blank line does not end a list. Models put one between the items
        ("1. a", "", "2. b"), and the list has to survive it - otherwise the
        numbering restarts at one for every item.
      */
      let ahead = index;
      while (ahead < lines.length && !lines[ahead].trim()) {
        ahead += 1;
      }
      const next = lines[ahead] ?? '';
      const continues =
        (next.match(UL_RE) || next.match(OL_RE)) && indentOf(next) <= baseIndent;
      if (!continues) {
        break;
      }
      index = ahead;
      continue;
    }

    if (match && indent <= baseIndent) {
      // A sibling item. Both UL_RE and OL_RE have a single capture group,
      // so the item text is always [1].
      //
      // (Reading [2] for ordered items passed `undefined` into parseInline
      // and crashed the app with "Cannot read properties of undefined
      // (reading 'length')" on any reply containing a numbered list.)
      items.push({ tokens: parseInline(match[1] ?? ''), children: [] });
      index += 1;
      continue;
    }

    // A more-indented list item is a nested list: it belongs to the item
    // above it.
    if ((asOrdered || asUnordered) && indent > baseIndent) {
      const sub = parseList(lines, index);
      if (items.length) {
        items[items.length - 1].children.push(sub.list);
      }
      index = sub.next;
      continue;
    }

    break;
  }

  return { list: { ordered, items }, next: index };
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
      const parsed = parseList(lines, index);
      blocks.push({ kind: 'list', list: parsed.list });
      index = parsed.next;
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
