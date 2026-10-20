<script lang="ts" setup>
/**
 * The icon set.
 *
 * Every glyph in the interface is drawn from native views instead of a font
 * character. That buys three things a text glyph cannot give:
 *
 *  - it is recolourable at runtime (`background-color` / `border-color`),
 *    which is what lets the accent follow the selected provider;
 *  - it is crisp at every density, with no icon font to ship;
 *  - every part can be animated - a chevron can rotate, a check can draw
 *    itself, the send arrow can morph into a stop square.
 *
 * The geometry is a 24x24 grid. `size` scales the whole thing, `stroke` the
 * weight of the line work.
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Name of the icon, see the template for the set. */
    name: string;
    /** Overall size in device independent pixels. */
    size?: number;
    /** Colour of the stroke / fill. */
    color?: string;
    /** Stroke weight in grid units (1 unit = size / 24 px). */
    stroke?: number;
  }>(),
  {
    size: 20,
    color: '#14171D',
    stroke: 2,
  },
);

/** Grid unit -> device independent pixels. */
const unit = computed(() => props.size / 24);

/** One grid unit. */
const u = (value: number) => Math.round(value * unit.value * 100) / 100;

/** The stroke thickness in pixels. */
const t = computed(() => u(props.stroke));

/** A filled circle of `diameter` grid units, centred on the icon. */
const dotSize = computed(() => u(8));
</script>

<template>
  <AbsoluteLayout :width="size" :height="size" class="icon">
    <!-- ── Menu ──────────────────────────────────────────────────────────── -->
    <template v-if="name === 'menu'">
      <View :left="u(3)" :top="u(6)" :width="u(18)" :height="t" :backgroundColor="color" />
      <View :left="u(3)" :top="u(11)" :width="u(18)" :height="t" :backgroundColor="color" />
      <View :left="u(3)" :top="u(16)" :width="u(18)" :height="t" :backgroundColor="color" />
    </template>

    <!-- ── Chevrons (one L shape, rotated) ───────────────────────────────── -->
    <template v-else-if="name === 'chevron-down' || name === 'chevron-up' || name === 'chevron-left' || name === 'chevron-right'">
      <View
        :left="u(7.5)"
        :top="u(7.5)"
        :width="u(9)"
        :height="u(9)"
        :borderRightWidth="t"
        :borderBottomWidth="t"
        :borderRightColor="color"
        :borderBottomColor="color"
        :class="{
          'rot-45': name === 'chevron-down',
          'rot-135': name === 'chevron-up',
          'rot-225': name === 'chevron-left',
          'rot-315': name === 'chevron-right',
        }"
      />
    </template>

    <!-- ── Arrow up (send) ───────────────────────────────────────────────── -->
    <template v-else-if="name === 'arrow-up'">
      <View
        :left="u(7.5)"
        :top="u(3)"
        :width="u(9)"
        :height="u(9)"
        :borderRightWidth="t"
        :borderBottomWidth="t"
        :borderRightColor="color"
        :borderBottomColor="color"
        class="rot-135"
      />
      <View :left="u(11)" :top="u(11)" :width="t" :height="u(10)" :backgroundColor="color" />
    </template>

    <!-- ── Stop (abort) ──────────────────────────────────────────────────── -->
    <template v-else-if="name === 'stop'">
      <View
        :left="u(6)"
        :top="u(6)"
        :width="u(12)"
        :height="u(12)"
        :borderRadius="u(2.5)"
        :backgroundColor="color"
      />
    </template>

    <!-- ── Plus ──────────────────────────────────────────────────────────── -->
    <template v-else-if="name === 'plus'">
      <View :left="u(4)" :top="u(11)" :width="u(16)" :height="t" :backgroundColor="color" />
      <View :left="u(11)" :top="u(4)" :width="t" :height="u(16)" :backgroundColor="color" />
    </template>

    <!-- ── Close ─────────────────────────────────────────────────────────── -->
    <template v-else-if="name === 'close'">
      <View
        :left="u(5.5)"
        :top="u(11)"
        :width="u(13)"
        :height="t"
        :backgroundColor="color"
        class="rot-45"
      />
      <View
        :left="u(5.5)"
        :top="u(11)"
        :width="u(13)"
        :height="t"
        :backgroundColor="color"
        class="rot-neg-45"
      />
    </template>

    <!-- ── Search ────────────────────────────────────────────────────────── -->
    <template v-else-if="name === 'search'">
      <View
        :left="u(3.5)"
        :top="u(3.5)"
        :width="u(12)"
        :height="u(12)"
        :borderWidth="t"
        :borderColor="color"
        :borderRadius="u(6)"
      />
      <View
        :left="u(16.4)"
        :top="u(13.6)"
        :width="t"
        :height="u(8)"
        :backgroundColor="color"
        class="rot-45"
      />
    </template>

    <!-- ── Sliders (settings) ────────────────────────────────────────────── -->
    <template v-else-if="name === 'sliders'">
      <View :left="u(4)" :top="u(6)" :width="u(16)" :height="t" :backgroundColor="color" />
      <View :left="u(4)" :top="u(12)" :width="u(16)" :height="t" :backgroundColor="color" />
      <View :left="u(4)" :top="u(18)" :width="u(16)" :height="t" :backgroundColor="color" />
      <View :left="u(6)" :top="u(4)" :width="u(6)" :height="u(6)" :borderRadius="u(3)" :backgroundColor="color" />
      <View :left="u(13)" :top="u(10)" :width="u(6)" :height="u(6)" :borderRadius="u(3)" :backgroundColor="color" />
      <View :left="u(8)" :top="u(16)" :width="u(6)" :height="u(6)" :borderRadius="u(3)" :backgroundColor="color" />
    </template>

    <!-- ── User (profile) ────────────────────────────────────────────────── -->
    <template v-else-if="name === 'user'">
      <View :left="u(7.5)" :top="u(2)" :width="u(9)" :height="u(9)" :borderRadius="u(4.5)" :backgroundColor="color" />
      <View
        :left="u(4)"
        :top="u(14)"
        :width="u(16)"
        :height="u(9)"
        :borderTopLeftRadius="u(8)"
        :borderTopRightRadius="u(8)"
        :backgroundColor="color"
      />
    </template>

    <!-- ── Dot ───────────────────────────────────────────────────────────── -->
    <template v-else-if="name === 'dot'">
      <View
        :left="u(8)"
        :top="u(8)"
        :width="dotSize"
        :height="dotSize"
        :borderRadius="u(4)"
        :backgroundColor="color"
      />
    </template>

    <!-- ── Check ─────────────────────────────────────────────────────────── -->
    <template v-else-if="name === 'check'">
      <View
        :left="u(5)"
        :top="u(11.5)"
        :width="u(7)"
        :height="t"
        :backgroundColor="color"
        class="rot-45"
      />
      <View
        :left="u(9.5)"
        :top="u(11)"
        :width="u(13)"
        :height="t"
        :backgroundColor="color"
        class="rot-neg-45"
      />
    </template>

    <!-- ── Three dots (typing) ───────────────────────────────────────────── -->
    <template v-else-if="name === 'dots'">
      <View :left="u(3)" :top="u(9.5)" :width="u(5)" :height="u(5)" :borderRadius="u(2.5)" :backgroundColor="color" />
      <View :left="u(9.5)" :top="u(9.5)" :width="u(5)" :height="u(5)" :borderRadius="u(2.5)" :backgroundColor="color" />
      <View :left="u(16)" :top="u(9.5)" :width="u(5)" :height="u(5)" :borderRadius="u(2.5)" :backgroundColor="color" />
    </template>

    <!-- ── Trash ─────────────────────────────────────────────────────────── -->
    <template v-else-if="name === 'trash'">
      <View :left="u(9)" :top="u(2.5)" :width="u(6)" :height="t" :backgroundColor="color" />
      <View :left="u(3)" :top="u(6)" :width="u(18)" :height="t" :backgroundColor="color" />
      <View
        :left="u(6)"
        :top="u(9)"
        :width="u(12)"
        :height="u(13)"
        :borderWidth="t"
        :borderColor="color"
        :borderTopLeftRadius="u(1.5)"
        :borderTopRightRadius="u(1.5)"
      />
    </template>
  </AbsoluteLayout>
</template>

<style scoped>
.icon {
  /* The icon is a pure container; every part positions itself. */
}

/* Rotations used by the chevrons, the arrow, the cross, the search handle
   and the tick. The angles are fixed, so they live in CSS. */
.rot-45 {
  rotate: 45deg;
}

.rot-135 {
  rotate: 135deg;
}

.rot-225 {
  rotate: 225deg;
}

.rot-315 {
  rotate: 315deg;
}

.rot-neg-45 {
  rotate: -45deg;
}
</style>
