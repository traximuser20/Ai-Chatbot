<script lang="ts" setup>
/**
 * The orb of the voice mode.
 *
 * A sphere of light that is always turning: two circular layers, each carrying
 * a gradient, spin in opposite directions at their own rate. Because the shape
 * is a circle the silhouette never changes - only the light inside it, which
 * is what reads as a sphere of moving liquid rather than a rotating disc. A
 * third, slower layer carries the bright specular and makes one more turn per
 * revolution than the body, so the highlight appears to orbit.
 *
 * The colours are not its own: they come from the palette of the active route
 * (see `src/stores/palette.ts`), so the orb glows in the colour of the
 * provider that is answering - the same rule every other surface follows.
 *
 * The pace follows the state: quick and open while listening, quick and tight
 * while thinking, a slow rolling while speaking, and a long calm turn at rest.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { tint } from '../utils/accent';
import type { View } from '@nativescript/core';
import { usePaletteStore } from '../stores/palette';

/** What the voice is doing - it decides the pace and the size. */
export type VoiceOrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

const props = withDefaults(
  defineProps<{
    /** The pace of the orb. */
    state?: VoiceOrbState;
    /** The width and height of the orb, in dip. */
    size?: number;
  }>(),
  { state: 'idle', size: 168 },
);

const palette = usePaletteStore();

/**
 * The corner that turns each layer into a circle.
 *
 * A percentage (`50%`) is not used: on a gradient drawable the platform does
 * not resolve it against the view, and the layers come out as rounded
 * squares. A plain number is a length in dip, and half the size is exactly
 * what a circle needs - so the radius follows the `size` prop.
 */
const circle = computed(() => props.size / 2);

/* ------------------------------------------------------------------ */
/* The three layers of the sphere                                      */
/* ------------------------------------------------------------------ */

/**
 * The body: the route colour turning into a deeper shade of itself and back,
 * which is what the eye reads as the far side of the sphere rolling over.
 */
const bodyGradient = computed(() => {
  const { primary, tertiary } = palette.scheme;
  const deep = tint(primary, 0);
  return `linear-gradient(135deg, ${tint(tertiary, 0.45)} 0%, ${primary} 38%, ${deep} 72%, ${tint(primary, 0.28)} 100%)`;
});

/**
 * The lit face: pulled towards white, and only two stops, so it sweeps from a
 * bright patch to the body colour. It sits on top of the body at a low
 * opacity - the two rotating at different rates is what makes the interior
 * look liquid.
 */
const lightGradient = computed(() => {
  const { primary } = palette.scheme;
  return `linear-gradient(315deg, ${tint(primary, 0.9)} 0%, ${tint(primary, 0.5)} 44%, ${tint(primary, 0.08)} 100%)`;
});

/** The specular: a near-white spot that orbits the sphere. */
const specGradient = computed(() => {
  const { primary } = palette.scheme;
  return `linear-gradient(325deg, ${tint(primary, 0.97)} 0%, ${tint(primary, 0.88)} 34%, ${tint(primary, 0.6)} 100%)`;
});

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

const bodyRef = ref<View | null>(null);
const lightRef = ref<View | null>(null);
const specRef = ref<View | null>(null);

/**
 * `false` while the orb is off screen or going away. Every chain checks it,
 * so an animation that has not been awaited yet cannot start another one
 * behind a closed sheet - which would spin a hidden view until the app dies.
 */
let live = false;

/**
 * Spins one layer for ever, one turn at a time.
 *
 * A single ever-growing angle is used instead of a ping-pong: the renderer
 * wraps it, so the layer turns without ever jumping back, and the rotation is
 * resolved per turn. The promise is awaited, so the next turn is only queued
 * once this one has really finished - an animation on a view that is not on
 * screen resolves at once, and that would otherwise spin the thread flat.
 */
async function turn(view: View | null, msPerTurn: number): Promise<void> {
  if (!view) return;
  let angle = Number(view.rotate || 0);
  while (live) {
    angle += 360;
    try {
      await view.animate({ rotate: angle, duration: msPerTurn, curve: 'linear' });
    } catch {
      return;
    }
    if (!live) return;
    // A turn that resolved far faster than it should have means the view is
    // not on screen - stop, rather than queue the next one immediately.
    if (msPerTurn > 250) {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
    if (!live) return;
  }
}

/** The pace of a full turn, in milliseconds, for each layer and each state. */
const pace = computed<Record<VoiceOrbState, [number, number, number]>>(() => {
  switch (props.state) {
    case 'listening':
      return [3600, 4800, 6000];
    case 'thinking':
      return [2600, 3600, 4600];
    case 'speaking':
      return [7000, 9200, 11000];
    default:
      return [10000, 13000, 16000];
  }
});

/**
 * The scale of each layer at rest. The body opens up while listening, and all
 * of them pull in while thinking, so the orb breathes with the state without a
 * pulse running - a rolling sphere, not a blinking lamp.
 */
const scale = computed<Record<VoiceOrbState, number>>(() => {
  switch (props.state) {
    case 'listening':
      return 1.06;
    case 'thinking':
      return 0.88;
    case 'speaking':
      return 1;
    default:
      return 0.96;
  }
});

/** The brightness of the lit face and of the specular, per state. */
const glow = computed<Record<VoiceOrbState, { light: number; spec: number }>>(() => {
  switch (props.state) {
    case 'listening':
      return { light: 0.6, spec: 0.55 };
    case 'thinking':
      return { light: 0.34, spec: 0.3 };
    case 'speaking':
      return { light: 0.52, spec: 0.46 };
    default:
      return { light: 0.42, spec: 0.38 };
  }
});

/**
 * Applies the pace and the size of the current state, and starts the layers
 * turning. Called once the views are on screen, and again on every change.
 */
function apply(): void {
  const [body, light, spec] = pace.value;
  const s = scale.value;

  bodyRef.value?.animate({ scale: { x: s, y: s } }, { duration: 600, curve: 'easeInOut' });
  lightRef.value?.animate({ scale: { x: s * 0.97, y: s * 0.97 } }, { duration: 600, curve: 'easeInOut' });
  specRef.value?.animate({ scale: { x: s * 0.9, y: s * 0.9 } }, { duration: 600, curve: 'easeInOut' });
  lightRef.value?.animate({ opacity: glow.value.light }, { duration: 600, curve: 'easeInOut' });
  specRef.value?.animate({ opacity: glow.value.spec }, { duration: 600, curve: 'easeInOut' });

  // Two extra turns on the specular, so it sweeps over the body once and a
  // half per turn of the sphere and the light appears to orbit.
  void turn(bodyRef.value, body);
  void turn(lightRef.value, light);
  void turn(specRef.value, spec / 1.5);
}

let pending: number | undefined;

/** (Re)starts the motion once the layers are on screen. */
function start(): void {
  live = false;
  if (pending !== undefined) {
    clearTimeout(pending);
  }
  // One tick, so the chains that are still in flight see `live = false`.
  pending = setTimeout(() => {
    pending = undefined;
    if (!bodyRef.value || !bodyRef.value.isLoaded) return;
    live = true;
    // The pivot is the centre, or the sphere swings out of its box.
    for (const view of [bodyRef.value, lightRef.value, specRef.value]) {
      if (view) {
        view.originX = 0.5;
        view.originY = 0.5;
      }
    }
    apply();
  }, 40) as unknown as number;
}

onMounted(start);
watch(() => props.state, start);

/** Stops every chain the moment the orb goes away. */
function stopAll(): void {
  live = false;
  if (pending !== undefined) {
    clearTimeout(pending);
    pending = undefined;
  }
}

onUnmounted(stopAll);

defineExpose({ stop: stopAll });
</script>

<template>
  <GridLayout :width="size" :height="size" rows="*" columns="*">
    <!-- The body of the sphere: the route colour turning over on itself. -->
    <ContentView
      row="0"
      col="0"
      ref="bodyRef"
      class="layer layer-body"
      :style="{ backgroundImage: bodyGradient, borderRadius: circle }"
    />

    <!-- The lit face, turning the other way at its own rate. -->
    <ContentView
      row="0"
      col="0"
      ref="lightRef"
      class="layer layer-light"
      :style="{ backgroundImage: lightGradient, borderRadius: circle }"
    />

    <!-- The specular: a near-white spot orbiting the sphere. -->
    <ContentView
      row="0"
      col="0"
      ref="specRef"
      class="layer layer-spec"
      :style="{ backgroundImage: specGradient, borderRadius: circle }"
    />
  </GridLayout>
</template>

<style scoped>
/* Every layer fills its cell; the circle comes from the bound radius. */
.layer {
  width: 100%;
  height: 100%;
}

/* A soft wash of the route colour, so the orb lights the surface it sits on. */
.layer-body {
  opacity: 0.4;
}
</style>
