import { Application } from '@nativescript/core';

/**
 * The theme.
 *
 * There are three states: the app follows the device by default, and the user
 * can pin it to light or dark from the settings screen. "System" stays
 * reachable after a manual override, so a user who tried dark mode can go back
 * to following the device again.
 *
 * The palette itself lives in `src/app.css` as CSS custom properties
 * (`.theme-light` / `.theme-dark`). The root frame carries the class, and
 * NativeScript resolves `var(--app-*)` by walking up the view tree - so a token
 * declared on the root reaches every view below it. Changing the class on the
 * root re-applies the styles of the whole tree, which is what makes the switch
 * instant.
 */

/** What the user picked: follow the device, or pin a theme. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** The theme that is actually on screen. */
export type ThemeName = 'light' | 'dark';

/** The class the root view carries for a given theme. */
export const THEME_CLASS: Record<ThemeName, string> = {
  light: 'theme-light',
  dark: 'theme-dark',
};

/** The modes, in the order the settings screen lists them. */
export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

/** Turns a stored value into a valid theme mode. */
export function asThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

/** The theme that is shown for a mode and a device appearance. */
export function resolveTheme(mode: ThemeMode, system: ThemeName): ThemeName {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return system;
}

/**
 * The appearance of the device.
 *
 * `Application.primaryWindow` is not there yet while the app boots, so the
 * deprecated instance method is the fallback - it reads the configuration
 * directly.
 *
 * That fallback is not available before the native context exists though, and
 * the store asks for the appearance while the app is still starting. The
 * framework throws in that case, so the light appearance is assumed and the
 * store asks again once the app is on screen.
 */
export function systemAppearance(): ThemeName {
  let appearance: string | null | undefined;
  try {
    appearance =
      Application.primaryWindow?.systemAppearance?.() ?? Application.systemAppearance();
  } catch (err) {
    // The native context is not ready yet.
    appearance = undefined;
  }
  return appearance === 'dark' ? 'dark' : 'light';
}

/**
 * Reads a theme token from the root view.
 *
 * The palette is defined in CSS, but a few places need the concrete colour -
 * the status bar of the Android window, for instance, which is not a view and
 * therefore cannot be styled with CSS.
 */
export function themeToken(name: string, fallback: string): string {
  try {
    const value = Application.getRootView()?.style?.getCssVariable?.(name);
    return value && value !== 'unset' ? value : fallback;
  } catch (err) {
    console.error(`Could not read the theme token ${name}:`, err);
    return fallback;
  }
}
