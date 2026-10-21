<script lang="ts" setup>
/**
 * The icon set.
 *
 * The glyphs come from Font Awesome, cut down to the icons the interface uses
 * and renamed to `OmniIcons` (see `design/icons/build_font.py` - the font is
 * 4 kB instead of 400 kB).
 *
 * A font is used rather than hand drawn views because it gives a proper,
 * consistent icon set, and because a glyph in a `Label` can be recoloured
 * like any other text - which is what lets the icons follow the palette of
 * the active route.
 *
 * A tone is a *role* of the Material 3 scheme, so an icon always belongs to
 * the surface it stands on: `on-surface` on a card, `on-primary` on a filled
 * button, `error` on a warning.
 */
import { computed } from 'vue';

/** The roles of the scheme an icon can be painted with. */
type IconTone =
  | 'primary'
  | 'on-primary'
  | 'primary-container'
  | 'on-primary-container'
  | 'secondary'
  | 'on-secondary-container'
  | 'tertiary'
  | 'on-surface'
  | 'on-surface-variant'
  | 'outline'
  | 'error'
  | 'on-error-container'
  | 'inverse'
  | 'live'
  | 'offline';

/** The codepoint of every icon in the font. */
const GLYPHS: Record<string, string> = {
  menu: '\uf0c9', // bars
  'chevron-down': '\uf078',
  'chevron-left': '\uf053',
  'arrow-up': '\uf062',
  stop: '\uf04d', // square
  plus: '\u002b',
  close: '\uf00d', // xmark
  search: '\uf002', // magnifying-glass
  sliders: '\uf1de',
  user: '\uf007',
  dot: '\uf111', // circle
  check: '\uf00c',
  dots: '\uf141', // ellipsis
  trash: '\uf1f8',
  retry: '\uf2f1', // rotate
  warning: '\uf071', // triangle-exclamation
  plane: '\uf1d8', // paper-plane
  info: '\uf05a', // circle-info
  // Voice, attachments and the camera.
  microphone: '\uf130',
  camera: '\uf030',
  paperclip: '\uf0c6',
  image: '\uf03e',
  file: '\uf0f6',
  volume: '\uf028', // volume-high
  play: '\uf04b',
};

const props = withDefaults(
  defineProps<{
    /** Name of the icon, see `GLYPHS` for the set. */
    name: string;
    /** Size of the glyph in device independent pixels. */
    size?: number;
    /**
     * A concrete colour. Wins over the tone, and is what a runtime colour
     * needs - a value that cannot live in the palette of the theme.
     */
    color?: string;
    /**
     * A role of the Material 3 scheme. The glyph is then painted with the
     * colour the palette gives it, so it follows the light or the dark theme
     * and the route that is on screen.
     */
    tone?: IconTone;
  }>(),
  {
    size: 24,
    tone: 'on-surface',
  },
);

/** The class that paints the glyph with a role of the scheme. */
const toneClass = computed(() => `icon--${props.tone}`);

/** The character of the icon, or a question mark if the name is unknown. */
const glyph = computed(() => GLYPHS[props.name] ?? GLYPHS['info']);
</script>

<template>
  <Label :text="glyph" class="icon" :class="toneClass" :fontSize="size" :color="color" />
</template>

<style scoped>
.icon {
  font-family: OmniIcons;
  text-align: center;
  vertical-align: center;
  horizontal-align: center;
}

/*
  The tones. A tone is a role of the scheme in `src/app.css`, so the glyph
  follows the light or the dark theme - and the palette of the active route.
  The rules carry the class of the icon itself as well, so they win over the
  default of `.icon` whatever the order of the style sheet is.
*/
.icon.icon--primary {
  color: var(--md-primary);
}

.icon.icon--on-primary {
  color: var(--md-on-primary);
}

.icon.icon--primary-container {
  color: var(--md-primary-container);
}

.icon.icon--on-primary-container {
  color: var(--md-on-primary-container);
}

.icon.icon--secondary {
  color: var(--md-secondary);
}

.icon.icon--on-secondary-container {
  color: var(--md-on-secondary-container);
}

.icon.icon--tertiary {
  color: var(--md-tertiary);
}

.icon.icon--on-surface {
  color: var(--md-on-surface);
}

.icon.icon--on-surface-variant {
  color: var(--md-on-surface-variant);
}

.icon.icon--outline {
  color: var(--md-outline);
}

.icon.icon--error {
  color: var(--md-error);
}

.icon.icon--on-error-container {
  color: var(--md-on-error-container);
}

.icon.icon--inverse {
  color: var(--md-inverse-on-surface);
}

.icon.icon--live {
  color: var(--md-live);
}

.icon.icon--offline {
  color: var(--md-error);
}
</style>
