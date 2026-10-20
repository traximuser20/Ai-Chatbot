<script lang="ts" setup>
/**
 * The icon set.
 *
 * The glyphs come from Font Awesome, cut down to the eighteen icons the
 * interface uses and renamed to `OmniIcons` (see
 * `design/icons/build_font.py` - the font is 4 kB instead of 400 kB).
 *
 * A font is used rather than hand drawn views because it gives a proper,
 * consistent icon set, and because a glyph in a `Label` can be recoloured
 * like any other text - which is what lets the icons follow the accent of
 * the selected provider.
 */
import { computed } from 'vue';

/** The theme tokens an icon can be painted with. */
export type IconTone =
  | 'ink'
  | 'strong'
  | 'muted'
  | 'subtle'
  | 'faint'
  | 'live'
  | 'offline'
  | 'danger'
  | 'on-accent';

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
};

const props = withDefaults(
  defineProps<{
    /** Name of the icon, see `GLYPHS` for the set. */
    name: string;
    /** Size of the glyph in device independent pixels. */
    size?: number;
    /**
     * A concrete colour. Wins over the tone, and is what the provider accent
     * needs - the accent changes with the selected model, so it cannot live
     * in the palette.
     */
    color?: string;
    /**
     * A theme token. The glyph is then painted with the colour the palette
     * gives it, so it follows the light or the dark theme.
     */
    tone?: IconTone;
  }>(),
  {
    size: 20,
    tone: 'ink',
  },
);

/** The class that paints the glyph with a theme token. */
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
  The tones. A tone is a token of the palette in `src/app.css`, so the glyph
  follows the light or the dark theme. The rules carry the class of the icon
  itself as well, so they win over the default of `.icon` whatever the order
  of the style sheet is.
*/
.icon.icon--ink {
  color: var(--app-ink);
}

.icon.icon--strong {
  color: var(--app-ink-strong);
}

.icon.icon--muted {
  color: var(--app-ink-muted);
}

.icon.icon--subtle {
  color: var(--app-ink-subtle);
}

.icon.icon--faint {
  color: var(--app-ink-faint);
}

.icon.icon--live {
  color: var(--app-live);
}

.icon.icon--offline {
  color: var(--app-offline);
}

.icon.icon--danger {
  color: var(--app-danger);
}

.icon.icon--on-accent {
  color: var(--app-on-accent);
}
</style>
