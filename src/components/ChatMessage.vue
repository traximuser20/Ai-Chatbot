<script lang="ts" setup>
/**
 * A single chat bubble.
 *
 * Layout rules:
 *  - The user speaks in an ink-filled bubble, right aligned, with a slightly
 *    tighter bottom-right corner - the "tail" detail most modern chat apps
 *    use to keep the two sides visually distinct.
 *  - The assistant speaks in plain text on the page canvas, left aligned, so
 *    long answers stay comfortable to read. Above the text sits a small
 *    mono "route chip" showing which provider answered.
 *
 * The accent colour is derived from the provider, so the colour of the
 * interface always tells you who you are talking to.
 */
import { computed, onMounted, ref } from 'vue';
import MarkdownView from './MarkdownView.vue';
import Icon from './Icon.vue';
import { providerOf } from '../utils/accent';
import { enter } from '../utils/motion';

const props = defineProps<{
  text: string;
  sender: 'user' | 'ai';
  timestamp?: string;
  isError?: boolean;
  /** Model that produced the reply. */
  model?: string;
  /** Accent colour of the active provider. */
  accent?: string;
  /** Body text multiplier from the user's text-size setting. */
  scale?: number;
  showTimestamp?: boolean;
}>();

const isUser = computed(() => props.sender === 'user');

const accent = computed(() => props.accent ?? '#2F55F5');

/** The bubble, so it can be animated in when it appears. */
const bubbleRef = ref<any>(null);

onMounted(() => {
  // Every message arrives with a small lift, so the conversation feels alive.
  enter(bubbleRef.value?.nativeView, { distance: props.sender === 'user' ? 8 : 12 });
});

/** Provider prefix, e.g. "auto" for "auto/best-fast". */
const provider = computed(() => (props.model ? providerOf(props.model) : ''));

/** Model name without the provider prefix. */
const modelName = computed(() => {
  if (!props.model) {
    return '';
  }
  const slash = props.model.indexOf('/');
  return slash > -1 ? props.model.slice(slash + 1) : props.model;
});

const scale = computed(() => props.scale ?? 1);

/**
 * Splits a message into paragraphs.
 *
 * A NativeScript `Label` with `textWrap="true"` collapses embedded "\n"
 * characters into a single line break (and renders them oddly), so each
 * paragraph is rendered as its own Label instead.
 */
const paragraphs = computed(() =>
  (props.text ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0),
);
</script>

<template>
  <!--
    Alignment without CSS Grid's 'justify-self':
      - User  -> columns "*, auto": the trailing 'auto' column hugs the
                 bubble and the leading '*' spacer pushes it to the right.
      - AI    -> columns "*": the text column is constrained to the page
                 width, so long answers wrap instead of being clipped.
  -->
  <GridLayout
    ref="bubbleRef"
    :columns="isUser ? '*, auto' : '*'"
    class="message-row"
  >
    <!-- ── User message ─────────────────────────────────────────────────── -->
    <StackLayout v-if="isUser" col="1" class="user-bubble">
      <Label
        v-for="(paragraph, paragraphIndex) in paragraphs"
        :key="paragraphIndex"
        textWrap="true"
        class="user-text"
        :text="paragraph"
        :fontSize="Math.round(15 * scale)"
      />
    </StackLayout>

    <!-- ── Assistant message ────────────────────────────────────────────── -->
    <StackLayout v-else col="0" class="ai-block">
      <!-- Route chip: who answered. -->
      <GridLayout
        v-if="provider || modelName"
        columns="auto, auto"
        class="ai-chip"
      >
        <Icon col="0" name="dot" :size="8" :color="accent" class="ai-chip-dot" />
        <Label
          col="1"
          :text="provider ? `${provider} / ${modelName}` : modelName"
          class="ai-chip-text"
        />
      </GridLayout>

      <!-- Error notice. -->
      <GridLayout v-if="isError" columns="auto, *" class="ai-error">
        <Label col="0" text="!" class="ai-error-mark" />
        <Label col="1" textWrap="true" class="ai-error-text" :text="text ?? ''" />
      </GridLayout>

      <MarkdownView
        v-else
        :text="text ?? ''"
        :accent="accent"
        :scale="scale"
      />

      <Label
        v-if="timestamp && showTimestamp"
        :text="timestamp"
        class="ai-timestamp"
      />
    </StackLayout>
  </GridLayout>
</template>

<style scoped>
.message-row {
  padding: 6 16;
  horizontal-align: stretch;
}

/* ---------- User bubble ---------- */
.user-bubble {
  background-color: #0e111b;
  border-top-left-radius: 20;
  border-top-right-radius: 20;
  border-bottom-left-radius: 20;
  border-bottom-right-radius: 7;
  padding: 11 16;
  max-width: 290;
  horizontal-align: right;
}

.user-text {
  color: #ffffff;
  font-weight: 400;
  margin-bottom: 2;
}

/* ---------- Assistant block ---------- */
.ai-block {
  padding: 2 0 8 0;
}

.ai-chip {
  margin-bottom: 4;
}

.ai-chip-dot {
  width: 13;
  vertical-align: center;
}

.ai-chip-text {
  color: #79808d;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.1;
  text-transform: uppercase;
  vertical-align: center;
}

.ai-timestamp {
  color: #a2a8b3;
  font-family: monospace;
  font-size: 10;
  margin-top: 4;
}

/* ---------- Error ---------- */
.ai-error {
  background-color: #fdf0ef;
  border-left-width: 3;
  border-left-color: #c0392b;
  border-radius: 8;
  padding: 10 12;
  margin-bottom: 4;
}

.ai-error-mark {
  color: #c0392b;
  font-weight: 700;
  font-size: 13;
  width: 18;
  vertical-align: top;
}

.ai-error-text {
  color: #8c2f24;
  font-size: 14;
}
</style>
