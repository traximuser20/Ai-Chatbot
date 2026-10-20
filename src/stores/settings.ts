import { defineStore } from 'pinia';
import { ApplicationSettings } from '@nativescript/core';

/**
 * User settings.
 *
 * Everything in here is persisted with `ApplicationSettings` (SharedPreferences
 * on Android) so the app remembers the choices between launches. The store is
 * initialised synchronously from storage - there is no async hydration step,
 * which keeps the first render free of flicker.
 */

const STORAGE_KEY = 'omniai.settings.v1';

/**
 * The key the app used before it was renamed. It is read once, so renaming
 * the app never throws away the settings that are already on the device.
 */
const LEGACY_STORAGE_KEY = 'omniroute.settings.v1';

export type TextScale = 'small' | 'medium' | 'large';

export interface SettingsState {
  /** Display name shown in the profile screen and the drawer. */
  displayName: string;
  /** Body text size. */
  textScale: TextScale;
  /** Show the timestamp under each assistant reply. */
  showTimestamps: boolean;
  /** Submit the composer with the keyboard's send key. */
  sendOnEnter: boolean;
}

const DEFAULTS: SettingsState = {
  displayName: 'Developer',
  textScale: 'medium',
  showTimestamps: false,
  sendOnEnter: true,
};

/** Multiplier applied to every body font size. */
export const TEXT_SCALE_FACTOR: Record<TextScale, number> = {
  small: 0.9,
  medium: 1,
  large: 1.14,
};

function readStored(): Partial<SettingsState> {
  try {
    const raw =
      ApplicationSettings.getString(STORAGE_KEY, '') ||
      ApplicationSettings.getString(LEGACY_STORAGE_KEY, '');
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Could not read settings:', err);
    return {};
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    ...DEFAULTS,
    ...readStored(),
  }),
  getters: {
    /** Numeric multiplier for body text. */
    fontScale: (state) => TEXT_SCALE_FACTOR[state.textScale] ?? 1,
    /** Initials for the profile avatar. */
    initials: (state) => {
      const parts = (state.displayName || 'Developer')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (!parts.length) {
        return 'D';
      }
      return parts
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
    },
  },
  actions: {
    persist() {
      try {
        ApplicationSettings.setString(
          STORAGE_KEY,
          JSON.stringify({
            displayName: this.displayName,
            textScale: this.textScale,
            showTimestamps: this.showTimestamps,
            sendOnEnter: this.sendOnEnter,
          }),
        );
      } catch (err) {
        console.error('Could not save settings:', err);
      }
    },
    setTextScale(scale: TextScale) {
      this.textScale = scale;
      this.persist();
    },
    setShowTimestamps(value: boolean) {
      this.showTimestamps = value;
      this.persist();
    },
    setSendOnEnter(value: boolean) {
      this.sendOnEnter = value;
      this.persist();
    },
    setDisplayName(name: string) {
      this.displayName = name.trim() || DEFAULTS.displayName;
      this.persist();
    },
    reset() {
      Object.assign(this, DEFAULTS);
      this.persist();
    },
  },
});
