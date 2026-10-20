#!/usr/bin/env python3
"""
OmniRoute brand assets.

The mark - "The Prism" - is a rounded square rotated 45 degrees (the same
diamond the app already uses as its glyph, U+25C8) filled with the brand
spectrum, crossed by a single white beam: one request in, one answer out.

Everything here is generated from one description of the geometry so the
SVG sources, the runtime PNGs and the platform icons can never drift apart.

    python3 design/logo/build_assets.py
"""
from __future__ import annotations

import math
import pathlib
import subprocess
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
DESIGN = ROOT / "design" / "logo"
RUNTIME = ROOT / "src" / "assets" / "img"
ANDROID_RES = ROOT / "App_Resources" / "Android" / "src" / "main" / "res"
IOS_ICONS = ROOT / "App_Resources" / "iOS" / "Assets.xcassets" / "AppIcon.appiconset"

# --------------------------------------------------------------------------
# Brand tokens
# --------------------------------------------------------------------------
COBALT = "#2F55F5"     # primary - the app's own default accent
IRIS = "#6D3BF5"      # mid stop
CYAN = "#0FB6D6"      # the live-route accent
INK = "#0E111B"       # deep ground
INK_2 = "#171B2B"     # raised ground
PAPER = "#F2F3F6"     # app canvas
BEAM = "#FFFFFF"      # the light beam

SPECTRUM = [(0.0, COBALT), (0.38, IRIS), (1.0, CYAN)]

# --------------------------------------------------------------------------
# Geometry of the mark
# --------------------------------------------------------------------------
CANVAS = 512
CX = CY = 256.0
HALF_DIAGONAL = 196.0   # outer half diagonal of the rotated square
CORNER = 34.0           # corner radius
BEAM_WIDTH = 52.0       # width of the light beam
BEAM_GLOW = 112.0       # width of the soft bloom around the beam


def rounded_rhombus(half=HALF_DIAGONAL, r=CORNER, cx=CX, cy=CY) -> str:
    """Path of a square rotated 45 degrees with rounded corners."""
    k = r / math.sqrt(2)
    verts = [
        (cx, cy - half),
        (cx + half, cy),
        (cx, cy + half),
        (cx - half, cy),
    ]

    def unit(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy)
        return dx / n, dy / n

    nxt, prv = [], []
    for i, v in enumerate(verts):
        ux, uy = unit(v, verts[(i + 1) % 4])
        px, py = unit(v, verts[(i - 1) % 4])
        nxt.append((v[0] + ux * k, v[1] + uy * k))
        prv.append((v[0] + px * k, v[1] + py * k))

    f = lambda v: f"{v[0]:.2f} {v[1]:.2f}"
    d = [f"M {f(nxt[0])}"]
    for i in range(4):
        j = (i + 1) % 4
        d.append(f"L {f(prv[j])}")
        d.append(f"A {r:.2f} {r:.2f} 0 0 1 {f(nxt[j])}")
    d.append("Z")
    return " ".join(d)


PRISM_PATH = rounded_rhombus()


def spectrum_stops(stops=SPECTRUM, opacity=None):
    out = []
    for offset, color in stops:
        if opacity is None:
            out.append(f'<stop offset="{offset}" stop-color="{color}"/>')
        else:
            out.append(
                f'<stop offset="{offset}" stop-color="{color}" stop-opacity="{opacity}"/>'
            )
    return "".join(out)


def beam_rect(width: float, color: str, opacity: float) -> str:
    return (
        f'<rect x="-140" y="{CY - width / 2:.2f}" width="792" height="{width:.2f}" '
        f'fill="{color}" opacity="{opacity}" transform="rotate(45 {CX} {CY})"/>'
    )


# --------------------------------------------------------------------------
# SVG sources
# --------------------------------------------------------------------------
def svg_mark(body: str, defs_extra: str = "") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {CANVAS} {CANVAS}" width="{CANVAS}" height="{CANVAS}">
  <defs>
    <linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="1">{spectrum_stops()}</linearGradient>
    <path id="prism" d="{PRISM_PATH}"/>
    <clipPath id="clipPrism"><use xlink:href="#prism"/></clipPath>
    {defs_extra}
  </defs>
{body}
</svg>
"""


MARK_SVG = svg_mark(
    f"""  <use xlink:href="#prism" fill="url(#spectrum)"/>
  <g clip-path="url(#clipPrism)">
    {beam_rect(BEAM_GLOW, BEAM, 0.20)}
    {beam_rect(BEAM_WIDTH, BEAM, 0.97)}
  </g>"""
)

# The beam on its own, so the splash screen can breathe it independently.
BEAM_SVG = svg_mark(
    f"""  <g clip-path="url(#clipPrism)">
    {beam_rect(BEAM_GLOW, BEAM, 0.22)}
    {beam_rect(BEAM_WIDTH, BEAM, 1)}
  </g>"""
)

# The plain diamond: for very small sizes where a beam only adds noise.
GLYPH_SVG = svg_mark('  <use xlink:href="#prism" fill="url(#spectrum)"/>')

# A single-colour version for print and tiny monochrome uses.
MONO_SVG = svg_mark(
    f"""  <use xlink:href="#prism" fill="{COBALT}"/>
  <g clip-path="url(#clipPrism)">
    {beam_rect(BEAM_WIDTH, BEAM, 1)}
  </g>"""
)


def radial_svg(stops, size=512, cx=0.5, cy=0.5, r=0.5) -> str:
    body = "".join(
        f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    <radialGradient id="g" cx="{cx}" cy="{cy}" r="{r}">
      {body}
    </radialGradient>
  </defs>
  <rect width="{size}" height="{size}" fill="url(#g)"/>
</svg>
"""


# A soft bloom that sits behind the mark.
GLOW_SVG = radial_svg(
    [
        (0.0, COBALT, 0.95),
        (0.30, IRIS, 0.55),
        (0.58, CYAN, 0.22),
        (1.0, CYAN, 0.0),
    ],
    size=512,
)

# Two slow drifting aurora blobs.
AURORA_A_SVG = radial_svg(
    [
        (0.0, "#5B7CFF", 0.85),
        (0.38, "#6D3BF5", 0.38),
        (0.72, "#6D3BF5", 0.10),
        (1.0, "#6D3BF5", 0.0),
    ],
    size=512,
)
AURORA_B_SVG = radial_svg(
    [
        (0.0, "#22D3EE", 0.70),
        (0.40, "#2F55F5", 0.30),
        (0.74, "#2F55F5", 0.08),
        (1.0, "#2F55F5", 0.0),
    ],
    size=512,
)

# A hairline technical grid - the "routing diagram" texture.
GRID_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <g stroke="#FFFFFF" stroke-width="1" fill="none" opacity="0.1">
    <path d="M0 0.5 H256 M0 32.5 H256 M0 64.5 H256 M0 96.5 H256 M0 128.5 H256 M0 160.5 H256 M0 192.5 H256 M0 224.5 H256"/>
    <path d="M0.5 0 V256 M32.5 0 V256 M64.5 0 V256 M96.5 0 V256 M128.5 0 V256 M160.5 0 V256 M192.5 0 V256 M224.5 0 V256"/>
  </g>
  <g fill="#FFFFFF" opacity="0.16">
    <circle cx="32.5" cy="32.5" r="1.6"/>
    <circle cx="160.5" cy="96.5" r="1.6"/>
    <circle cx="96.5" cy="192.5" r="1.6"/>
    <circle cx="224.5" cy="160.5" r="1.6"/>
  </g>
</svg>
"""


def render(svg_text: str, out_png: pathlib.Path, size: int) -> None:
    tmp = out_png.with_suffix(".tmp.svg")
    tmp.write_text(svg_text)
    subprocess.run(
        [
            "rsvg-convert",
            "-w", str(size),
            "-h", str(size),
            "-o", str(out_png),
            str(tmp),
        ],
        check=True,
    )
    tmp.unlink()


def render_rect(svg_text: str, out_png: pathlib.Path, w: int, h: int) -> None:
    tmp = out_png.with_suffix(".tmp.svg")
    tmp.write_text(svg_text)
    subprocess.run(
        ["rsvg-convert", "-w", str(w), "-h", str(h), "-o", str(out_png), str(tmp)],
        check=True,
    )
    tmp.unlink()


# --------------------------------------------------------------------------
# The launcher icon: an ink tile with the mark on it
# --------------------------------------------------------------------------
def tile_svg(size: int, padding_ratio: float = 0.195, rounded: bool = True) -> str:
    """The legacy launcher icon: a deep tile carrying the mark."""
    pad = size * padding_ratio
    inner = size - pad * 2
    scale = inner / 512.0
    radius = size * 0.225 if rounded else 0
    body = f"""  <g transform="translate({pad} {pad}) scale({scale})">
    <use xlink:href="#prism" fill="url(#spectrum)"/>
    <g clip-path="url(#clipPrism)">
      {beam_rect(BEAM_GLOW, BEAM, 0.20)}
      {beam_rect(BEAM_WIDTH, BEAM, 0.97)}
    </g>
  </g>"""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1B2138"/>
      <stop offset="0.55" stop-color="{INK}"/>
      <stop offset="1" stop-color="#0A0D16"/>
    </linearGradient>
    <linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="1">{spectrum_stops()}</linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.44" r="0.5">
      <stop offset="0" stop-color="{IRIS}" stop-opacity="0.80"/>
      <stop offset="0.5" stop-color="{IRIS}" stop-opacity="0.26"/>
      <stop offset="1" stop-color="{IRIS}" stop-opacity="0"/>
    </radialGradient>
    <path id="prism" d="{PRISM_PATH}"/>
    <clipPath id="clipPrism"><use xlink:href="#prism"/></clipPath>
  </defs>
  <rect width="{size}" height="{size}" rx="{radius}" ry="{radius}" fill="url(#tile)"/>
  <circle cx="{size / 2}" cy="{size * 0.46}" r="{size * 0.44}" fill="url(#halo)"/>
{body}
</svg>
"""


def adaptive_foreground_svg(size: int) -> str:
    """Adaptive icon foreground: the mark inside the 66% safe zone."""
    inner = size * 0.52
    scale = inner / 512.0
    pad = (size - inner) / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    <linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="1">{spectrum_stops()}</linearGradient>
    <path id="prism" d="{PRISM_PATH}"/>
    <clipPath id="clipPrism"><use xlink:href="#prism"/></clipPath>
  </defs>
  <g transform="translate({pad} {pad}) scale({scale})">
    <use xlink:href="#prism" fill="url(#spectrum)"/>
    <g clip-path="url(#clipPrism)">
      {beam_rect(BEAM_GLOW, BEAM, 0.22)}
      {beam_rect(BEAM_WIDTH, BEAM, 0.98)}
    </g>
  </g>
</svg>
"""


def adaptive_background_svg(size: int) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1B2138"/>
      <stop offset="0.55" stop-color="{INK}"/>
      <stop offset="1" stop-color="#0A0D16"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.46" r="0.5">
      <stop offset="0" stop-color="{IRIS}" stop-opacity="0.5"/>
      <stop offset="0.6" stop-color="{IRIS}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="{IRIS}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{size}" height="{size}" fill="url(#tile)"/>
  <circle cx="{size / 2}" cy="{size * 0.46}" r="{size * 0.46}" fill="url(#halo)"/>
</svg>
"""


def optimize(path: pathlib.Path) -> None:
    """Quantize a smooth gradient down to a palette: smaller and faster to decode."""
    with Image.open(path) as img:
        rgba = img.convert("RGBA")
        quantized = rgba.quantize(colors=192, method=Image.FASTOCTREE)
        quantized.save(path, optimize=True)


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------
ANDROID_DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# Adaptive icons are 108dp: 108, 162, 216, 324, 432.
ADAPTIVE_DENSITIES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

IOS_ICON_SIZES = {
    "icon-20.png": 20,
    "icon-20@2x.png": 40,
    "icon-20@3x.png": 60,
    "icon-29.png": 29,
    "icon-29@2x.png": 58,
    "icon-29@3x.png": 87,
    "icon-40.png": 40,
    "icon-40@2x.png": 80,
    "icon-40@3x.png": 120,
    "icon-60.png": 60,
    "icon-60@2x.png": 120,
    "icon-60@3x.png": 180,
    "icon-76.png": 76,
    "icon-76@2x.png": 152,
    "icon-83.5@2x.png": 167,
    "icon-1024.png": 1024,
}


def main() -> int:
    DESIGN.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)

    # 1. SVG sources -------------------------------------------------------
    (DESIGN / "omni-prism.svg").write_text(MARK_SVG)
    (DESIGN / "omni-prism-beam.svg").write_text(BEAM_SVG)
    (DESIGN / "omni-prism-glyph.svg").write_text(GLYPH_SVG)
    (DESIGN / "omni-prism-mono.svg").write_text(MONO_SVG)
    (DESIGN / "glow.svg").write_text(GLOW_SVG)
    (DESIGN / "aurora-a.svg").write_text(AURORA_A_SVG)
    (DESIGN / "aurora-b.svg").write_text(AURORA_B_SVG)
    (DESIGN / "grid.svg").write_text(GRID_SVG)

    # 2. Runtime images ----------------------------------------------------
    render(MARK_SVG, RUNTIME / "prism.png", 512)
    render(BEAM_SVG, RUNTIME / "prism-beam.png", 512)
    render(GLYPH_SVG, RUNTIME / "prism-glyph.png", 256)
    render(GLOW_SVG, RUNTIME / "prism-glow.png", 512)
    render(AURORA_A_SVG, RUNTIME / "aurora-a.png", 512)
    render(AURORA_B_SVG, RUNTIME / "aurora-b.png", 512)
    render_rect(GRID_SVG, RUNTIME / "grid.png", 256, 256)

    # 3. Android launcher icons -------------------------------------------
    for density, size in ANDROID_DENSITIES.items():
        folder = ANDROID_RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        render(tile_svg(size), folder / "ic_launcher.png", size)

    for density, size in ADAPTIVE_DENSITIES.items():
        folder = ANDROID_RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        render(adaptive_foreground_svg(size), folder / "ic_launcher_foreground.png", size)
        render(adaptive_background_svg(size), folder / "ic_launcher_background.png", size)

    # 4. Android native splash --------------------------------------------
    for density, size in {
        "mdpi": 320,
        "hdpi": 480,
        "xhdpi": 640,
        "xxhdpi": 800,
        "xxxhdpi": 960,
    }.items():
        folder = ANDROID_RES / f"drawable-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        render(
            f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1B2138"/>
      <stop offset="0.55" stop-color="{INK}"/>
      <stop offset="1" stop-color="#0A0D16"/>
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" fill="url(#tile)"/>
</svg>""",
            folder / "background.png",
            size,
        )

    # The mark for the native splash screen (used by splash_screen.xml).
    for density, size in {
        "mdpi": 96,
        "hdpi": 144,
        "xhdpi": 192,
        "xxhdpi": 288,
        "xxxhdpi": 384,
    }.items():
        folder = ANDROID_RES / f"drawable-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        render(MARK_SVG, folder / "logo.png", size)

    # 5. iOS icons ---------------------------------------------------------
    IOS_ICONS.mkdir(parents=True, exist_ok=True)
    for name, size in IOS_ICON_SIZES.items():
        render(tile_svg(size, padding_ratio=0.215), IOS_ICONS / name, size)

    print("brand assets written")
    for p in sorted(RUNTIME.glob("*.png")):
        print(f"  {p.relative_to(ROOT)}  {p.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
