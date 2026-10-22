<script lang="ts" setup>
/**
 * The voice chat: a full screen conversation with the model, driven by the
 * voice and watched over by the orb.
 *
 * This is what the wave button in the composer opens. Unlike the voice sheet
 * - which dictates one line and hands it back - this is a loop: it listens,
 * turns what was said into text, asks the model, reads the answer out loud,
 * and listens again. The orb (`VoiceOrb`) stands in for the model and moves
 * with the state: it opens up while listening, tightens while thinking, and
 * rolls slowly while speaking.
 *
 * The exchange is written into the conversation as it happens, so closing the
 * voice chat leaves the whole talk behind as ordinary messages.
 */
import { ref, onMounted, onUnmounted } from 'vue';
import VoiceOrb from './VoiceOrb.vue';
import Icon from './Icon.vue';
import { ensureMicrophone } from '../services/permissions';
import {
  startRecording,
  transcribe,
  speak,
  stopSpeaking,
  type Recorder,
} from '../services/audio';
import { omniAi, OmniAiError } from '../services/omni-ai';
import { useSettingsStore } from '../stores/settings';
import { useChatStore } from '../stores/chat';

const emit = defineEmits<{ close: [] }>();

const settings = useSettingsStore();
const chat = useChatStore();

type State = 'requesting' | 'listening' | 'thinking' | 'speaking' | 'error';

const state = ref<State>('requesting');
const error = ref('');
/** The live hint under the orb. */
const statusText = ref('Preparing the microphone…');

/** The recorder that is running, if there is one. */
let recorder: Recorder | null = null;
/** Set while the loop may still advance, so closing ends every chain. */
let live = false;

/* ------------------------------------------------------------------ */
/* The loop                                                            */
/* ------------------------------------------------------------------ */

/** Opens the microphone and begins the first turn. */
async function begin(): Promise<void> {
  state.value = 'requesting';
  statusText.value = 'Preparing the microphone…';

  const granted = await ensureMicrophone();
  if (!live) return;
  if (!granted) {
    state.value = 'error';
    error.value =
      'The microphone is off. Allow microphone access in Settings to talk with your voice.';
    return;
  }
  listen();
}

/** Starts a recording and waits for the person to stop it. */
function listen(): void {
  recorder = startRecording({ onMaxDuration: () => void processTurn() });
  if (!recorder) {
    state.value = 'error';
    error.value = 'The microphone could not be opened.';
    return;
  }
  state.value = 'listening';
  statusText.value = 'Listening… tap to stop';
}

/**
 * The whole of one turn: the recording becomes text, the text goes to the
 * model, and the answer is read out loud - then the microphone opens again
 * for the next turn, which is what makes it a conversation.
 */
async function processTurn(): Promise<void> {
  if (state.value !== 'listening' || !recorder) {
    return;
  }
  const current = recorder;
  recorder = null;

  state.value = 'thinking';
  statusText.value = 'Turning your words into text…';

  try {
    const audio = await current.stop();
    if (!live) return;
    // Too short - a mis-tap is not a turn. Listen again.
    if (!audio) {
      listen();
      return;
    }

    const heard = (await transcribe(audio.path, settings.sttModel)).trim();
    if (!live) return;
    if (!heard) {
      // Nothing understood - keep the conversation going.
      listen();
      return;
    }

    chat.addMessage(heard, 'user');
    statusText.value = 'Asking the model…';

    const history = chat.buildHistory(
      'You are a helpful assistant speaking with someone by voice. Answer concisely and naturally, as if out loud.',
    );

    chat.setTypingStatus(true);
    const reply = await omniAi.sendChat(history, chat.model);
    chat.setTypingStatus(false);
    if (!live) return;

    if (!reply || !reply.trim()) {
      statusText.value = 'The model had nothing to say. Listening…';
      listen();
      return;
    }

    chat.addMessage(reply, 'ai');
    state.value = 'speaking';
    statusText.value = 'Speaking…';

    await speak(reply, {
      model: settings.ttsModel,
      voice: settings.ttsVoice,
      onFallback: () => undefined,
    });
    if (!live) return;

    // The reply is done - listen for the next thing.
    listen();
  } catch (err) {
    chat.setTypingStatus(false);
    if (!live) return;
    state.value = 'error';
    error.value = describeError(err);
  }
}

/** The big button: stop the recording and take the turn, or start again. */
function onMainTap(): void {
  if (state.value === 'listening') {
    void processTurn();
  } else if (state.value === 'error') {
    void begin();
  }
}

/** Ends the conversation and closes the screen. */
function close(): void {
  live = false;
  recorder?.cancel();
  recorder = null;
  stopSpeaking();
  emit('close');
}

/** Turns a failure into something a person can act on. */
function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof OmniAiError && err.cancelled) {
    return 'The request was cancelled.';
  }
  if (/credential|no provider|not available/i.test(message)) {
    return 'The gateway has no voice model yet. Add an audio provider in Omni Ai, or change the voice model in Settings.';
  }
  if (/could not reach|unreachable/i.test(message)) {
    return 'The gateway is unreachable. Check that Omni Ai is running.';
  }
  return message || 'Something went wrong. Tap to try again.';
}

onMounted(() => {
  live = true;
  void begin();
});

onUnmounted(() => {
  live = false;
  recorder?.cancel();
  recorder = null;
  stopSpeaking();
});
</script>

<template>
  <GridLayout class="vc-root" rows="auto, *, auto">
    <!-- ============ Top bar ============ -->
    <GridLayout row="0" columns="auto, *" class="vc-top">
      <GridLayout col="0" columns="auto" class="vc-icon-btn" v-press @tap="close">
        <Icon col="0" name="close" :size="22" tone="on-surface" />
      </GridLayout>
      <Label col="1" text="Voice" class="vc-title" />
    </GridLayout>

    <!-- ============ The orb ============ -->
    <GridLayout row="1" columns="*" rows="auto, auto" class="vc-stage">
      <VoiceOrb row="0" col="0" :state="state === 'error' ? 'idle' : state" :size="200" />
      <StackLayout row="1" col="0" class="vc-status">
        <Label :text="statusText" class="vc-status-text" textWrap="true" />
        <Label v-if="state === 'error'" :text="error" class="vc-error" textWrap="true" />
      </StackLayout>
    </GridLayout>

    <!-- ============ Controls ============ -->
    <GridLayout row="2" columns="*, auto, *" class="vc-controls">
      <GridLayout col="1" columns="auto" class="vc-main" v-press @tap="onMainTap">
        <Icon
          col="0"
          :name="state === 'error' ? 'retry' : state === 'listening' ? 'stop' : 'microphone'"
          :size="30"
          :tone="state === 'listening' ? 'on-primary' : 'on-surface'"
        />
      </GridLayout>
      <Label
        col="2"
        :text="state === 'listening' ? 'STOP' : 'TALK'"
        class="vc-main-hint"
        v-press
        @tap="onMainTap"
      />
    </GridLayout>
  </GridLayout>
</template>

<style scoped>
.vc-root {
  background-color: var(--md-surface);
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* Top bar: a close button on the left, the title beside it. */
.vc-top {
  padding: 14 18 8 18;
}

.vc-icon-btn {
  width: 40;
  height: 40;
  border-radius: 20;
  background-color: var(--md-surface-container-high);
  vertical-align: center;
  horizontal-align: center;
}

.vc-title {
  color: var(--md-on-surface);
  font-size: 18;
  font-weight: 600;
  vertical-align: center;
  margin-left: 12;
}

/* The orb sits in the middle of the screen, with the hint under it. */
.vc-stage {
  vertical-align: center;
  horizontal-align: center;
}

.vc-status {
  horizontal-align: center;
  margin-top: 28;
  padding: 0 32;
}

.vc-status-text {
  color: var(--md-on-surface-variant);
  font-size: 15;
  text-align: center;
}

.vc-error {
  color: var(--md-on-error-container);
  font-size: 13;
  text-align: center;
  margin-top: 12;
  background-color: var(--md-error-container);
  border-radius: 14;
  padding: 10 14;
}

/* The one control: a big round button, and a word beside it. */
.vc-controls {
  padding: 0 24 34 24;
}

.vc-main {
  width: 76;
  height: 76;
  border-radius: 38;
  background-color: var(--md-primary);
  vertical-align: center;
  horizontal-align: center;
}

.vc-main-hint {
  color: var(--md-on-surface-variant);
  font-size: 12;
  font-weight: 700;
  letter-spacing: 0.08;
  vertical-align: center;
  margin-left: 18;
}
</style>
