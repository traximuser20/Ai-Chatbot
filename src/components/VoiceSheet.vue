<script lang="ts" setup>
/**
 * The voice sheet: the ears of the composer.
 *
 * It opens over the chat, records from the microphone, and turns what was
 * said into text with the gateway's transcription route - and the words
 * become the message that is being written. (Searching a list with the voice
 * has a screen of its own: `VoiceSearch.vue`, which is shaped like the voice
 * search of Google's app.)
 *
 * Tap the big button to stop; tap the scrim or the close button to throw the
 * recording away. The record -> transcribe -> done path is the only thing in
 * here - the caller decides what the words are used for.
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { loopAnimation } from '../utils/motion';
import { ensureMicrophone } from '../services/permissions';
import { startRecording, transcribe, type Recorder } from '../services/audio';
import { useSettingsStore } from '../stores/settings';
import Icon from './Icon.vue';

const props = defineProps<{
  /** A short label for what the words will do - "Search", "Ask", ... */
  label?: string;
}>();

const emit = defineEmits<{
  close: [];
  /** The finished transcript. */
  done: [text: string];
}>();

const settings = useSettingsStore();

type State = 'requesting' | 'listening' | 'transcribing' | 'error';

const state = ref<State>('requesting');
const error = ref('');
/** A live hint under the button. */
const statusText = ref('Preparing the microphone…');

/** The recorder that is running, if there is one. */
let recorder: Recorder | null = null;

/** The pulsing ring around the button, so the loop can be stopped. */
const ringRef = ref<any>(null);
let stopRing: (() => void) | undefined;

function startRing() {
  stopRing?.();
  stopRing = loopAnimation(ringRef.value?.nativeView, [
    { properties: { scale: { x: 1, y: 1 }, opacity: 0.5 }, duration: 760 },
    { properties: { scale: { x: 1.5, y: 1.5 }, opacity: 0 }, duration: 760 },
  ]);
}

onMounted(async () => {
  nextTick(startRing);

  const granted = await ensureMicrophone();
  if (!granted) {
    state.value = 'error';
    error.value = 'The microphone is off. Allow microphone access in Settings to use your voice.';
    return;
  }

  recorder = startRecording({ onMaxDuration: () => void finish() });
  if (!recorder) {
    state.value = 'error';
    error.value = 'The microphone could not be opened.';
    return;
  }

  state.value = 'listening';
  statusText.value = 'Listening… tap to stop';
});

onUnmounted(() => {
  stopRing?.();
  recorder?.cancel();
  recorder = null;
});

/** Stops the recording and turns it into text. */
async function finish() {
  if (state.value !== 'listening' || !recorder) {
    return;
  }
  state.value = 'transcribing';
  statusText.value = 'Turning your words into text…';

  const current = recorder;
  recorder = null;

  try {
    const audio = await current.stop();
    if (!audio) {
      // Too short - nothing worth transcribing was said.
      state.value = 'listening';
      statusText.value = 'Listening… tap to stop';
      recorder = startRecording({ onMaxDuration: () => void finish() });
      return;
    }

    const text = (await transcribe(audio.path, settings.sttModel)).trim();
    if (!text) {
      state.value = 'error';
      error.value = 'Nothing was understood. Try again.';
      return;
    }
    emit('done', text);
  } catch (err) {
    state.value = 'error';
    error.value = describeError(err);
  }
}

/** Throws the recording away. */
function cancel() {
  recorder?.cancel();
  recorder = null;
  emit('close');
}

/** Turns a transcription failure into something a person can act on. */
function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/credential|no provider|not available/i.test(message)) {
    return 'The gateway has no voice model yet. Add a provider that supports audio in Omni Ai, or change the voice model in Settings.';
  }
  if (/could not reach|unreachable/i.test(message)) {
    return 'The gateway is unreachable. Check that Omni Ai is running.';
  }
  return message || 'The recording could not be transcribed.';
}
</script>

<template>
  <GridLayout class="voice-backdrop" @tap="cancel">
    <GridLayout class="voice-sheet" rows="auto, auto, auto, auto" @tap="() => {}">
      <Label row="0" class="voice-handle" />

      <GridLayout row="1" columns="auto" class="voice-head">
        <Label :text="label ? `${label} with your voice` : 'Voice input'" class="voice-title" />
      </GridLayout>

      <!-- The big button, with a ring that pulses while it listens. -->
      <GridLayout row="2" columns="auto" class="voice-stage">
        <Label
          ref="ringRef"
          col="0"
          class="voice-ring"
          :class="{ 'voice-ring--live': state === 'listening' }"
        />
        <GridLayout
          col="0"
          columns="*"
          rows="*"
          class="voice-button"
          :class="{
            'voice-button--listening': state === 'listening',
            'voice-button--busy': state === 'transcribing',
            'voice-button--error': state === 'error',
          }"
          v-press
          @tap="state === 'listening' ? finish() : undefined"
        >
          <Icon
            col="0"
            :name="state === 'error' ? 'warning' : state === 'transcribing' ? 'dots' : 'microphone'"
            :size="34"
            :tone="state === 'listening' ? 'on-primary' : 'on-surface'"
          />
        </GridLayout>
      </GridLayout>

      <StackLayout row="3" class="voice-status">
        <Label :text="statusText" class="voice-status-text" textWrap="true" />
        <Label v-if="state === 'error'" :text="error" class="voice-error" textWrap="true" />
        <Label
          v-if="state === 'error'"
          text="CLOSE"
          class="voice-close"
          v-press
          @tap="cancel"
        />
      </StackLayout>
    </GridLayout>
  </GridLayout>
</template>

<style scoped>
.voice-backdrop {
  background-color: var(--md-scrim);
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* A modal bottom sheet that carries the voice control. */
.voice-sheet {
  background-color: var(--md-surface-container-low);
  border-top-left-radius: 28;
  border-top-right-radius: 28;
  horizontal-align: stretch;
  vertical-align: bottom;
  padding: 0 24 28 24;
}

.voice-handle {
  width: 32;
  height: 4;
  border-radius: 2;
  background-color: var(--md-on-surface-variant);
  opacity: 0.4;
  margin-top: 12;
  margin-bottom: 10;
  horizontal-align: center;
}

.voice-title {
  color: var(--md-on-surface);
  font-size: 20;
  font-weight: 600;
  horizontal-align: center;
  margin-bottom: 8;
}

/* The stage holds the ring and the button on the same spot. */
.voice-stage {
  margin: 18 0;
  horizontal-align: center;
}

/* The pulse that travels outward while the microphone is open. */
.voice-ring {
  width: 84;
  height: 84;
  border-radius: 42;
  background-color: var(--md-primary);
  opacity: 0;
  vertical-align: center;
  horizontal-align: center;
}

.voice-ring--live {
  opacity: 0.4;
}

.voice-button {
  width: 84;
  height: 84;
  border-radius: 42;
  background-color: var(--md-surface-container-highest);
  vertical-align: center;
  horizontal-align: center;
}

.voice-button--listening {
  background-color: var(--md-primary);
}

.voice-button--busy {
  background-color: var(--md-secondary-container);
}

.voice-button--error {
  background-color: var(--md-error-container);
}

.voice-status {
  horizontal-align: center;
}

.voice-status-text {
  color: var(--md-on-surface-variant);
  font-size: 14;
  text-align: center;
}

.voice-error {
  color: var(--md-on-error-container);
  font-size: 13;
  text-align: center;
  margin-top: 10;
  background-color: var(--md-error-container);
  border-radius: 12;
  padding: 10 14;
}

.voice-close {
  color: var(--md-primary);
  font-size: 13;
  font-weight: 700;
  letter-spacing: 0.08;
  text-align: center;
  margin-top: 14;
}
</style>
