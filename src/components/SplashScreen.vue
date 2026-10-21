<script lang="ts" setup>
/**
 * The launch sequence.
 *
 * The screen is built as a set of planes at different depths, and each plane
 * moves at its own rate. That is the whole idea: the aurora drifts far in
 * the background, the orbits turn at their own pace, and the mark floats
 * closest to the eye. Because nothing moves in lockstep, the composition
 * reads as depth rather than as a set of decorations.
 *
 *   far      the ink field and the two aurora blobs
 *   middle   the two orbit rings, each turning at its own speed
 *   near     the mark, its glow and the beam pulsing through it
 *   closest  the wordmark and the live state of the gateway
 *
 * The planes lean with the phone: they are moved by the tilt of the device
 * (see src/utils/tilt.ts), and the far plane leans against the movement
 * while the near plane follows it, so the depth of the scene is read as
 * depth. Every plane also drifts on its own, which keeps the scene alive
 * when the phone lies still on a table.
 *
 * The entrance walks the planes in from the back, one long beat at a time,
 * and the exit is a two stage crossfade: the ink dissolves into the paper
 * colour the app uses, and only then does the paper dissolve into the chat
 * screen. Nothing of the app shows through the ink, so there is never a
 * moment where text sits on top of text.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { omniAi, type ConnectionStatus } from '../services/omni-ai';
import { useThemeStore } from '../stores/theme';
import { loopAnimation } from '../utils/motion';
import { Parallax } from '../utils/parallax';
import { paintStatusBar } from '../utils/status-bar';
import { themeToken } from '../utils/theme';

/** Fires once the splash has finished animating away. */
const emit = defineEmits(['done']);

/** The theme the app is in - the splash hands over to it. */
const theme = useThemeStore();

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */
/**
 * The ink of the launch sequence.
 *
 * The splash is a dark moment in both themes - the mark is drawn on ink, not
 * on the canvas of the app. The paper underneath it is the canvas of the
 * current theme, so the app fades in on exactly the colour it uses.
 */
const INK = '#0B0E17';

/**
 * How long the splash stays on screen once the native views are up.
 * The entrance takes ~4.3s, so the mark gets a long moment to breathe
 * before it leaves.
 */
const HOLD_MS = 3900;

/** How long the whole exit takes. */
const EXIT_MS = 1500;

/**
 * Safety net: if the native `loaded` event never arrives the splash must
 * still get out of the way.
 */
const MAX_LIFE_MS = 9000;

const rootRef = ref(null);
const inkRef = ref(null);
const paperRef = ref(null);
const farRef = ref(null);
const midRef = ref(null);
const nearRef = ref(null);
const copyPlaneRef = ref(null);
const auroraARef = ref(null);
const auroraBRef = ref(null);
const orbitOuterRef = ref(null);
const orbitInnerRef = ref(null);
const heroRef = ref(null);
const markBoxRef = ref(null);
const glowRef = ref(null);
const beamRef = ref(null);
const copyRef = ref(null);

const status = ref<ConnectionStatus>('connecting');
const modelCount = ref(0);
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let exitTimer: ReturnType<typeof setTimeout> | undefined;
let safetyTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;

/** The scene of planes that lean with the phone. */
let parallax: Parallax | undefined;
/** The loops of the scene that never end on their own. */
let stopLoops: Array<() => void> = [];

/** "ONE GATEWAY · EVERY MODEL" plus the live model count. */
const eyebrow = computed(() =>
  modelCount.value ? `${modelCount.value} MODELS · ONE GATEWAY` : 'ONE GATEWAY · EVERY MODEL',
);

const statusText = computed(() => {
  switch (status.value) {
    case 'connected':
      return 'gateway live';
    case 'error':
    case 'disconnected':
      return 'gateway unreachable';
    default:
      return 'connecting to gateway…';
  }
});

const statusClass = computed(() => `splash-status-dot--${status.value}`);

onMounted(async () => {
  buildScene();

  // If the native view is already up (a fast warm start) the `loaded` event
  // has been and gone, so start the sequence by hand.
  if (rootRef.value?.nativeView?.isLoaded) {
    onStageLoaded();
  }

  unsubscribe = omniAi.onStatus((next) => {
    status.value = next;
  });

  // Warm the model list while the mark is still on screen, so the chat
  // screen opens with its picker ready to use.
  try {
    const models = await omniAi.loadModels();
    modelCount.value = models.length;
  } catch (err) {
    // The chat screen surfaces connection problems itself; the splash only
    // needs to know that the gateway is not reachable.
    console.error('Splash could not reach the Omni Ai gateway:', err);
  }
});

onUnmounted(() => {
  clearTimeout(holdTimer);
  clearTimeout(exitTimer);
  clearTimeout(safetyTimer);
  unsubscribe?.();
  stopScene();
  applyStatusBar(false);
});

/**
 * The planes of the composition.
 *
 * Every plane has a depth: how far it travels when the phone is leaned over
 * to the limit. The far plane leans against the movement and the near plane
 * follows it, which is what turns a flat composition into a window on
 * something with a front and a back.
 */
function buildScene() {
  parallax = new Parallax([
    // The far light: the deepest plane. It drifts the slowest of anything
    // on the screen, and it leans against the tilt of the phone.
    {
      view: farRef.value?.nativeView,
      depth: 16,
      direction: -1,
      drift: { x: 46, y: 34, period: 96000, phase: 0.4 },
    },
    // The orbits, in the middle of the scene.
    {
      view: midRef.value?.nativeView,
      depth: 30,
      direction: -1,
      drift: { x: 0, y: 8, period: 44000, phase: 1.1 },
    },
    // The mark: the closest plane of the picture, so it follows the hand
    // the most.
    {
      view: nearRef.value?.nativeView,
      depth: 46,
      direction: 1,
    },
    // The wordmark sits with the mark.
    {
      view: copyPlaneRef.value?.nativeView,
      depth: 20,
      direction: 1,
    },
    // The mark floats inside its plane.
    {
      view: markBoxRef.value?.nativeView,
      depth: 0,
      drift: { x: 0, y: 8, period: 13000, phase: -Math.PI / 2 },
    },
    // The two orbits turn at their own speed.
    { view: orbitOuterRef.value?.nativeView, depth: 0, spin: 360 / 44 },
    { view: orbitInnerRef.value?.nativeView, depth: 0, spin: 360 / 30 },
  ]);
}

/** Starts the scene and the loops of the scene. */
function startScene() {
  parallax?.start();

  // The glow around the mark breathes.
  stopLoops.push(
    loopAnimation(glowRef.value?.nativeView, [
      { properties: { opacity: 0.42, scale: { x: 0.9, y: 0.9 } }, duration: 4500 },
      { properties: { opacity: 0.82, scale: { x: 1.06, y: 1.06 } }, duration: 4500 },
    ]),
  );

  // The beam pulses through the mark.
  stopLoops.push(
    loopAnimation(beamRef.value?.nativeView, [
      { properties: { opacity: 0.55 }, duration: 3000 },
      { properties: { opacity: 1 }, duration: 3000 },
    ]),
  );
}

/** Stops the scene. */
function stopScene() {
  parallax?.stop();
  stopLoops.forEach((stop) => stop());
  stopLoops = [];
}

/**
 * The native views are up: this is the real "frame zero" of the sequence.
 * The timeline is anchored here rather than in the Vue mount - on a slow
 * device those are seconds apart.
 */
function onStageLoaded() {
  // The activity theme has been swapped by now, so this is the first moment
  // the status bar can be painted to match the splash.
  applyStatusBar(true);
  startEntrance();
  startScene();

  clearTimeout(safetyTimer);
  safetyTimer = setTimeout(leave, MAX_LIFE_MS);
  holdTimer = setTimeout(leave, HOLD_MS);
}

/**
 * The entrance.
 *
 * The planes arrive from the back, one at a time, each with a long fade:
 * the field, the aurora, the orbits, the mark, and last the wordmark.
 *
 * These beats are driven through the NativeScript animation API rather than
 * CSS keyframes: the CSS `animation-delay` is not reliable on Android (a
 * delayed keyframe animation can be restarted before its delay elapses and
 * therefore never start), and the API lets the whole sequence be timed from
 * one place. The endless ambience is driven from code as well, for the same
 * reason - a keyframe animation in a scoped style block does not run.
 */
function startEntrance() {
  const view = (ref: { value: unknown }) =>
    (ref.value as { nativeView?: any } | null)?.nativeView;

  // The ground.
  view(inkRef)?.animate({ opacity: 1, duration: 1200, curve: 'easeOut' });

  // The far light.
  view(auroraARef)?.animate({ opacity: 0.55, duration: 1900, delay: 250, curve: 'easeOut' });
  view(auroraBRef)?.animate({ opacity: 0.45, duration: 1900, delay: 450, curve: 'easeOut' });

  // The orbits, each turning at its own speed.
  view(orbitOuterRef)?.animate({ opacity: 1, duration: 1600, delay: 900, curve: 'easeOut' });
  view(orbitInnerRef)?.animate({ opacity: 1, duration: 1600, delay: 1150, curve: 'easeOut' });

  // The mark: out of the glow, into place.
  view(heroRef)?.animate({
    opacity: 1,
    scale: { x: 1, y: 1 },
    duration: 2000,
    delay: 1400,
    curve: 'easeOut',
  });

  // The wordmark and the state of the gateway.
  view(copyRef)?.animate({
    opacity: 1,
    translate: { x: 0, y: 0 },
    duration: 1600,
    delay: 2700,
    curve: 'easeOut',
  });
}

/**
 * The exit: the mark and the copy dissolve first, then the ink field turns
 * into paper, and only then does the paper dissolve into the chat screen.
 */
function leave() {
  if (exitTimer) {
    return;
  }

  // The scene holds still while it goes.
  stopScene();

  const view = (ref: { value: unknown }) =>
    (ref.value as { nativeView?: any } | null)?.nativeView;

  view(heroRef)?.animate({
    opacity: 0,
    scale: { x: 1.14, y: 1.14 },
    duration: 700,
    curve: 'easeIn',
  });
  view(copyRef)?.animate({
    opacity: 0,
    translate: { x: 0, y: -14 },
    duration: 600,
    curve: 'easeIn',
  });
  view(inkRef)?.animate({ opacity: 0, duration: 700, curve: 'easeIn' });
  // The paper is the canvas of the current theme, so the app dissolves into
  // exactly the colour it uses.
  view(paperRef)?.animate({
    opacity: 0,
    duration: 900,
    delay: 500,
    curve: 'easeIn',
  });

  exitTimer = setTimeout(() => {
    applyStatusBar(false);
    emit('done');
  }, EXIT_MS);
}

/**
 * Paints the system status bar to match whatever is on screen.
 *
 * While the splash is up the bar sits on ink, so its icons are light. Once
 * the app is there the bar sits on the app bar of the chat screen, which
 * carries the surface of the current theme.
 */
function applyStatusBar(onInk: boolean) {
  const surface = themeToken('--app-surface', '#FFFFFF');
  const dark = onInk || theme.isDark;
  paintStatusBar(onInk ? INK : surface, dark);
}
</script>

<template>
  <GridLayout ref="rootRef" rows="*" class="splash-root" @loaded="onStageLoaded">
    <!-- The paper the app fades in from. Sits under everything. -->
    <Label ref="paperRef" row="0" col="0" text="" class="splash-paper" />

    <!-- The ink field: the far light, the orbits and the mark. -->
    <GridLayout ref="inkRef" row="0" col="0" rows="*, auto" class="splash-ink">
      <GridLayout row="0" col="0" class="splash-stage">
        <!-- The far light: the deepest plane of the picture. -->
        <GridLayout ref="farRef" row="0" col="0" class="splash-plane">
          <Image
            ref="auroraARef"
            row="0"
            col="0"
            src="~/assets/img/aurora-a.png"
            class="splash-aurora splash-aurora--a"
          />
          <Image
            ref="auroraBRef"
            row="0"
            col="0"
            src="~/assets/img/aurora-b.png"
            class="splash-aurora splash-aurora--b"
          />
        </GridLayout>

        <!-- Two routes orbiting the gateway. -->
        <GridLayout ref="midRef" row="0" col="0" class="splash-plane">
          <GridLayout ref="orbitOuterRef" row="0" col="0" class="splash-orbit splash-orbit--outer">
            <Label row="0" col="0" text="" class="splash-ring" />
            <Label row="0" col="0" text="" class="splash-satellite splash-satellite--a" />
          </GridLayout>
          <GridLayout ref="orbitInnerRef" row="0" col="0" class="splash-orbit splash-orbit--inner">
            <Label row="0" col="0" text="" class="splash-ring splash-ring--inner" />
            <Label row="0" col="0" text="" class="splash-satellite splash-satellite--b" />
          </GridLayout>
        </GridLayout>

        <!-- The mark: the closest plane of the picture. -->
        <GridLayout ref="nearRef" row="0" col="0" class="splash-plane">
          <GridLayout ref="heroRef" row="0" col="0" class="splash-hero">
            <Image ref="glowRef" row="0" col="0" src="~/assets/img/prism-glow.png" class="splash-glow" />
            <GridLayout ref="markBoxRef" row="0" col="0" class="splash-mark-box">
              <Image row="0" col="0" src="~/assets/img/prism.png" class="splash-mark" />
              <Image ref="beamRef" row="0" col="0" src="~/assets/img/prism-beam.png" class="splash-beam" />
            </GridLayout>
          </GridLayout>
        </GridLayout>
      </GridLayout>

      <!-- The wordmark. -->
      <GridLayout ref="copyPlaneRef" row="1" col="0" class="splash-plane">
        <StackLayout ref="copyRef" row="0" col="0" class="splash-copy">
          <Label row="0" col="0" text="Omni Ai" class="splash-wordmark" />
          <Label row="1" col="0" :text="eyebrow" class="splash-eyebrow" />
          <GridLayout row="2" col="0" columns="auto, auto" class="splash-status">
            <Label col="0" row="0" text="●" class="splash-status-dot" :class="statusClass" />
            <Label col="1" row="0" :text="statusText" class="splash-status-text" />
          </GridLayout>
        </StackLayout>
      </GridLayout>
    </GridLayout>
  </GridLayout>
</template>

<style scoped>
/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */
.splash-root {
  background-color: transparent;
  horizontal-align: stretch;
  vertical-align: stretch;
}

.splash-paper {
  background-color: var(--app-canvas);
  horizontal-align: stretch;
  vertical-align: stretch;
}

.splash-ink {
  background-image: linear-gradient(160deg, #0e1224 0%, #0a0d18 52%, #080a12 100%);
  horizontal-align: stretch;
  vertical-align: stretch;
  opacity: 0;
}

.splash-stage {
  horizontal-align: stretch;
  vertical-align: stretch;
}

/*
  A plane of the composition. The plane is what leans with the phone, so it
  carries no transform of its own - the movement is written onto it frame by
  frame (see src/utils/parallax.ts).
*/
.splash-plane {
  horizontal-align: stretch;
  vertical-align: stretch;
}

/* ---------- The far light ---------- */
.splash-aurora {
  width: 720;
  height: 720;
  opacity: 0;
}

.splash-aurora--a {
  horizontal-align: left;
  vertical-align: top;
  margin-left: -230;
  margin-top: -170;
}

.splash-aurora--b {
  horizontal-align: right;
  vertical-align: bottom;
  margin-right: -250;
  margin-bottom: -210;
}

/* ---------- Orbits ---------- */
.splash-orbit {
  horizontal-align: center;
  vertical-align: middle;
  margin-bottom: 26;
  opacity: 0;
}

.splash-orbit--outer {
  width: 262;
  height: 262;
}

.splash-orbit--inner {
  width: 196;
  height: 196;
}

.splash-ring {
  width: 258;
  height: 258;
  border-radius: 129;
  border-width: 1;
  border-color: rgba(255, 255, 255, 0.11);
  horizontal-align: center;
  vertical-align: middle;
}

.splash-ring--inner {
  width: 192;
  height: 192;
  border-radius: 96;
  border-color: rgba(255, 255, 255, 0.08);
}

.splash-satellite {
  width: 7;
  height: 7;
  border-radius: 4;
  background-color: #ffffff;
  horizontal-align: center;
  vertical-align: top;
  margin-top: -3;
}

.splash-satellite--a {
  opacity: 0.85;
}

.splash-satellite--b {
  opacity: 0.6;
  width: 5;
  height: 5;
  border-radius: 3;
  margin-top: -2;
}

/* ---------- The mark ---------- */
.splash-hero {
  width: 300;
  height: 300;
  horizontal-align: center;
  vertical-align: middle;
  margin-bottom: 26;
  opacity: 0;
  transform: scale(0.62);
}

.splash-glow {
  width: 300;
  height: 300;
  horizontal-align: center;
  vertical-align: middle;
  opacity: 0.42;
  transform: scale(0.9);
}

.splash-mark-box {
  width: 150;
  height: 150;
  horizontal-align: center;
  vertical-align: middle;
}

.splash-mark {
  width: 150;
  height: 150;
  horizontal-align: center;
  vertical-align: middle;
}

.splash-beam {
  width: 150;
  height: 150;
  horizontal-align: center;
  vertical-align: middle;
  opacity: 0.55;
}

/* ---------- Copy ---------- */
.splash-copy {
  horizontal-align: center;
  padding: 0 28 68 28;
  opacity: 0;
  transform: translate(0, 18);
}

.splash-wordmark {
  color: #ffffff;
  font-size: 31;
  font-weight: 700;
  letter-spacing: 0.02;
  text-align: center;
  horizontal-align: center;
}

.splash-eyebrow {
  color: #7d87a3;
  font-family: monospace;
  font-size: 10;
  letter-spacing: 0.26;
  text-align: center;
  horizontal-align: center;
  margin-top: 9;
}

.splash-status {
  horizontal-align: center;
  margin-top: 20;
}

.splash-status-dot {
  font-size: 8;
  width: 16;
  vertical-align: center;
  color: #6f7893;
}

.splash-status-dot--connected {
  color: #2fd48f;
}

.splash-status-dot--error,
.splash-status-dot--disconnected {
  color: #f26d6d;
}

.splash-status-text {
  color: #c3cade;
  font-family: monospace;
  font-size: 11;
  letter-spacing: 0.08;
  vertical-align: center;
}
</style>
