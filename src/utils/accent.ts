/**
 * Provider accent colours.
 *
 * OmniRoute exposes ~580 models spread over ~25 provider prefixes
 * ("auto/…", "aihorde/…", "dva/…"). The provider is the most useful piece of
 * metadata a chat UI can show: it tells you *who* is answering and it makes
 * switching routes feel like switching channels.
 *
 * Every known provider gets a hand-picked colour; unknown ones fall back to a
 * stable hash-derived hue so the interface never ends up colourless.
 */

/** Accent colour per provider prefix. */
const PROVIDER_ACCENTS: Record<string, string> = {
  auto: '#6D4AFF',
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
  oc: '#0891B2',
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
export const DEFAULT_ACCENT = '#2F55F5';

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

/**
 * Mixes a hex colour towards black - used for the pressed/hover state of
 * accent-filled surfaces.
 */
export function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.round(channel * (1 - amount))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`.toUpperCase();
}

/**
 * Picks a readable foreground (dark or light) for a filled accent surface.
 */
export function readableOn(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#111318' : '#FFFFFF';
}
