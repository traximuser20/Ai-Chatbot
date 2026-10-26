import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useChatStore } from './chat';
import { useSettingsStore } from './settings';
import { useThemeStore } from './theme';
import { accentFor, gradientAccentOf, gradientCss } from '../utils/accent';
import { materialScheme } from '../utils/material';

/**
 * The palette of the app.
 *
 * Material You paints an interface with a palette that is derived from a
 * single source colour. The source colour of this app is the provider that
 * answers: the accent of the provider (see `src/utils/accent.ts`) is the seed
 * of a Material 3 scheme, and the scheme follows the theme - light or dark.
 *
 * The settings screen can pin one of five gradient accents instead. A pinned
 * accent is the seed on every screen, whatever route is answering - pinning
 * `ACCENT_AUTO` ("Route") hands the palette back to the provider.
 *
 * The scheme is written into the CSS variables of the root view by
 * `src/utils/dynamic-color.ts`, so the components only ever talk about roles
 * (`var(--md-primary)`) and never about colours.
 */
export const usePaletteStore = defineStore('palette', () => {
  const chat = useChatStore();
  const settings = useSettingsStore();
  const theme = useThemeStore();

  /** The gradient accent that is pinned - or none, when the route leads. */
  const pinned = computed(() => gradientAccentOf(settings.accent));

  /** The seed: the pinned accent, or the accent colour of the active route. */
  const source = computed(() =>
    pinned.value ? pinned.value.seed : accentFor(chat.model),
  );

  /** The Material 3 scheme of the seed, in the theme that is on screen. */
  const scheme = computed(() => materialScheme(source.value, theme.isDark));

  /**
   * The gradient of the pinned accent - null when the route leads.
   *
   * The scheme already carries the *seed* of the accent everywhere; this is
   * the gradient itself, for the few brand surfaces that wear it (the send
   * button, the handle of a new chat). A component binds it as an inline
   * `background-image` only while it is set - the moment it is null the
   * binding is dropped and the painted rule (`var(--md-primary)`) takes over
   * again, so nothing has to know which of the two is on screen.
   */
  const accentGradient = computed(() =>
    pinned.value ? gradientCss(pinned.value) : null,
  );

  return { pinned, source, scheme, accentGradient };
});
