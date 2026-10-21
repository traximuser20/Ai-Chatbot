<script lang="ts" setup>
/**
 * A Material 3 switch.
 *
 * The native `Switch` of Android takes its colour from the theme of the
 * platform, so it cannot follow the palette of the route. This switch is
 * built from two views instead: the track and the thumb. The track carries
 * the container colour of the scheme and the thumb the primary one, so the
 * control belongs to the route that is on screen.
 *
 * The place of the thumb is a *property* of the view and not a rule of the
 * style sheet: NativeScript 9 drops `left` and `top` from a style sheet
 * without a word.
 */
import { onMounted, ref, watch } from 'vue';
import { animate, DURATION, CURVE } from '../utils/motion';

const props = defineProps<{
  checked: boolean;
}>();

const emit = defineEmits<{
  change: [value: boolean];
}>();

const thumbRef = ref<any>(null);

/** How far the thumb travels between the two states. */
const TRAVEL = 20;

/** Moves the thumb into the state the switch is in. */
function move(animated: boolean) {
  const thumb = thumbRef.value?.nativeView;
  if (!thumb) {
    return;
  }
  const to = props.checked ? TRAVEL : 0;
  if (!animated) {
    thumb.translateX = to;
    return;
  }
  animate(thumb, { translate: { x: to, y: 0 } }, { duration: DURATION.fast, curve: CURVE.out });
}

watch(() => props.checked, () => move(true));

// The thumb starts in the state the switch is in - there is nothing to
// animate when the screen appears.
onMounted(() => move(false));

function toggle() {
  emit('change', !props.checked);
}
</script>

<template>
  <AbsoluteLayout class="md-switch" @tap="toggle">
    <!-- The track. -->
    <Label class="md-switch-track" :class="{ 'md-switch-track--on': checked }" />
    <!-- The thumb. -->
    <Label
      ref="thumbRef"
      class="md-switch-thumb"
      :class="{ 'md-switch-thumb--on': checked }"
      :left="6"
      :top="6"
    />
  </AbsoluteLayout>
</template>

<style scoped>
/* The control itself: 52 by 32, the size of a Material 3 switch. */
.md-switch {
  width: 52;
  height: 32;
  vertical-align: center;
  horizontal-align: right;
}

/* The track. */
.md-switch-track {
  width: 52;
  height: 32;
  border-radius: 16;
  background-color: var(--md-surface-container-highest);
  border-width: 2;
  border-color: var(--md-outline);
}

/* The track of a switch that is on. */
.md-switch-track--on {
  background-color: var(--md-primary);
  border-color: var(--md-primary);
}

/* The thumb. */
.md-switch-thumb {
  width: 20;
  height: 20;
  border-radius: 10;
  background-color: var(--md-outline);
}

.md-switch-thumb--on {
  background-color: var(--md-on-primary);
}
</style>
