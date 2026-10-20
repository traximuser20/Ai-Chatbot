<script lang="ts" setup>
/**
 * Renders a Markdown reply with native components.
 *
 * Model answers arrive as raw Markdown. A NativeScript `Label` would show the
 * asterisks and backticks verbatim, so the text is parsed into blocks
 * (see `src/utils/markdown.ts`) and each block gets its own native layout.
 *
 * Note: `FormattedString` / `Span` are NativeScript components - they are not
 * the browser's `<span>` element - and are the only way to style a part of a
 * line of text.
 */
import { computed } from 'vue';
import { parseMarkdown, type Block, type InlineToken } from '../utils/markdown';

const props = defineProps<{
  text: string;
  /** Accent colour used for bullets, quotes and inline code. */
  accent: string;
  /** Body text multiplier coming from the user's text-size setting. */
  scale?: number;
}>();

const scale = computed(() => props.scale ?? 1);

const blocks = computed<Block[]>(() => parseMarkdown(props.text ?? ''));

/** Font size of a block that inherits the body size. */
function bodySize(): number {
  return Math.round(15 * scale.value);
}

function headingSize(level: number): number {
  const base = level <= 1 ? 21 : level === 2 ? 18 : level === 3 ? 16 : 15;
  return Math.round(base * scale.value);
}

function codeSize(): number {
  return Math.round(13 * scale.value);
}

/** Weight/colour of a single inline token. */
function tokenWeight(token: InlineToken): string {
  return token.bold ? 'bold' : 'normal';
}
</script>

<template>
  <StackLayout class="md">
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <!-- ── Heading ─────────────────────────────────────────────────────── -->
      <Label
        v-if="block.kind === 'heading'"
        textWrap="true"
        class="md-heading"
        :class="`md-heading--${block.level}`"
        :fontSize="headingSize(block.level)"
      >
        <FormattedString>
          <Span
            v-for="(token, tokenIndex) in block.tokens"
            :key="tokenIndex"
            :text="token.text"
            :fontWeight="tokenWeight(token)"
            :fontStyle="token.italic ? 'italic' : 'normal'"
            :fontFamily="token.code ? 'monospace' : undefined"
            :color="token.code ? accent : undefined"
          />
        </FormattedString>
      </Label>

      <!-- ── Paragraph ───────────────────────────────────────────────────── -->
      <Label
        v-else-if="block.kind === 'paragraph'"
        textWrap="true"
        class="md-paragraph"
        :fontSize="bodySize()"
      >
        <FormattedString>
          <Span
            v-for="(token, tokenIndex) in block.tokens"
            :key="tokenIndex"
            :text="token.text"
            :fontWeight="tokenWeight(token)"
            :fontStyle="token.italic ? 'italic' : 'normal'"
            :textDecoration="token.strike ? 'line-through' : 'none'"
            :fontFamily="token.code ? 'monospace' : undefined"
            :color="token.code ? accent : undefined"
          />
        </FormattedString>
      </Label>

      <!-- ── List ────────────────────────────────────────────────────────── -->
      <StackLayout v-else-if="block.kind === 'list'" class="md-list">
        <GridLayout
          v-for="(item, itemIndex) in block.items"
          :key="itemIndex"
          columns="auto, *"
          class="md-list-row"
        >
          <Label
            col="0"
            :text="block.ordered ? `${itemIndex + 1}.` : '•'"
            class="md-list-marker"
            :color="accent"
            :fontSize="bodySize()"
          />
          <Label col="1" textWrap="true" class="md-list-text" :fontSize="bodySize()">
            <FormattedString>
              <Span
                v-for="(token, tokenIndex) in item"
                :key="tokenIndex"
                :text="token.text"
                :fontWeight="tokenWeight(token)"
                :fontStyle="token.italic ? 'italic' : 'normal'"
                :fontFamily="token.code ? 'monospace' : undefined"
                :color="token.code ? accent : undefined"
              />
            </FormattedString>
          </Label>
        </GridLayout>
      </StackLayout>

      <!-- ── Quote ───────────────────────────────────────────────────────── -->
      <GridLayout
        v-else-if="block.kind === 'quote'"
        columns="auto, *"
        class="md-quote"
      >
        <Label col="0" class="md-quote-bar" :backgroundColor="accent" />
        <Label col="1" textWrap="true" class="md-quote-text" :fontSize="bodySize()">
          <FormattedString>
            <Span
              v-for="(token, tokenIndex) in block.tokens"
              :key="tokenIndex"
              :text="token.text"
              :fontWeight="tokenWeight(token)"
              :fontStyle="token.italic ? 'italic' : 'normal'"
              :fontFamily="token.code ? 'monospace' : undefined"
              :color="token.code ? accent : undefined"
            />
          </FormattedString>
        </Label>
      </GridLayout>

      <!-- ── Code block ──────────────────────────────────────────────────── -->
      <GridLayout
        v-else-if="block.kind === 'code'"
        rows="auto, auto, *"
        class="md-code"
      >
        <GridLayout row="0" columns="*, auto" class="md-code-head">
          <Label col="0" text="code" class="md-code-tag" />
          <Label
            col="1"
            :text="block.lang || 'text'"
            class="md-code-lang"
            :color="accent"
          />
        </GridLayout>
        <Label row="1" class="md-code-rule" />
        <Label
          row="2"
          textWrap="true"
          class="md-code-text"
          :text="block.code"
          :fontSize="codeSize()"
        />
      </GridLayout>

      <!-- ── Horizontal rule ─────────────────────────────────────────────── -->
      <Label v-else-if="block.kind === 'rule'" class="md-rule" />
    </template>
  </StackLayout>
</template>

<style scoped>
.md {
  /* Nothing to lay out on the container itself. */
}

/* ---------- Paragraph ---------- */
.md-paragraph {
color: var(--app-ink);
  margin-bottom: 10;
}

/* ---------- Heading ---------- */
.md-heading {
color: var(--app-ink-strong);
  font-weight: 700;
  margin-top: 6;
  margin-bottom: 6;
}

.md-heading--1 {
  letter-spacing: -0.02;
}

.md-heading--2 {
  letter-spacing: -0.015;
}

/* ---------- List ---------- */
.md-list {
  margin-bottom: 10;
}

.md-list-row {
  margin-bottom: 4;
}

.md-list-marker {
  font-family: monospace;
  font-weight: 700;
  width: 22;
  text-align: left;
  padding-right: 2;
  /* Align the marker with the FIRST line of the item, not with the centre
     of the (possibly wrapped) text block. */
  vertical-align: top;
}

.md-list-text {
color: var(--app-ink);
}

/* ---------- Quote ---------- */
.md-quote {
  margin-bottom: 10;
}

.md-quote-bar {
  width: 3;
  border-radius: 2;
background-color: var(--app-quote-bar);
  margin-right: 10;
}

.md-quote-text {
color: var(--app-quote-ink);
  font-style: italic;
}

/* ---------- Code block ---------- */
.md-code {
background-color: var(--app-code-bg);
  border-radius: 12;
  padding: 0;
  margin-bottom: 10;
}

.md-code-head {
  padding: 8 12 6 12;
}

.md-code-tag {
color: var(--app-code-tag);
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.14;
  text-transform: uppercase;
}

.md-code-lang {
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
}

.md-code-rule {
  height: 1;
background-color: var(--app-code-rule);
}

.md-code-text {
color: var(--app-code-ink);
  font-family: monospace;
  padding: 10 12 12 12;
}

/* ---------- Rule ---------- */
.md-rule {
  height: 1;
background-color: var(--app-rule);
  margin: 4 0 12 0;
}
</style>
