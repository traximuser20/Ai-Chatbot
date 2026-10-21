/**
 * Material You - the colour system of Material 3.
 *
 * Material 3 does not ship with a fixed palette. It derives one from a single
 * source colour: the hue and the chroma of that colour decide the primary, the
 * secondary, the tertiary and even the tint of the neutral greys, and every
 * role of the scheme is a *tone* - a lightness - of one of those tonal
 * palettes.
 *
 * The app has a source colour of its own: the provider that answers. So the
 * interface is not painted with a fixed palette but with one that follows the
 * route, which is exactly what Material You does with the wallpaper of the
 * device. Changing the route repaints the whole app.
 *
 * The maths is done in OKLCh, a perceptually uniform space: the tone of a
 * colour is its lightness, so two colours with the same tone look equally
 * light whatever their hue, and the greys stay grey.
 *
 * The file is pure maths on purpose - it knows nothing about NativeScript -
 * so it can be reused (and tested) anywhere.
 */

/** A colour of the sRGB space, 0-255 per channel. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** A colour in the OKLCh space: lightness 0-1, chroma 0-0.4, hue 0-360. */
export interface Oklch {
  /** Lightness, 0 (black) to 1 (white). */
  l: number;
  /** Chroma - how colourful the colour is. */
  c: number;
  /** Hue in degrees. */
  h: number;
}

/** The roles of a Material 3 colour scheme. */
export interface MaterialScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

/** The roles in the order they are written into the CSS variables. */
export const SCHEME_ROLES: (keyof MaterialScheme)[] = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'outline',
  'outlineVariant',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'inverseSurface',
  'inverseOnSurface',
  'inversePrimary',
];

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** Parses a `#rgb` or `#rrggbb` colour. */
export function hexToRgb(hex: string): Rgb {
  let clean = (hex ?? '').trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const value = parseInt(clean, 16);
  if (Number.isNaN(value)) {
    return { r: 0, g: 0, b: 0 };
  }
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Writes a colour as `#rrggbb`. */
export function rgbToHex(rgb: Rgb): string {
  const channel = (value: number) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`.toUpperCase();
}

/** sRGB -> linear light. */
function toLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** Linear light -> sRGB. */
function toSrgb(channel: number): number {
  const value =
    channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return clamp(value * 255, 0, 255);
}

/** Linear light -> OKLab. */
function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab -> linear light. */
function oklabToLinear(l: number, a: number, b: number): [number, number, number] {
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = lPrime * lPrime * lPrime;
  const m3 = mPrime * mPrime * mPrime;
  const s3 = sPrime * sPrime * sPrime;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

/** The OKLCh reading of a colour. */
export function toOklch(hex: string): Oklch {
  const rgb = hexToRgb(hex);
  const [l, a, b] = linearToOklab(
    toLinear(rgb.r),
    toLinear(rgb.g),
    toLinear(rgb.b),
  );
  const chroma = Math.sqrt(a * a + b * b);
  let hue = (Math.atan2(b, a) * 180) / Math.PI;
  if (hue < 0) {
    hue += 360;
  }
  return { l, c: chroma, h: hue };
}

/** True when the linear colour fits on the screen. */
function inGamut(rgb: [number, number, number]): boolean {
  const epsilon = 0.0001;
  return (
    rgb[0] >= -epsilon &&
    rgb[0] <= 1 + epsilon &&
    rgb[1] >= -epsilon &&
    rgb[1] <= 1 + epsilon &&
    rgb[2] >= -epsilon &&
    rgb[2] <= 1 + epsilon
  );
}

/**
 * Brings a colour back into the sRGB gamut.
 *
 * A vivid colour at a light tone simply does not exist on a screen, so the
 * chroma is lowered until it does - the hue and the lightness are kept, which
 * is what a viewer actually perceives.
 */
function gamutMap(l: number, c: number, h: number): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const direct = oklabToLinear(l, a, b);
  if (inGamut(direct)) {
    return direct;
  }

  let low = 0;
  let high = c;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (inGamut(oklabToLinear(l, middle * Math.cos(radians), middle * Math.sin(radians)))) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return oklabToLinear(l, low * Math.cos(radians), low * Math.sin(radians));
}

/** Writes an OKLCh colour as `#rrggbb`. */
export function oklchToHex(l: number, c: number, h: number): string {
  const [r, g, b] = gamutMap(clamp(l, 0, 1), Math.max(c, 0), h);
  return rgbToHex({ r: toSrgb(r), g: toSrgb(g), b: toSrgb(b) });
}

/**
 * A tonal palette: every tone of one hue.
 *
 * The tone is the lightness of the colour (0 is black, 100 is white), and the
 * chroma fades towards the ends of the palette, where the colour has to give
 * up its colourfulness to stay on the screen.
 */
export function tonalPalette(hue: number, chroma: number): (tone: number) => string {
  return (tone: number) => {
    const lightness = clamp(tone, 0, 100) / 100;
    const bell = Math.sin(Math.PI * lightness);
    const amount = chroma * (0.2 + 0.8 * bell);
    return oklchToHex(lightness, amount, hue);
  };
}

/**
 * The Material 3 scheme of a source colour.
 *
 * The source decides the hue of everything: the primary takes its hue and its
 * chroma, the secondary keeps the hue but loses two thirds of the chroma, the
 * tertiary turns the hue by 60 degrees, and the neutrals keep the hue with a
 * whisper of chroma - which is what makes the greys of Material You feel like
 * they belong to the accent.
 */
export function materialScheme(source: string, dark: boolean): MaterialScheme {
  const seed = toOklch(source);

  // A colour that is nearly grey carries no hue worth keeping, and a colour
  // that is too pale is not vivid enough to build a palette on. Both are
  // pulled back into range.
  const hue = seed.h;
  const chroma = clamp(seed.c, 0.08, 0.19);

  const primary = tonalPalette(hue, chroma);
  const secondary = tonalPalette(hue, chroma / 3);
  const tertiary = tonalPalette((hue + 60) % 360, chroma);
  const neutral = tonalPalette(hue, dark ? 0.015 : 0.008);
  const error = tonalPalette(25, 0.17);

  if (dark) {
    return {
      primary: primary(80),
      onPrimary: primary(20),
      primaryContainer: primary(30),
      onPrimaryContainer: primary(90),
      secondary: secondary(80),
      onSecondary: secondary(20),
      secondaryContainer: secondary(30),
      onSecondaryContainer: secondary(90),
      tertiary: tertiary(80),
      onTertiary: tertiary(20),
      tertiaryContainer: tertiary(30),
      onTertiaryContainer: tertiary(90),
      error: error(80),
      onError: error(20),
      errorContainer: error(30),
      onErrorContainer: error(90),
      surface: neutral(9),
      onSurface: neutral(90),
      surfaceVariant: neutral(30),
      onSurfaceVariant: neutral(80),
      outline: neutral(60),
      outlineVariant: neutral(30),
      surfaceContainerLowest: neutral(6),
      surfaceContainerLow: neutral(13),
      surfaceContainer: neutral(16),
      surfaceContainerHigh: neutral(19),
      surfaceContainerHighest: neutral(24),
      inverseSurface: neutral(90),
      inverseOnSurface: neutral(20),
      inversePrimary: primary(40),
    };
  }

  return {
    primary: primary(40),
    onPrimary: primary(100),
    primaryContainer: primary(90),
    onPrimaryContainer: primary(10),
    secondary: secondary(40),
    onSecondary: secondary(100),
    secondaryContainer: secondary(90),
    onSecondaryContainer: secondary(10),
    tertiary: tertiary(40),
    onTertiary: tertiary(100),
    tertiaryContainer: tertiary(90),
    onTertiaryContainer: tertiary(10),
    error: error(40),
    onError: error(100),
    errorContainer: error(90),
    onErrorContainer: error(10),
    surface: neutral(98),
    onSurface: neutral(10),
    surfaceVariant: neutral(90),
    onSurfaceVariant: neutral(30),
    outline: neutral(50),
    outlineVariant: neutral(80),
    surfaceContainerLowest: neutral(100),
    surfaceContainerLow: neutral(96),
    surfaceContainer: neutral(94),
    surfaceContainerHigh: neutral(92),
    surfaceContainerHighest: neutral(90),
    inverseSurface: neutral(20),
    inverseOnSurface: neutral(95),
    inversePrimary: primary(80),
  };
}

/** The name of the CSS variable a role is written to. */
export function cssVariableName(role: string): string {
  return `--md-${role.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}
