import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Application } from '@nativescript/core';
import { useSettingsStore } from './settings';
import {
  resolveTheme,
  systemAppearance,
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
   * The device changed its appearance.
   *
   * The framework keeps `ns-light` / `ns-dark` on the root view for its own
   * rules; this listener is what the app's own palette follows.
   */
  function onSystemAppearanceChanged(args: { newValue?: string }): void {
    system.value = args?.newValue === 'dark' ? 'dark' : 'light';
  }

  Application.on('systemAppearanceChanged', onSystemAppearanceChanged);

  /**
   * The appearance of the device can only be read once the app is on screen:
   * before that the native context does not exist yet. So the value is
   * picked up again when the app is launched.
   */
  if (!Application.hasLaunched()) {
    Application.on(Application.launchEvent, () => {
      system.value = systemAppearance();
    });
  }

  /** Picks a theme and remembers it. */
  function setMode(next: ThemeMode): void {
    settings.setTheme(next);
  }

  return { mode, name, themeClass, isDark, system, setMode };
});
