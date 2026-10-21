import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useChatStore } from './chat';
import { useThemeStore } from './theme';
import { accentFor } from '../utils/accent';
import { materialScheme } from '../utils/material';

/**
 * The palette of the app.
 *
 * Material You paints an interface with a palette that is derived from a
 * single source colour. The source colour of this app is the provider that
 * answers: the accent of the provider (see `src/utils/accent.ts`) is the seed
 * of a Material 3 scheme, and the scheme follows the theme - light or dark.
 *
 * The scheme is written into the CSS variables of the root view by
 * `src/utils/dynamic-color.ts`, so the components only ever talk about roles
 * (`var(--md-primary)`) and never about colours.
 */
export const usePaletteStore = defineStore('palette', () => {
  const chat = useChatStore();
  const theme = useThemeStore();

  /** The seed: the accent colour of the active provider. */
  const source = computed(() => accentFor(chat.model));

  /** The Material 3 scheme of the seed, in the theme that is on screen. */
  const scheme = computed(() => materialScheme(source.value, theme.isDark));

  return { source, scheme };
});
