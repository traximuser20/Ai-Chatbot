<script lang="ts" setup>
/**
 * Chat bubble for a single message.
 *
 * Mirrors the ChatGPT mobile layout:
 *  - User messages sit in a light-grey rounded pill, right-aligned.
 *  - AI messages are plain text on the page background, left-aligned and
 *    full-width, so long answers are easy to read.
 */
import { computed } from 'vue';

const props = defineProps<{
  text: string;
  sender: 'user' | 'ai';
  timestamp?: string;
  isError?: boolean;
}>();

const isUser = computed(() => props.sender === 'user');

/**
 * Splits a message into paragraphs.
 *
 * A NativeScript `Label` with `textWrap="true"` collapses embedded "\n"
 * characters into a single line break (and renders them oddly), so each
 * paragraph is rendered as its own Label instead. Blank lines are dropped
 * and the spacing between paragraphs is handled with CSS margins.
 */
const paragraphs = computed(() =>
  props.text
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
    :columns="isUser ? '*, auto' : '*'"
    class="message-row"
  >
    <!-- User message: light grey pill, right aligned. -->
    <Label
      v-if="isUser"
      col="1"
      :text="text"
      textWrap="true"
      class="user-bubble"
    />

    <!-- AI message: plain text on the page background. -->
    <StackLayout v-else col="0" class="ai-bubble-wrap">
      <Label
        v-for="(paragraph, index) in paragraphs"
        :key="index"
        :text="paragraph"
        textWrap="true"
        class="ai-text"
        :class="{ 'ai-text--error': isError }"
      />
      <Label
        v-if="timestamp"
        :text="timestamp"
        class="ai-timestamp"
      />
    </StackLayout>
  </GridLayout>
</template>

<style scoped>
.message-row {
  padding: 4 12;
}

/* User message: light grey pill, right aligned (ChatGPT mobile style). */
.user-bubble {
  background-color: #f0f0f0;
  color: #0d0d0d;
  border-radius: 22px;
  padding: 10 16;
  font-size: 15;
  max-width: 300;
  /* Bubble hugs its content but never grows past the bubble column. */
  horizontal-align: right;
}

/* AI message: no bubble, just text on the page background. */
.ai-bubble-wrap {
  padding: 6 0 8 0;
}

.ai-text {
  color: #0d0d0d;
  font-size: 15;
  /*
    No 'line-height' here on purpose: NativeScript maps it to
    TextView.setLineSpacing(extra, 1), i.e. it ADDS the value to the
    font's natural line height. Setting 'line-height: 22' on a 15px font
    produced a ~37px line box with big gaps between wrapped lines.
  */
  /* Vertical space between two paragraphs. */
  margin-bottom: 10;
}

.ai-timestamp {
  color: #9a9a9a;
  font-size: 11;
  margin-top: 2;
}

/* Error messages (e.g. the gateway is unreachable) are highlighted. */
.ai-text--error {
  color: #b3261e;
}
</style>
