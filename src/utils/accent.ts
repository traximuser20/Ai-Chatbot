/**
 * Provider accent colours.
 *
 * The gateway exposes ~580 models spread over ~25 provider prefixes
 * ("auto/…", "aihorde/…", "dva/…"). The provider is the most useful piece of
 * metadata a chat UI can show: it tells you *who* is answering and it makes
 * switching routes feel like switching channels.
 *
 * Every known provider gets a hand-picked colour; unknown ones fall back to a
 * stable hash-derived hue so the interface never ends up colourless.
 */

/**
 * Brand tokens - see `design/logo/build-assets.py` for the source of truth.
 */
export const BRAND = {
  /** Primary - the app's own default accent. */
  cobalt: '#2F55F5',
  /** Mid stop of the brand spectrum. */
  iris: '#6D3BF5',
  /** The live-route accent. */
  cyan: '#0FB6D6',
  /** Deep ground - used for the ink surfaces. */
  ink: '#0E111B',
  /** Raised ground. */
  ink2: '#171B2B',
  /** App canvas. */
  paper: '#F2F3F6',
};

/** Accent colour per provider prefix. */
const PROVIDER_ACCENTS: Record<string, string> = {
  auto: BRAND.iris,
  aihorde: '#0E8F6E',
  dva: '#C2410C',
  ollamacloud: '#0F766E',
  'ollama-cloud': '#0F766E',
  aug: '#B45309',
  tllm: '#52525B',
  cxa: '#BE185D',
  cfp: '#4338CA',
  zc: '#7C3AED',
  'no-think': '#64748B',
  oc: BRAND.cyan,
  ddgw: '#A21CAF',
  felo: '#EA580C',
  unc: '#4D7C0F',
  'veoaifree-web': '#DB2777',
  'veo-free': '#DB2777',
  horde: '#9333EA',
  'free-failover': '#57534E',
  'noauth-coding': '#78716C',
  'noauth-chat': '#78716C',
  opencode: '#27272A',
  pepper: '#E11D48',
};

/** Used when a model id carries no provider prefix at all. */
export const DEFAULT_ACCENT = BRAND.cobalt;

/**
 * Extracts the provider prefix from a model id.
 * "anthropic/claude-3.5" -> "anthropic", "gpt-4o" -> "gpt-4o".
 */
export function providerOf(modelId: string): string {
  const id = (modelId ?? '').trim();
  const slash = id.indexOf('/');
  if (slash <= 0) {
    return id.toLowerCase();
  }
  return id.slice(0, slash).toLowerCase();
}

/** Hashes a string into a non-negative integer. */
function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Converts an HSL triple into a hex colour. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** Returns the accent colour for a model id. */
export function accentFor(modelId: string): string {
  const provider = providerOf(modelId);
  if (!provider) {
    return DEFAULT_ACCENT;
  }
  const known = PROVIDER_ACCENTS[provider];
  if (known) {
    return known;
  }
  // Unknown provider: derive a stable, mid-tone hue from its name.
  const hue = hashString(provider) % 360;
  return hslToHex(hue, 58, 44);
}

/**
 * Mixes a hex colour towards white.
 * `amount` is the share of white: 0 keeps the colour, 1 turns it white.
 */
export function tint(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`.toUpperCase();
}

/* ------------------------------------------------------------------ */
/* The gradient accents of the settings screen                          */
/* ------------------------------------------------------------------ */

/**
 * The settings screen can pin an accent across the whole app. `ACCENT_AUTO`
 * is the default: the accent keeps following the provider that answers.
 * A gradient accent is a *source colour* like any other in Material You -
 * its seed repaints the entire interface, on every screen.
 */
export const ACCENT_AUTO = 'route';

/** A gradient accent the user can pin in the settings screen. */
export interface GradientAccent {
  /** Stable id, stored with the settings. */
  id: string;
  /** The name shown under the swatch of the picker. */
  label: string;
  /** Where the gradient starts. */
  from: string;
  /** Where it ends. */
  to: string;
  /** The colour the Material 3 scheme is seeded from - the midpoint. */
  seed: string;
}

/** Averages two hex colours - channel by channel. */
function mixHex(a: string, b: string): string {
  const first = a.replace('#', '');
  const second = b.replace('#', '');
  const channel = (i: number) =>
    Math.round(
      (parseInt(first.slice(i, i + 2), 16) + parseInt(second.slice(i, i + 2), 16)) / 2,
    )
      .toString(16)
      .padStart(2, '0');
  const seed = `#${channel(0)}${channel(2)}${channel(4)}`;
  return seed.toUpperCase();
}

/**
 * The five gradient accents - hand-picked stops that read well at both
 * tones of the scheme, and sit far enough apart on the wheel to tell each
 * other apart at a glance.
 */
const GRADIENT_STOPS = [
  { id: 'azure', label: 'Azure', from: '#2563EB', to: '#38BDF8' },
  { id: 'aurora', label: 'Aurora', from: '#0FB6D6', to: '#10B981' },
  { id: 'sunset', label: 'Sunset', from: '#F59E0B', to: '#EF4444' },
  { id: 'orchid', label: 'Orchid', from: '#A855F7', to: '#EC4899' },
  { id: 'rose', label: 'Rose', from: '#E11D48', to: '#DB2777' },
] as const;

/** The gradient accents, with the seed each one drives the palette from. */
export const GRADIENT_ACCENTS: GradientAccent[] = GRADIENT_STOPS.map((stops) => ({
  id: stops.id,
  label: stops.label,
  from: stops.from,
  to: stops.to,
  seed: mixHex(stops.from, stops.to),
}));

/** A gradient accent id, or `ACCENT_AUTO`. */
export type GradientAccentId = (typeof GRADIENT_STOPS)[number]['id'];

/** Every accent the settings store accepts. */
export type AccentId = typeof ACCENT_AUTO | GradientAccentId;

/** Returns the gradient accent behind an id, if it is one. */
export function gradientAccentOf(id: unknown): GradientAccent | undefined {
  if (typeof id !== 'string') {
    return undefined;
  }
  return GRADIENT_ACCENTS.find((accent) => accent.id === id);
}

/** The 135° CSS gradient of an accent - the look of its swatch. */
export function gradientCss(accent: GradientAccent): string {
  return `linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`;
}

/** Checks a value that was read from storage into an accent id. */
export function asAccentId(raw: unknown): AccentId {
  return gradientAccentOf(raw) ? (raw as AccentId) : ACCENT_AUTO;
}
