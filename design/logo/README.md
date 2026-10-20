# The OmniRoute mark

Everything in this folder is generated. Edit `build-assets.py`, run it, and the
SVG sources, the runtime PNGs and every platform icon are rewritten from the
same description of the geometry.

```bash
python3 design/logo/build-assets.py
```

## The idea

The app already used `◈` (U+25C8, a diamond) as its brand glyph, so the mark
is that diamond made literal: a square rotated 45 degrees with rounded
corners, filled with the brand spectrum and crossed by a single white beam.

The beam is the whole idea - **one request in, one answer out**. It is also
what turns a flat gradient diamond into a prism, which is why the mark reads
as a light beam rather than as a decorative slash.

## Files

| File | Use |
| :--- | :--- |
| `omni-prism.svg` | The mark. Gradient diamond plus the beam. |
| `omni-prism-beam.svg` | The beam alone, clipped to the mark. The splash screen breathes it independently of the diamond. |
| `omni-prism-glyph.svg` | The plain diamond, no beam. For sizes where a 52 px wide beam would only be noise (the sidebar brand). |
| `omni-prism-mono.svg` | Single colour version, for print and favicons. |
| `glow.svg`, `aurora-a.svg`, `aurora-b.svg` | The light around the mark: one bloom and two slow drifting blobs. |
| `grid.svg` | The hairline technical grid that gives the splash screen its "routing diagram" texture. |

## Palette

| Token | Hex | Role |
| :--- | :--- | :--- |
| `cobalt` | `#2F55F5` | Primary. The app's own default accent. |
| `iris` | `#6D3BF5` | Mid stop of the spectrum. |
| `cyan` | `#0FB6D6` | The live-route accent. |
| `ink` | `#0E111B` | Deep ground for the ink surfaces. |
| `paper` | `#F2F3F6` | The app canvas. |
| `splash ink` | `#0B0E17` | The launch screen ground. |

The tokens live in `src/utils/accent.ts` as `BRAND` so the app and the assets
cannot drift apart.

## Geometry

The mark is a square rotated 45 degrees, described by three numbers in
`build-assets.py`:

- `HALF_DIAGONAL = 196` - the distance from the centre to a corner.
- `CORNER = 34` - the corner radius.
- `BEAM_WIDTH = 52` - the width of the light beam.

The rounded corners are produced by stroking the *inset* centreline of the
square with a round join, which is the same shape as a square offset by a
disc of radius `CORNER` - without having to spell out four arcs.

## Where the assets end up

| Target | What |
| :--- | :--- |
| `src/assets/img/` | The runtime images the app loads. |
| `App_Resources/Android/.../mipmap-*` | The launcher icon (legacy tile and adaptive foreground/background). |
| `App_Resources/Android/.../drawable-*/logo.png` | The mark for the native launch screen. |
| `App_Resources/Android/.../drawable-*/splash_icon.png` | The Android 12+ launch screen icon. It is drawn on its own, sized to the inner two thirds of the system splash canvas, so the system mask never clips the diamond. |
| `App_Resources/iOS/.../AppIcon.appiconset` | The iOS icon set. |

## The splash screen

`src/components/SplashScreen.vue` plays the mark:

1. The system launch screen shows the ink ground and the mark.
2. The app takes over with the same ground, so the hand-over is invisible.
3. The grid, the aurora blobs and the two orbit rings drift in.
4. The mark scales up out of the glow while its beam pulses.
5. The wordmark, the eyebrow and the live gateway state rise into place.
6. The exit is a two stage crossfade: the ink field dissolves into the paper
   colour the app uses, and only then does the paper dissolve into the chat
   screen. Nothing of the app is ever visible through the ink, so text never
   sits on top of text.

The entrance beats are CSS keyframes with `animation-delay`; the exit is
driven through the NativeScript animation API so it can be sequenced
precisely. The whole timeline is anchored to the native `loaded` event, not
to the Vue mount - on a slow device those are seconds apart.
