import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Application } from '@nativescript/core';
import { useSettingsStore } from './settings';
import {
  resolveTheme,
  systemAppearance,
  themeToken,
  THEME_CLASS,
  type ThemeMode,
  type ThemeName,
} from '../utils/theme';

/**
 * The theme that is on screen.
 *
 * The user picks a *mode* in the settings screen - "system", "light" or
 * "dark" - and this store turns it into the theme that is actually shown, by
 * asking the device for its appearance when the mode follows the system.
 *
 * The device is watched, so the app follows a theme change of the system while
 * it is running.
 */
export const useThemeStore = defineStore('theme', () => {
  const settings = useSettingsStore();

  /** The appearance of the device. */
  const system = ref<ThemeName>(systemAppearance());

  /** The mode the user picked. */
  const mode = computed<ThemeMode>(() => settings.theme);

  /** The theme that is shown. */
  const name = computed<ThemeName>(() => resolveTheme(mode.value, system.value));

  /** The class the root view carries. */
  const themeClass = computed(() => THEME_CLASS[name.value]);

  /** True when the dark theme is on screen. */
  const isDark = computed(() => name.value === 'dark');

  /**
   * The palette, read back from the root view.
   *
   * The colours live in the style sheet, so they are read from there. Only a
   * handful of places need a concrete colour - the status bar of the window
   * and the fill of a button that is painted with a property rather than
   * with a rule - and for those the palette is the source of truth.
   *
   * The dependency on the theme name is what refreshes the values: the root
   * view is repainted before the screens are, so the tokens are current by the
   * time a screen reads them.
   */
  const palette = computed(() => {
    const applied = name.value;
    return {
      applied,
      canvas: themeToken('--app-canvas', '#F2F3F6'),
      surface: themeToken('--app-surface', '#FFFFFF'),
      surface2: themeToken('--app-surface-2', '#F4F5F8'),
      surface3: themeToken('--app-surface-3', '#ECEEF2'),
      danger: themeToken('--app-danger', '#C0392B'),
      onAccent: themeToken('--app-on-accent', '#FFFFFF'),
    };
  });

  /**
   * The device changed its appearance.
   *
   * The framework keeps `ns-light` / `ns-dark` on the root view for its own
   * rules; this listener is what the app's own palette follows.
   */
  function onSystemAppearanceChanged(args: { newValue?: string }): void {
    system.value = args?.newValue === 'dark' ? 'dark' : 'light';
  }

  Application.on('systemAppearanceChanged', onSystemAppearanceChanged);

  /** Picks a theme and remembers it. */
  function setMode(next: ThemeMode): void {
    settings.setTheme(next);
  }

  return { mode, name, themeClass, isDark, system, palette, setMode };
});
