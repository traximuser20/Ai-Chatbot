import { defineStore } from 'pinia';
import { ApplicationSettings } from '@nativescript/core';
import { asThemeMode, type ThemeMode } from '../utils/theme';
import { ACCENT_AUTO, asAccentId, type AccentId } from '../utils/accent';

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
  /** Follow the device theme, or pin light / dark. */
  theme: ThemeMode;
  /**
   * The accent that paints the interface: `ACCENT_AUTO` follows the route,
   * anything else pins one of the gradient accents across the whole app.
   */
  accent: AccentId;
  /** Read every finished reply out loud (voice chat always speaks). */
  speakReplies: boolean;
  /** Tell the reader when a reply lands while the app is in the background. */
  notifications: boolean;
  /** The gateway's transcription model, used by voice search and voice chat. */
  sttModel: string;
  /** The gateway's speech model, used to read replies out loud. */
  ttsModel: string;
  /** The voice the speech model speaks with. */
  ttsVoice: string;
}

const DEFAULTS: SettingsState = {
  displayName: 'Developer',
  textScale: 'medium',
  showTimestamps: false,
  sendOnEnter: true,
  theme: 'system',
  accent: ACCENT_AUTO,
  speakReplies: false,
  notifications: true,
  sttModel: 'whisper-1',
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
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
  state: (): SettingsState => {
    const stored = readStored();
    return {
      ...DEFAULTS,
      ...stored,
      // The stored values come from disk, so they are checked before use.
      theme: asThemeMode(stored.theme),
      accent: asAccentId(stored.accent),
    };
  },
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
            theme: this.theme,
            accent: this.accent,
            speakReplies: this.speakReplies,
            notifications: this.notifications,
            sttModel: this.sttModel,
            ttsModel: this.ttsModel,
            ttsVoice: this.ttsVoice,
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
    setTheme(mode: ThemeMode) {
      this.theme = asThemeMode(mode);
      this.persist();
    },
    /** Pins a gradient accent, or unmakes it again with `ACCENT_AUTO`. */
    setAccent(id: AccentId) {
      this.accent = asAccentId(id);
      this.persist();
    },
    setSpeakReplies(value: boolean) {
      this.speakReplies = value;
      this.persist();
    },
    setNotifications(value: boolean) {
      this.notifications = value;
      this.persist();
    },
    setSttModel(value: string) {
      this.sttModel = value.trim() || DEFAULTS.sttModel;
      this.persist();
    },
    setTtsModel(value: string) {
      this.ttsModel = value.trim() || DEFAULTS.ttsModel;
      this.persist();
    },
    setTtsVoice(value: string) {
      this.ttsVoice = value.trim() || DEFAULTS.ttsVoice;
      this.persist();
    },
    reset() {
      Object.assign(this, DEFAULTS);
      this.persist();
    },
  },
});
