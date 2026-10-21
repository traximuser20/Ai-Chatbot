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
import MdList from './MdList.vue';
import { usePaletteStore } from '../stores/palette';
import { parseMarkdown, type Block, type InlineToken } from '../utils/markdown';

const props = defineProps<{
  text: string;
  /** Body text multiplier coming from the user's text-size setting. */
  scale?: number;
}>();

const palette = usePaletteStore();

const scale = computed(() => props.scale ?? 1);

const blocks = computed<Block[]>(() => parseMarkdown(props.text ?? ''));

/**
 * The colour of the marks: the primary role of the scheme, so the marks of
 * a reply belong to the route that wrote it.
 */
const accent = computed(() => palette.scheme.primary);

/** Font size of a block that inherits the body size. */
function bodySize(): number {
  return Math.round(16 * scale.value);
}

function headingSize(level: number): number {
  const base = level <= 1 ? 22 : level === 2 ? 19 : level === 3 ? 17 : 16;
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
    <!--
      The blocks are rendered through a wrapper element, not through a
      `<template v-for>`. A template inside a native view puts the element of
      the second round into the element of the first one, which drew a nested
      list into the row of the item above it.
    -->
    <StackLayout v-for="(block, blockIndex) in blocks" :key="blockIndex" class="md-block">
      <!-- Heading -->
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

      <!-- Paragraph -->
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

      <!-- List (a component of its own: a list can be nested in an item) -->
      <MdList
        v-else-if="block.kind === 'list'"
        :list="block.list"
        :scale="scale"
      />

      <!-- Quote -->
      <GridLayout
        v-else-if="block.kind === 'quote'"
        columns="auto, *"
        class="md-quote"
      >
        <Label col="0" class="md-quote-bar" />
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

      <!-- Code block -->
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

      <!-- Horizontal rule -->
      <Label v-else-if="block.kind === 'rule'" class="md-rule" />
    </StackLayout>
  </StackLayout>
</template>

<style scoped>
.md {
  /* Nothing to lay out on the container itself. */
}

/* ---------- Paragraph ---------- */
.md-paragraph {
  color: var(--md-on-surface);
  margin-bottom: 10;
}

/* ---------- Heading ---------- */
.md-heading {
  color: var(--md-on-surface);
  font-weight: 600;
  margin-top: 8;
  margin-bottom: 6;
}

.md-heading--1 {
  letter-spacing: -0.01;
}

/* ---------- Quote ---------- */
.md-quote {
  margin-bottom: 10;
}

.md-quote-bar {
  width: 3;
  border-radius: 2;
  background-color: var(--md-primary);
  margin-right: 10;
}

.md-quote-text {
  color: var(--md-on-surface-variant);
  font-style: italic;
}

/* ---------- Code block ---------- */
.md-code {
  background-color: var(--md-code-bg);
  border-radius: 12;
  padding: 0;
  margin-bottom: 10;
}

.md-code-head {
  padding: 10 14 8 14;
}

.md-code-tag {
  color: var(--md-code-tag);
  font-size: 10;
  font-weight: 600;
  letter-spacing: 0.12;
  text-transform: uppercase;
}

.md-code-lang {
  font-size: 10;
  letter-spacing: 0.08;
}

.md-code-rule {
  height: 1;
  background-color: var(--md-code-rule);
}

.md-code-text {
  color: var(--md-code-ink);
  font-family: monospace;
  padding: 10 14 14 14;
}

/* ---------- Rule ---------- */
.md-rule {
  height: 1;
  background-color: var(--md-outline-variant);
  margin: 6 0 12 0;
}
</style>
