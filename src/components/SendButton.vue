<script lang="ts" setup>
/**
 * The send button of the composer.
 *
 * A Material 3 filled icon button: a round container in the primary colour of
 * the scheme, the glyph of the primary role on it, and a **state layer** that
 * fades in while the button is held. The state layer is the tactile feedback
 * of Material 3 - the control keeps its shape, and a veil of the colour of
 * the glyph is drawn over it.
 *
 * The button has three states:
 *   - `idle`  - there is nothing to send, so the button is dimmed.
 *   - `ready` - there is something to send, so the button is filled.
 *   - `busy`  - an answer is on its way, so the button stops it.
 *
 * Every colour is a **role** of the scheme, so the button follows the theme
 * and the route that is on screen.
 */
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { TouchAction } from '@nativescript/core/ui/gestures';
import { animate, CURVE, DURATION, loopAnimation } from '../utils/motion';
import { usePaletteStore } from '../stores/palette';
import Icon from './Icon.vue';

/** The three states of the button. */
export type SendState = 'idle' | 'ready' | 'busy';

const props = defineProps<{
  state: SendState;
}>();

const emit = defineEmits<{
  press: [];
}>();

const buttonRef = ref<any>(null);
const layerRef = ref<any>(null);
const glyphRef = ref<any>(null);

const palette = usePaletteStore();

/**
 * The gradient of the pinned accent - only while the button is filled.
 *
 * A gradient accent is not only a seed: the button wears the gradient itself,
 * so the choice made in the settings is visible on the surface a reader
 * touches most. When no accent is pinned this is null, the binding falls
 * away, and the painted rule (`var(--md-primary)`) takes over.
 */
const fillGradient = computed(() =>
  props.state === 'ready' ? palette.accentGradient : null,
);

/** The opacity of the state layer while the button is held. */
const LAYER_OPACITY = 0.12;

/** True while the button is held down. */
let held = false;

/**
 * The state layer.
 *
 * It fades in while the button is held and fades out when it is released.
 * The touch handler always returns `false`, so the tap still reaches the
 * button.
 *
 * The action of a touch event is one of the strings of `TouchAction`
 * (`down`, `up`, `move`, `cancel`) - not the integer of the motion event of
 * Android.
 */
function onTouch(args: any): boolean {
  const action = args?.action;
  const layer = layerRef.value?.nativeView;
  if (!layer) {
    return false;
  }

  if (action === TouchAction.down) {
    held = true;
    animate(
      layer,
      { opacity: LAYER_OPACITY },
      { duration: DURATION.instant, curve: CURVE.out },
    );
  } else if (action === TouchAction.up || action === TouchAction.cancel) {
    held = false;
    animate(layer, { opacity: 0 }, { duration: DURATION.fast, curve: CURVE.out });
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* The motion of the waiting state                                     */
/* ------------------------------------------------------------------ */

/** The loop of the glyph while the answer is on its way. */
let stopThrob: (() => void) | undefined;

/** The glyph breathes while the button stops the answer. */
function startThrob() {
  stopThrob?.();
  stopThrob = loopAnimation(glyphRef.value?.nativeView, [
    { properties: { scale: { x: 0.88, y: 0.88 } }, duration: 700 },
    { properties: { scale: { x: 1, y: 1 } }, duration: 700 },
  ]);
}

/** Stops the loop of the glyph. */
function stopThrobLoop() {
  stopThrob?.();
  stopThrob = undefined;
}

watch(
  () => props.state,
  (state) => {
    // The layer belongs to the touch that is happening, never to the state.
    held = false;
    animate(layerRef.value?.nativeView, { opacity: 0 }, { duration: DURATION.fast });

    if (state === 'busy') {
      startThrob();
    } else {
      stopThrobLoop();
    }
  },
);

onMounted(() => {
  if (props.state === 'busy') {
    startThrob();
  }

  /*
    The touch listener is attached to the native view by hand, the way the
    `v-press` directive does it: the `touch` event is a gesture, and only a
    listener that is registered on the native view turns the view into a
    gesture observer.
  */
  const button = buttonRef.value?.nativeView;
  if (button && typeof button.on === 'function') {
    button.on('touch', onTouch);
  }
});

onUnmounted(() => {
  stopThrobLoop();

  const button = buttonRef.value?.nativeView;
  if (button && typeof button.off === 'function') {
    button.off('touch', onTouch);
  }
});
</script>

<template>
  <!--
    `columns="*"` and `rows="*"`, on the button and on the glyph box alike:
    an `auto` track hugs the icon, so the leftover space of the 48dp circle
    stays unassigned and the glyph lands in its top left corner.
  -->
  <GridLayout
    ref="buttonRef"
    columns="*"
    rows="*"
    class="send-button"
    :class="`send-button--${state}`"
    :style="fillGradient ? { backgroundImage: fillGradient } : null"
    @tap="emit('press')"
  >
    <!--
      The state layer lies under the glyph. Both are in the same cell of the
      grid, so the grid draws the layer first and the glyph on top of it.
    -->
    <Label ref="layerRef" row="0" col="0" class="send-button-layer" />
    <GridLayout
      ref="glyphRef"
      row="0"
      col="0"
      columns="*"
      rows="*"
      class="send-button-glyph"
    >
      <Icon
        v-if="state !== 'busy'"
        name="arrow-up"
        :size="22"
        :tone="state === 'ready' ? 'on-primary' : 'outline'"
      />
      <Icon v-else name="stop" :size="20" tone="on-error" />
    </GridLayout>
  </GridLayout>
</template>

<style scoped>
/* The container of the button: a filled icon button of Material 3. */
.send-button {
  width: 48;
  height: 48;
  border-radius: 24;
  background-color: var(--md-surface-container-high);
  horizontal-align: right;
  vertical-align: center;
}

/* Ready: the button is filled with the primary colour of the scheme. */
.send-button--ready {
  background-color: var(--md-primary);
}

/* Busy: the button stops the answer, so it is painted with the error. */
.send-button--busy {
  background-color: var(--md-error);
}

/*
  The state layer - the veil that is drawn over the button while it is
  held. Its colour is the colour of the glyph that lies on it.
*/
.send-button-layer {
  width: 48;
  height: 48;
  border-radius: 24;
  background-color: var(--md-on-surface-variant);
  opacity: 0;
}

.send-button--ready .send-button-layer {
  background-color: var(--md-on-primary);
}

.send-button--busy .send-button-layer {
  background-color: var(--md-on-error);
}

/*
  The glyph. It is the size of the button, so its `*` track is the whole
  circle and the icon can be centred in it.
*/
.send-button-glyph {
  width: 48;
  height: 48;
  vertical-align: center;
}
</style>
