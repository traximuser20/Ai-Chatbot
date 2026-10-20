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
 *
 * Every icon is described as a list of parts (see `PARTS`). The template then
 * renders that list with a single `v-for` - a `v-if` on a `<template>` block
 * does not work inside a native view in NativeScript-Vue.
 */
import { computed, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Name of the icon, see `PARTS` for the set. */
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

/** One piece of an icon, in grid units. */
interface Part {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Filled with the colour (otherwise only the border is drawn). */
  fill?: boolean;
  /** Which edges carry the stroke. */
  edges?: 'all' | 'right-bottom' | 'none';
  /** Border radius in grid units. */
  radius?: number;
  /** Border radius on the two top corners only. */
  radiusTop?: number;
  /** Rotation in degrees. */
  rotate?: number;
}

/** The chevron is one L shape, rotated to point in a direction. */
const CHEVRON: Part = { left: 7.5, top: 7.5, width: 9, height: 9, edges: 'right-bottom' };

/** All icons, in grid units. */
const PARTS: Record<string, Part[]> = {
  menu: [
    { left: 3, top: 6, width: 18, height: 2, fill: true },
    { left: 3, top: 11, width: 18, height: 2, fill: true },
    { left: 3, top: 16, width: 18, height: 2, fill: true },
  ],
  'chevron-down': [{ ...CHEVRON, rotate: 45 }],
  'chevron-up': [{ ...CHEVRON, rotate: 135 }],
  'chevron-left': [{ ...CHEVRON, rotate: 225 }],
  'chevron-right': [{ ...CHEVRON, rotate: 315 }],
  'arrow-up': [
    { ...CHEVRON, top: 3, rotate: 135 },
    { left: 11, top: 11, width: 2, height: 10, fill: true },
  ],
  stop: [{ left: 6, top: 6, width: 12, height: 12, fill: true, radius: 2.5 }],
  plus: [
    { left: 4, top: 11, width: 16, height: 2, fill: true },
    { left: 11, top: 4, width: 2, height: 16, fill: true },
  ],
  close: [
    { left: 5.5, top: 11, width: 13, height: 2, fill: true, rotate: 45 },
    { left: 5.5, top: 11, width: 13, height: 2, fill: true, rotate: -45 },
  ],
  search: [
    { left: 3.5, top: 3.5, width: 12, height: 12, edges: 'all', radius: 6 },
    { left: 16.4, top: 13.6, width: 2, height: 8, fill: true, rotate: 45 },
  ],
  sliders: [
    { left: 4, top: 6, width: 16, height: 2, fill: true },
    { left: 4, top: 12, width: 16, height: 2, fill: true },
    { left: 4, top: 18, width: 16, height: 2, fill: true },
    { left: 6, top: 4, width: 6, height: 6, fill: true, radius: 3 },
    { left: 13, top: 10, width: 6, height: 6, fill: true, radius: 3 },
    { left: 8, top: 16, width: 6, height: 6, fill: true, radius: 3 },
  ],
  user: [
    { left: 7.5, top: 2, width: 9, height: 9, fill: true, radius: 4.5 },
    { left: 4, top: 14, width: 16, height: 9, fill: true, radiusTop: 8 },
  ],
  dot: [{ left: 0, top: 0, width: 24, height: 24, fill: true, radius: 12 }],
  check: [
    { left: 5, top: 11.5, width: 7, height: 2, fill: true, rotate: 45 },
    { left: 9.5, top: 11, width: 13, height: 2, fill: true, rotate: -45 },
  ],
  dots: [
    { left: 3, top: 9.5, width: 5, height: 5, fill: true, radius: 2.5 },
    { left: 9.5, top: 9.5, width: 5, height: 5, fill: true, radius: 2.5 },
    { left: 16, top: 9.5, width: 5, height: 5, fill: true, radius: 2.5 },
  ],
  trash: [
    { left: 9, top: 2.5, width: 6, height: 2, fill: true },
    { left: 3, top: 6, width: 18, height: 2, fill: true },
    { left: 6, top: 9, width: 12, height: 13, edges: 'all', radius: 1.5 },
  ],
};

/** Grid unit -> device independent pixels. */
const unit = computed(() => props.size / 24);

/** The stroke thickness in pixels. */
const thickness = computed(() => Math.round(props.stroke * unit.value * 100) / 100);

/**
 * The icon, scaled to the requested size.
 */
const parts = computed(() =>
  (PARTS[props.name] ?? []).map((part) => ({
    ...part,
    left: Math.round(part.left * unit.value * 100) / 100,
    top: Math.round(part.top * unit.value * 100) / 100,
    width: Math.round(part.width * unit.value * 100) / 100,
    height: Math.round(part.height * unit.value * 100) / 100,
    radius: part.radius !== undefined
      ? Math.round(part.radius * unit.value * 100) / 100
      : undefined,
    radiusTop: part.radiusTop !== undefined
      ? Math.round(part.radiusTop * unit.value * 100) / 100
      : undefined,
  })),
);

/** The stroke width of one edge (0 when the edge carries no stroke). */
function edgeWidth(part: Part, edge: 'all' | 'top' | 'right' | 'bottom' | 'left'): number {
  if (part.edges === 'none') {
    return 0;
  }
  if (part.edges === 'right-bottom') {
    return edge === 'right' || edge === 'bottom' ? thickness.value : 0;
  }
  return thickness.value;
}

/** The rotation class of a part. */
function rotateClass(part: Part): string {
  if (!part.rotate) {
    return '';
  }
  return part.rotate < 0 ? 'rot-neg-45' : `rot-${part.rotate}`;
}

onMounted(() => {
  console.log(
    `ICON ${props.name} size=${props.size} color=${props.color} parts=${parts.value.length}`,
  );
});
</script>

<template>
  <AbsoluteLayout :width="size" :height="size" class="icon">
    <View
      v-for="(part, index) in parts"
      :key="index"
      :left="part.left"
      :top="part.top"
      :width="part.width"
      :height="part.height"
      :backgroundColor="part.fill ? color : 'transparent'"
      :borderTopWidth="edgeWidth(part, 'top')"
      :borderRightWidth="edgeWidth(part, 'right')"
      :borderBottomWidth="edgeWidth(part, 'bottom')"
      :borderLeftWidth="edgeWidth(part, 'left')"
      :borderColor="color"
      :borderRadius="part.radius"
      :borderTopLeftRadius="part.radiusTop ?? part.radius"
      :borderTopRightRadius="part.radiusTop ?? part.radius"
      :class="rotateClass(part)"
    />
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
