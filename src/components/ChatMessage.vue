<script lang="ts" setup>
/**
 * A single chat bubble.
 *
 * Layout rules:
 *  - The user speaks in a container bubble, right aligned, with a slightly
 *    tighter bottom-right corner - the "tail" detail most modern chat apps
 *    use to keep the two sides visually distinct.
 *  - The assistant speaks in plain text on the page canvas, left aligned, so
 *    long answers stay comfortable to read. Above the text sits a small
 *    "route chip" showing which provider answered.
 *
 * The bubble of the user is painted with the container colour of the primary
 * role, so the colour of the interface always tells you who you are talking
 * to - the whole scheme follows the route (see `src/utils/material.ts`).
 */
import { computed, onMounted, ref } from 'vue';
import MarkdownView from './MarkdownView.vue';
import Icon from './Icon.vue';
import { providerOf } from '../utils/accent';
import { enter } from '../utils/motion';
import { formatSize } from '../utils/attachments';
import type { Attachment } from '../stores/chat';

const props = defineProps<{
  text: string;
  sender: 'user' | 'ai';
  timestamp?: string;
  isError?: boolean;
  /** Model that produced the reply. */
  model?: string;
  /** Body text multiplier from the user's text-size setting. */
  scale?: number;
  showTimestamp?: boolean;
  /** Files that were sent with this message. */
  attachments?: Attachment[];
}>();

const isUser = computed(() => props.sender === 'user');

/** The image attachments of the message, so they can be shown as thumbnails. */
const images = computed(() => (props.attachments ?? []).filter((a) => a.kind === 'image'));
/** The document attachments of the message. */
const documents = computed(() => (props.attachments ?? []).filter((a) => a.kind === 'document'));

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
      <!-- Attachments: a thumbnail for each image, a chip for each document. -->
      <StackLayout v-if="images.length" class="att-thumbs">
        <Image
          v-for="(image, imageIndex) in images"
          :key="`img-${imageIndex}`"
          :src="image.path"
          class="att-thumb"
          stretch="aspectFill"
        />
      </StackLayout>

      <StackLayout
        v-for="(document, documentIndex) in documents"
        :key="`doc-${documentIndex}`"
        orientation="horizontal"
        class="att-doc"
      >
        <Icon name="file" :size="15" tone="on-primary-container" class="att-doc-icon" />
        <Label :text="document.name" class="att-doc-name" textWrap="true" />
        <Label :text="formatSize(document.size)" class="att-doc-size" />
      </StackLayout>

      <Label
        v-for="(paragraph, paragraphIndex) in paragraphs"
        :key="paragraphIndex"
        textWrap="true"
        class="user-text"
        :text="paragraph"
        :fontSize="Math.round(16 * scale)"
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
        <Icon col="0" name="dot" :size="7" tone="primary" class="ai-chip-dot" />
        <Label
          col="1"
          :text="provider ? `${provider} / ${modelName}` : modelName"
          class="ai-chip-text"
        />
      </GridLayout>

      <!-- Error notice. -->
      <GridLayout v-if="isError" columns="auto, *" class="ai-error">
        <Icon col="0" name="warning" :size="16" tone="error" class="ai-error-icon" />
        <Label col="1" textWrap="true" class="ai-error-text" :text="text ?? ''" />
      </GridLayout>

      <MarkdownView
        v-else
        :text="text ?? ''"
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
  padding: 8 16;
  horizontal-align: stretch;
}

/* ---------- User bubble ---------- */
.user-bubble {
  background-color: var(--md-primary-container);
  border-top-left-radius: 18;
  border-top-right-radius: 18;
  border-bottom-left-radius: 18;
  border-bottom-right-radius: 4;
  padding: 12 16;
  max-width: 300;
  horizontal-align: right;
}

.user-text {
  color: var(--md-on-primary-container);
  margin-bottom: 2;
}

/* ---------- Attachments ---------- */
.att-thumbs {
  margin-bottom: 6;
}

/* A thumbnail of an attached image, capped so a photo does not fill the screen. */
.att-thumb {
  width: 208;
  height: 156;
  border-radius: 12;
  margin-bottom: 6;
}

/* A document, shown as a compact chip that reads on the coloured bubble. */
.att-doc {
  background-color: var(--md-surface-container-high);
  border-radius: 10;
  padding: 8 10;
  margin-bottom: 6;
  width: 214;
}

.att-doc-icon {
  margin-right: 8;
  vertical-align: center;
}

.att-doc-name {
  color: var(--md-on-surface);
  font-size: 12;
  font-weight: 500;
  vertical-align: center;
  width: 128;
}

.att-doc-size {
  color: var(--md-on-surface-variant);
  font-size: 11;
  vertical-align: center;
  margin-left: 6;
}

/* ---------- Assistant block ---------- */
.ai-block {
  padding: 2 0 10 0;
}

.ai-chip {
  margin-bottom: 8;
}

.ai-chip-dot {
  margin-right: 7;
  vertical-align: center;
}

.ai-chip-text {
  color: var(--md-on-surface-variant);
  font-size: 11;
  font-weight: 600;
  letter-spacing: 0.06;
  vertical-align: center;
}

.ai-timestamp {
  color: var(--md-outline);
  font-size: 11;
  margin-top: 8;
}

/* ---------- Error ---------- */
.ai-error {
  background-color: var(--md-error-container);
  border-radius: 12;
  padding: 12 14;
  margin-bottom: 4;
}

.ai-error-icon {
  margin-right: 10;
  vertical-align: center;
}

.ai-error-text {
  color: var(--md-on-error-container);
  font-size: 14;
}
</style>
