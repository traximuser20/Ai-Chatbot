<script lang="ts" setup>
/**
 * Voice search: the microphone of the model picker, shaped like the voice
 * search of Google's app on Android.
 *
 * The screen takes over whatever is behind it - one search bar at the top,
 * one big microphone in the middle, the way out at the bottom - and it
 * *shows* the listening instead of promising it: a waveform of the last two
 * seconds runs under the headline, drawn from the amplitude of the
 * microphone (`Recorder.level`), so the bars move with the words.
 *
 * The turn ends the way Google's ends it: when the room goes quiet the
 * recording stops on its own, the words come back from the gateway, they sit
 * in the search bar for a beat, and the list behind this screen is filtered
 * with them. The finger can end it earlier - the microphone is the one
 * control of the screen - and the X throws the words away.
 *
 * The caller only ever sees two events: `done` with the words, `close`
 * without them. What the words are good for is the caller's business, so the
 * same screen could search anything.
 */
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { enter, loopAnimation, type LoopFrame } from '../utils/motion';
import { ensureMicrophone } from '../services/permissions';
import { startRecording, transcribe, type Recorder } from '../services/audio';
import { useSettingsStore } from '../stores/settings';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    /** The hint of the search bar before there are words. */
    placeholder?: string;
  }>(),
  { placeholder: 'Search' },
);

const emit = defineEmits<{
  close: [];
  /** The finished transcript. */
  done: [text: string];
}>();

const settings = useSettingsStore();

type State = 'requesting' | 'listening' | 'transcribing' | 'done' | 'error';

const state = ref<State>('requesting');
/** The words, once there are any - they are the query of the search bar. */
const query = ref('');
const error = ref('');
/** The headline of the failure - it says *what* went wrong, the body says why. */
const errorTitle = ref('');

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

/** How often the waveform is redrawn: faster than the eye, slower than a layout. */
const TICK_MS = 90;

/** Bars in the waveform - enough to read as sound, few enough to lay out cheaply. */
const BAR_COUNT = 24;

/**
 * The bars of the waveform, in dip.
 *
 * The box that holds them is fixed at 60 in the style sheet - a loud bar
 * then has room to grow without ever shoving the microphone under it.
 */
const BAR_MIN = 3;
const BAR_MAX = 52;

/** A level above this counts as a person talking rather than the room. */
const LOUD = 0.12;

/** A turn shorter than this is a mis-tap, and a mis-tap cannot end itself. */
const MIN_LISTEN_MS = 900;

/** A pause this long means the person has finished their sentence. */
const SILENCE_MS = 2600;

/** The words sit in the search bar for a beat before the list takes them. */
const HOLD_MS = 520;

/* ------------------------------------------------------------------ */
/* The waveform                                                        */
/* ------------------------------------------------------------------ */

/**
 * One sample per bar: the oldest on the left, the one taken now on the
 * right, which is what makes the strip read as sound scrolling by.
 */
const levels = ref<number[]>(Array.from({ length: BAR_COUNT }, () => 0));

/** The height of a bar of the waveform, in dip. */
function barHeight(index: number): number {
  const level = levels.value[index] ?? 0;
  return Math.round(BAR_MIN + level * (BAR_MAX - BAR_MIN));
}

/**
 * The bars at the ends of the strip are dimmer, so the wave reads as one
 * piece of sound rather than a row of switches. It only depends on the
 * index, so it is the same on every redraw.
 */
function barFade(index: number): number {
  const edge = Math.min(index, BAR_COUNT - 1 - index);
  return Math.round((0.35 + 0.65 * Math.min(1, edge / 3)) * 100) / 100;
}

/** Drops the waveform back to a flat line. */
function restWave(): void {
  levels.value = Array.from({ length: BAR_COUNT }, () => 0);
}

/* ------------------------------------------------------------------ */
/* The state of the ear                                                */
/* ------------------------------------------------------------------ */

/** The recorder that is running, if there is one. */
let recorder: Recorder | null = null;

/** `false` the moment the screen goes away, so every chain ends with it. */
let live = true;

/** The sampler of the waveform, so it can be stopped with the microphone. */
let sampler: number | undefined;

/** The beat where the words sit in the search bar. */
let hold: number | undefined;

/** When the turn started, and when a voice was last heard. */
let startedAt = 0;
let lastLoud = 0;

/**
 * Whether the microphone reports an amplitude at all.
 *
 * A device that never answers `getMaxAmplitude()` looks exactly like a silent
 * room - and a room that never auto-stops is better than a turn that is cut
 * in the middle of a sentence, so silence detection stays off until the
 * microphone has really spoken once.
 */
let heardTheMic = false;

/** The headline above the waveform. */
const headline = computed(() => {
  switch (state.value) {
    case 'requesting':
      return 'Getting the microphone ready…';
    case 'listening':
      return 'Listening…';
    case 'transcribing':
      return 'Turning your words into text…';
    case 'done':
      return 'Searching…';
    default:
      return errorTitle.value;
  }
});

/** The line under the microphone: what the person is supposed to do. */
const support = computed(() => {
  if (state.value !== 'listening') {
    return '';
  }
  return 'Speak now. It searches when you pause - or tap the microphone.';
});

/** What the search bar shows: the words when there are any, the hint until then. */
const barText = computed(() => query.value || props.placeholder);

const barIsHint = computed(() => !query.value);

/** The glyph of the button: what tapping it does right now. */
const micIcon = computed(() => {
  switch (state.value) {
    case 'transcribing':
      return 'dots';
    case 'done':
      return 'search';
    case 'error':
      return 'warning';
    default:
      return 'microphone';
  }
});

/** The role the glyph is painted with - it belongs to the surface behind it. */
const micTone = computed(() => {
  switch (state.value) {
    case 'listening':
      return 'on-primary' as const;
    case 'done':
      return 'on-primary' as const;
    case 'transcribing':
      return 'on-secondary-container' as const;
    case 'error':
      return 'on-error-container' as const;
    default:
      return 'on-surface-variant' as const;
  }
});

/** The surface of the button: primary while the ear is open, calm otherwise. */
const micClass = computed(() => {
  switch (state.value) {
    case 'listening':
    case 'done':
      return 'vs-mic--live';
    case 'transcribing':
      return 'vs-mic--busy';
    case 'error':
      return 'vs-mic--error';
    default:
      return '';
  }
});

/* ------------------------------------------------------------------ */
/* The rings                                                           */
/* ------------------------------------------------------------------ */

const rootRef = ref<any>(null);
const ringARef = ref<any>(null);
const ringBRef = ref<any>(null);

/**
 * The ripple: the ring grows out of the button and fades away, and the two
 * rings take turns. Only the scale and the opacity move here - the visibility
 * of the pair belongs to the `.vs-rings` box (see the note in the styles),
 * so a loop that is stopped in the middle of a cycle cannot leave a ring
 * standing on screen.
 */
const RING_FRAMES: LoopFrame[] = [
  { properties: { scale: { x: 1, y: 1 }, opacity: 0.45 }, duration: 120, curve: 'easeOut' },
  { properties: { scale: { x: 1.6, y: 1.6 }, opacity: 0 }, duration: 900, curve: 'easeOut' },
];

let stopRings: (() => void) | undefined;

function startRings(): void {
  haltRings();
  const ringA = loopAnimation(ringARef.value?.nativeView, RING_FRAMES);
  const ringB = loopAnimation(ringBRef.value?.nativeView, RING_FRAMES, { delay: 450 });
  stopRings = () => {
    ringA();
    ringB();
  };
}

function haltRings(): void {
  stopRings?.();
  stopRings = undefined;
}

/* ------------------------------------------------------------------ */
/* Listening                                                           */
/* ------------------------------------------------------------------ */

/** Opens the microphone and begins a turn. */
async function begin(): Promise<void> {
  state.value = 'requesting';
  error.value = '';

  const granted = await ensureMicrophone();
  if (!live) return;
  if (!granted) {
    fail(
      'The microphone is off. Allow microphone access in Settings to search with your voice.',
      'The microphone is off',
    );
    return;
  }

  recorder = startRecording({ onMaxDuration: () => void finish() });
  if (!recorder) {
    fail('The microphone could not be opened.', 'The microphone is off');
    return;
  }

  startedAt = Date.now();
  lastLoud = Date.now();
  heardTheMic = false;
  state.value = 'listening';
  startSampler();
}

/** Reads the microphone on a clock: one sample for the waveform, one look at the silence. */
function startSampler(): void {
  stopSampler();
  sampler = setInterval(sample, TICK_MS) as unknown as number;
}

function stopSampler(): void {
  if (sampler !== undefined) {
    clearInterval(sampler);
    sampler = undefined;
  }
}

function sample(): void {
  const current = recorder;
  if (!current || state.value !== 'listening' || !live) {
    return;
  }

  const level = current.level();
  if (level > 0) {
    heardTheMic = true;
  }
  if (level >= LOUD) {
    lastLoud = Date.now();
  }
  // The strip scrolls: the newest sample joins on the right.
  levels.value = [...levels.value.slice(1), level];

  const now = Date.now();
  if (heardTheMic && now - startedAt > MIN_LISTEN_MS && now - lastLoud > SILENCE_MS) {
    // The room went quiet - Google would take that as the end of the query.
    void finish();
  }
}

/**
 * Stops the recording and turns it into text.
 *
 * The words then land in the search bar for a beat before they are handed
 * over, so the person sees what was understood rather than a list that
 * changes behind their back.
 */
async function finish(): Promise<void> {
  if (state.value !== 'listening' || !recorder) {
    return;
  }
  state.value = 'transcribing';
  stopSampler();
  restWave();

  const current = recorder;
  recorder = null;

  try {
    const audio = await current.stop();
    if (!live) return;
    if (!audio) {
      // Too short to hold a word: listen again instead of scolding.
      void begin();
      return;
    }

    const text = (await transcribe(audio.path, settings.sttModel)).trim();
    if (!live) return;
    if (!text) {
      fail('Nothing was understood. Try again.', 'Didn’t catch that.');
      return;
    }

    query.value = text;
    state.value = 'done';
    hold = setTimeout(() => {
      if (live) {
        emit('done', text);
      }
    }, HOLD_MS) as unknown as number;
  } catch (err) {
    if (!live) return;
    fail(describeError(err), 'That didn’t work.');
  }
}

/** The microphone button: stop the turn, or take a second try after a failure. */
function onMicTap(): void {
  if (state.value === 'listening') {
    void finish();
  } else if (state.value === 'error') {
    retry();
  }
}

/** A second try: the ear is opened again from the failure. */
function retry(): void {
  void begin();
}

/** Puts a failure on the screen with a headline of its own. */
function fail(message: string, title: string): void {
  state.value = 'error';
  error.value = message;
  errorTitle.value = title;
  stopSampler();
  restWave();
}

/** Throws the words away. */
function close(): void {
  live = false;
  stopSampler();
  if (hold !== undefined) {
    clearTimeout(hold);
    hold = undefined;
  }
  haltRings();
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

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

/** The rings only turn while the ear is open. */
watch(state, (value) => {
  if (value === 'listening') {
    startRings();
  } else {
    haltRings();
  }
});

onMounted(() => {
  nextTick(() => enter(rootRef.value?.nativeView));
  void begin();
});

onUnmounted(() => {
  live = false;
  stopSampler();
  if (hold !== undefined) {
    clearTimeout(hold);
    hold = undefined;
  }
  haltRings();
  recorder?.cancel();
  recorder = null;
});
</script>

<template>
  <GridLayout ref="rootRef" class="vs-root" rows="auto, *, auto">
    <!-- The search bar of Material 3 - the words of the query land here. -->
    <GridLayout row="0" columns="auto, *, auto" rows="*" class="vs-bar">
      <Icon
        col="0"
        :name="state === 'listening' || state === 'transcribing' ? 'microphone' : 'search'"
        :size="18"
        :tone="state === 'listening' ? 'primary' : 'on-surface-variant'"
        class="vs-bar-icon"
      />
      <Label col="1" :text="barText" class="vs-bar-text" :class="{ 'vs-bar-text--hint': barIsHint }" />
      <GridLayout col="2" columns="*" rows="*" class="vs-close" v-press @tap="close">
        <Icon col="0" name="close" :size="20" tone="on-surface-variant" />
      </GridLayout>
    </GridLayout>

    <!-- The stage: the state, the waveform of the room, the microphone. -->
    <StackLayout row="1" class="vs-stage">
      <Label :text="headline" class="vs-headline" textWrap="true" horizontal-align="center" />

      <StackLayout orientation="horizontal" class="vs-wave">
        <Label
          v-for="(level, index) in levels"
          :key="index"
          class="vs-wave-bar"
          :class="{ 'vs-wave-bar--last': index === levels.length - 1 }"
          :style="{ height: barHeight(index), opacity: barFade(index) }"
        />
      </StackLayout>

      <GridLayout columns="auto" rows="auto" class="vs-mic-stage">
        <!--
          The ripple around the button: hidden as a box, so a stopped loop can
          never leave it standing. The box is bigger than the ring at its full
          size (96 x 1.6 = 154), because Android clips a child to the bounds of
          its parent - a smaller box would cut the growing ring into a square.
        -->
        <GridLayout
          col="0"
          columns="*"
          rows="*"
          class="vs-rings"
          :class="{ 'vs-rings--live': state === 'listening' }"
        >
          <Label ref="ringARef" col="0" class="vs-ring" />
          <Label ref="ringBRef" col="0" class="vs-ring" />
        </GridLayout>
        <!--
          `columns="*"` and `rows="*"` are what centre the glyph: an `auto`
          track hugs the icon, so the leftover space of the button stays
          unassigned and the glyph lands in its top left corner.
        -->
        <GridLayout
          col="0"
          columns="*"
          rows="*"
          class="vs-mic"
          :class="micClass"
          v-press
          @tap="onMicTap"
        >
          <Icon col="0" :name="micIcon" :size="36" :tone="micTone" />
        </GridLayout>
      </GridLayout>

      <ActivityIndicator v-if="state === 'transcribing'" :busy="true" class="vs-progress" />
      <Label
        v-if="support"
        :text="support"
        class="vs-support"
        textWrap="true"
        horizontal-align="center"
      />
      <Label
        v-if="state === 'error'"
        :text="error"
        class="vs-error"
        textWrap="true"
        horizontal-align="center"
      />
    </StackLayout>

    <!-- The way out: the keyboard is one tap away, and a failure offers a second try. -->
    <StackLayout row="2" orientation="horizontal" class="vs-actions">
      <Label
        v-if="state === 'error'"
        text="TRY AGAIN"
        class="vs-action"
        v-press
        @tap="retry"
      />
      <Label
        :text="state === 'error' ? 'CANCEL' : 'TYPE INSTEAD'"
        class="vs-action vs-action--quiet"
        v-press
        @tap="close"
      />
    </StackLayout>
  </GridLayout>
</template>

<style scoped>
.vs-root {
  background-color: var(--md-surface);
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* ---------- The search bar ---------- */
.vs-bar {
  background-color: var(--md-surface-container-highest);
  border-radius: 28;
  height: 56;
  padding: 0 8 0 16;
  margin: 14 16 0 16;
}

/* The slot of the icon is kept with margins - see `AttachSheet.vue`. */
.vs-bar-icon {
  margin-right: 12;
  vertical-align: center;
}

.vs-bar-text {
  color: var(--md-on-surface);
  font-size: 16;
  vertical-align: center;
}

/* Until there are words the bar carries the hint of the search. */
.vs-bar-text--hint {
  color: var(--md-on-surface-variant);
}

.vs-close {
  width: 40;
  height: 40;
  vertical-align: center;
  horizontal-align: center;
}

/* ---------- The stage ---------- */
.vs-stage {
  vertical-align: center;
  padding: 0 8;
}

/*
  Every grid of this screen carries an explicit `rows`, even the one-line
  ones: without it the single implicit row behaves like a `*` row and takes
  the whole height it is offered, so the button under it was centred in the
  rest of the screen instead of sitting where the stage put it.
*/
.vs-headline {
  color: var(--md-on-surface);
  font-size: 22;
  font-weight: 500;
  text-align: center;
  horizontal-align: center;
  margin-top: 28;
}

/*
  The waveform: a fixed box, so a bar that grows to its full height never
  moves the microphone under it. The bars themselves are centred in it and
  sized from code - one height per sample.
*/
.vs-wave {
  height: 60;
  margin-top: 24;
  horizontal-align: center;
}

.vs-wave-bar {
  width: 3;
  margin-right: 5;
  border-radius: 1.5;
  background-color: var(--md-primary);
  vertical-align: center;
}

/* The last bar has no neighbour to the right, so it carries no gap either. */
.vs-wave-bar--last {
  margin-right: 0;
}

/* ---------- The microphone ---------- */
/*
  The stage grew to the size of the ripple, so its own margin shrank by the
  same amount: the button keeps the place it had when the box was as small as
  the ring at rest.
*/
.vs-mic-stage {
  margin-top: 4;
  horizontal-align: center;
}

/*
  The box around the rings carries their visibility, not the rings
  themselves: an animation writes the opacity it ends on straight onto the
  view, so a loop stopped in the middle of a cycle would leave a ring
  standing. The box has no animation on it, and its class is the truth.

  It is wider than the ring at its full size (96 x 1.6 = 154), because
  Android clips a child to the bounds of its parent - a box the size of the
  ring at rest would cut the growing ring into a square.
*/
.vs-rings {
  width: 156;
  height: 156;
  opacity: 0;
}

.vs-rings--live {
  opacity: 1;
}

.vs-ring {
  width: 96;
  height: 96;
  border-radius: 48;
  background-color: var(--md-primary);
  vertical-align: center;
  horizontal-align: center;
}

.vs-mic {
  width: 96;
  height: 96;
  border-radius: 48;
  background-color: var(--md-surface-container-highest);
  vertical-align: center;
  horizontal-align: center;
}

/* Open ear and searching: the button carries the colour of the scheme. */
.vs-mic--live {
  background-color: var(--md-primary);
}

.vs-mic--busy {
  background-color: var(--md-secondary-container);
}

.vs-mic--error {
  background-color: var(--md-error-container);
}

/* ---------- The lines under the button ---------- */
.vs-progress {
  color: var(--md-primary);
  margin-top: 22;
}

.vs-support {
  color: var(--md-on-surface-variant);
  font-size: 14;
  text-align: center;
  horizontal-align: center;
  margin-top: 2;
  padding: 0 16;
}

.vs-error {
  color: var(--md-on-error-container);
  background-color: var(--md-error-container);
  font-size: 13;
  text-align: center;
  border-radius: 16;
  padding: 12 16;
  margin-top: 20;
  horizontal-align: center;
}

/* ---------- The actions ---------- */
.vs-actions {
  horizontal-align: center;
  padding: 0 24 34 24;
}

.vs-action {
  color: var(--md-primary);
  font-size: 14;
  font-weight: 700;
  letter-spacing: 0.08;
  padding: 12 18;
}

/* The way out of the screen is offered, not asked for. */
.vs-action--quiet {
  color: var(--md-on-surface-variant);
}
</style>
