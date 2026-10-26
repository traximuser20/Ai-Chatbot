#!/usr/bin/env python3
"""
Omni Ai Brand Assets - Full-Circle Omni Sphere Design.

The mark - "The Omni Sphere" - is a radiant, full-circle multi-spectral AI orb:
- A full-circle canvas filled edge-to-edge (takes the complete icon circle)
- 6 sweeping aperture blades with rich spectral gradients (Cyan -> Azure -> Cobalt -> Violet -> Magenta -> Rose)
- Concentric celestial harmonizer rings forming the "O" (Omni)
- A piercing 45-degree light beam (the signature gateway request/response prism beam)
- A brilliant 4-point AI singularity core spark at the center
- A 3D tactile glass dome specular highlight

Everything is generated here so SVG sources, runtime PNGs, and Android launcher
icons stay in perfect geometric alignment.

    python3 design/logo/build-assets.py
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
# Brand tokens & Spectral Palette
# --------------------------------------------------------------------------
COBALT = "#2F55F5"
IRIS = "#6D3BF5"
CYAN = "#00F5FF"
INK = "#050713"
INK_2 = "#0C1124"
BEAM = "#FFFFFF"

# 6 spectral color stops for the aperture blades
PETAL_STOPS = [
    ("g0", "#00F5FF", "#0284C7"),   # Electric Cyan -> Deep Sky
    ("g1", "#38BDF8", "#2563EB"),   # Azure -> Cobalt
    ("g2", "#60A5FA", "#4F46E5"),   # Royal Blue -> Indigo
    ("g3", "#818CF8", "#7C3AED"),   # Indigo -> Deep Violet
    ("g4", "#C084FC", "#C026D3"),   # Vivid Purple -> Fuchsia
    ("g5", "#F472B6", "#E11D48"),   # Rose -> Crimson Coral
]

CANVAS = 512
CX = CY = 256.0
R = 252.0  # Full circle radius

def build_defs(scale: float = 1.0, cx: float = CX, cy: float = CY, r: float = R) -> str:
    """Build shared SVG gradient and filter definitions."""
    petal_defs = "\n".join([
        f"""    <linearGradient id="{gid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c1}"/>
      <stop offset="100%" stop-color="{c2}"/>
    </linearGradient>"""
        for gid, c1, c2 in PETAL_STOPS
    ])

    return f"""
    <!-- Deep Cosmic Space Base -->
    <radialGradient id="spaceBase" cx="50%" cy="50%" r="68%">
      <stop offset="0%" stop-color="#141E46"/>
      <stop offset="55%" stop-color="#0A0F26"/>
      <stop offset="100%" stop-color="#040612"/>
    </radialGradient>

    <!-- Outer Rim Luminescence -->
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00F5FF"/>
      <stop offset="33%" stop-color="#818CF8"/>
      <stop offset="66%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#00F5FF"/>
    </linearGradient>

    {petal_defs}

    <!-- Central Singularity Glow -->
    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="25%" stop-color="#BAE6FD" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#38BDF8" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
    </radialGradient>

    <!-- Beam Gradient -->
    <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="30%" stop-color="#BAE6FD" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="70%" stop-color="#BAE6FD" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.05"/>
    </linearGradient>

    <!-- Glass Specular Highlight -->
    <linearGradient id="glassSheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.38"/>
      <stop offset="30%" stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>

    <clipPath id="circleClip">
      <circle cx="{cx}" cy="{cy}" r="{r}"/>
    </clipPath>"""


def sphere_layers(scale: float = 1.0, cx: float = CX, cy: float = CY, r: float = R, with_beam: bool = True) -> str:
    """Generate the inner sphere layers: aperture blades, rings, beam, spark."""
    # 6 Sweeping Aperture Blades
    petal_path = "M 256,256 C 256,120 340,30 450,75 C 500,165 420,256 256,256 Z"
    blades = []
    for i in range(6):
        angle = i * 60
        gid = f"g{i}"
        blades.append(
            f'<path d="{petal_path}" fill="url(#{gid})" opacity="0.82" transform="rotate({angle} 256 256)"/>'
        )
    blades_svg = "\n    ".join(blades)

    beam_svg = ""
    if with_beam:
        beam_svg = """
    <!-- Diagonal Radiant Request/Response Light Beam -->
    <rect x="-80" y="243" width="672" height="26" fill="#38BDF8" opacity="0.4" transform="rotate(-45 256 256)"/>
    <rect x="-80" y="249" width="672" height="14" fill="url(#beamGrad)" transform="rotate(-45 256 256)"/>
    <rect x="-80" y="253" width="672" height="6" fill="#FFFFFF" opacity="0.98" transform="rotate(-45 256 256)"/>"""

    return f"""
    <!-- 6 Sweeping Aperture Blades -->
    {blades_svg}

    <!-- Concentric Celestial Harmonizer Rings -->
    <circle cx="256" cy="256" r="160" fill="none" stroke="url(#rimGrad)" stroke-width="6" opacity="0.85"/>
    <circle cx="256" cy="256" r="144" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.5"/>
    <circle cx="256" cy="256" r="176" fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="14 10" opacity="0.5"/>

    {beam_svg}

    <!-- Core AI Singularity / 4-Point Starburst -->
    <circle cx="256" cy="256" r="85" fill="url(#centerGlow)"/>
    <polygon points="256,190 268,244 322,256 268,268 256,322 244,268 190,256 244,244" fill="#FFFFFF"/>
    <polygon points="256,216 265,247 296,256 265,265 256,296 247,265 216,256 247,247" fill="#E0F2FE" opacity="0.9"/>
    <circle cx="256" cy="256" r="15" fill="#FFFFFF"/>

    <!-- Glass Dome Highlight -->
    <path d="M 20,240 C 35,120 130,20 256,20 C 382,20 477,120 492,240 C 430,130 350,70 256,70 C 162,70 82,130 20,240 Z"
          fill="url(#glassSheen)"/>"""


# --------------------------------------------------------------------------
# Primary SVG Sources
# --------------------------------------------------------------------------

# Full-circle Omni Sphere Mark
MARK_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {CANVAS} {CANVAS}" width="{CANVAS}" height="{CANVAS}">
  <defs>
    {build_defs()}
  </defs>
  <!-- Full Circle Base -->
  <circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#spaceBase)" stroke="url(#rimGrad)" stroke-width="2.5"/>
  <g clip-path="url(#circleClip)">
    {sphere_layers()}
  </g>
</svg>
"""

# The standalone beam (for independent splash screen animation)
BEAM_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {CANVAS} {CANVAS}" width="{CANVAS}" height="{CANVAS}">
  <defs>
    {build_defs()}
  </defs>
  <g clip-path="url(#circleClip)">
    <rect x="-80" y="243" width="672" height="26" fill="#38BDF8" opacity="0.4" transform="rotate(-45 256 256)"/>
    <rect x="-80" y="249" width="672" height="14" fill="url(#beamGrad)" transform="rotate(-45 256 256)"/>
    <rect x="-80" y="253" width="672" height="6" fill="#FFFFFF" opacity="0.98" transform="rotate(-45 256 256)"/>
    <circle cx="{CX}" cy="{CY}" r="85" fill="url(#centerGlow)"/>
  </g>
</svg>
"""

# High-contrast Glyph for small UI sizes (24dp - 48dp)
GLYPH_SVG = MARK_SVG

# Monochrome Stencil for print / small monochrome uses
MONO_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}" width="{CANVAS}" height="{CANVAS}">
  <circle cx="{CX}" cy="{CY}" r="{R}" fill="{COBALT}"/>
  <circle cx="{CX}" cy="{CY}" r="160" fill="none" stroke="#FFFFFF" stroke-width="8"/>
  <polygon points="256,190 268,244 322,256 268,268 256,322 244,268 190,256 244,244" fill="#FFFFFF"/>
  <rect x="-80" y="250" width="672" height="12" fill="#FFFFFF" transform="rotate(-45 256 256)"/>
</svg>
"""


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


# Radiant multi-spectrum glow
GLOW_SVG = radial_svg(
    [
        (0.0, "#00F5FF", 0.95),
        (0.28, "#2F55F5", 0.65),
        (0.55, "#7C3AED", 0.30),
        (0.78, "#EC4899", 0.12),
        (1.0, "#000000", 0.0),
    ],
    size=512,
)

AURORA_A_SVG = radial_svg(
    [
        (0.0, "#38BDF8", 0.85),
        (0.38, "#6366F1", 0.38),
        (0.72, "#7C3AED", 0.10),
        (1.0, "#7C3AED", 0.0),
    ],
    size=512,
)

AURORA_B_SVG = radial_svg(
    [
        (0.0, "#00F5FF", 0.70),
        (0.40, "#2563EB", 0.30),
        (0.74, "#1E1B4B", 0.08),
        (1.0, "#000000", 0.0),
    ],
    size=512,
)


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


# --------------------------------------------------------------------------
# Launcher Icon Generators (Takes Full Icon Circle)
# --------------------------------------------------------------------------

def full_circle_launcher_svg(size: int) -> str:
    """The legacy/standalone launcher icon: takes the full icon circle edge-to-edge."""
    scale = size / 512.0
    r = (size / 2.0) - 1.5
    cx = cy = size / 2.0
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    {build_defs(scale, cx, cy, r)}
  </defs>
  <circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#spaceBase)" stroke="url(#rimGrad)" stroke-width="{max(1.5, 2.5 * scale):.1f}"/>
  <g clip-path="url(#circleClip)">
    <g transform="scale({scale:.5f})">
      {sphere_layers()}
    </g>
  </g>
</svg>
"""


def adaptive_background_svg(size: int) -> str:
    """Adaptive icon background: cosmic depth with soft halo filling the 108dp canvas."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    <radialGradient id="adBg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#141E46"/>
      <stop offset="45%" stop-color="#0A0F26"/>
      <stop offset="100%" stop-color="#040612"/>
    </radialGradient>
    <radialGradient id="adHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="#7C3AED" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{size}" height="{size}" fill="url(#adBg)"/>
  <circle cx="{size / 2}" cy="{size / 2}" r="{size * 0.48}" fill="url(#adHalo)"/>
</svg>
"""


def adaptive_foreground_svg(size: int) -> str:
    """
    Adaptive icon foreground:
    Scaled to occupy the 72dp (66%-70%) safe circle zone completely,
    so when Android cuts it into a circle, the emblem takes the FULL CIRCLE.
    """
    # Safe zone diameter is 72dp on 108dp canvas (0.666).
    # Radius = size * 0.355 touches the circular mask edge-to-edge.
    inner = size * 0.72
    scale = inner / 512.0
    pad = (size - inner) / 2.0
    r = (inner / 2.0) - 1.0
    cx = cy = inner / 2.0

    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <defs>
    {build_defs(scale, cx, cy, r)}
  </defs>
  <g transform="translate({pad:.2f} {pad:.2f})">
    <circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="url(#spaceBase)" stroke="url(#rimGrad)" stroke-width="{max(1.5, 2.5 * scale):.1f}"/>
    <g clip-path="url(#circleClip)">
      <g transform="scale({scale:.5f})">
        {sphere_layers()}
      </g>
    </g>
  </g>
</svg>
"""


def adaptive_monochrome_svg(size: int) -> str:
    """Themed-icon layer for Android 13+ Material You."""
    inner = size * 0.72
    scale = inner / 512.0
    pad = (size - inner) / 2.0

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <g transform="translate({pad:.2f} {pad:.2f}) scale({scale:.5f})">
    <circle cx="256" cy="256" r="250" fill="#ffffff" opacity="0.25"/>
    <circle cx="256" cy="256" r="160" fill="none" stroke="#ffffff" stroke-width="12"/>
    <polygon points="256,190 268,244 322,256 268,268 256,322 244,268 190,256 244,244" fill="#ffffff"/>
    <rect x="-80" y="248" width="672" height="16" fill="#ffffff" transform="rotate(-45 256 256)"/>
    <circle cx="256" cy="256" r="24" fill="#ffffff"/>
  </g>
</svg>
"""


def optimize(path: pathlib.Path) -> None:
    """Quantize a smooth gradient down to a palette: smaller and faster to decode."""
    with Image.open(path) as img:
        rgba = img.convert("RGBA")
        quantized = rgba.quantize(colors=192, method=Image.FASTOCTREE)
        quantized.save(path, optimize=True)


# --------------------------------------------------------------------------
# Build Routine
# --------------------------------------------------------------------------
ANDROID_DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

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

    # 1. SVG sources
    (DESIGN / "omni-prism.svg").write_text(MARK_SVG)
    (DESIGN / "omni-prism-beam.svg").write_text(BEAM_SVG)
    (DESIGN / "omni-prism-glyph.svg").write_text(GLYPH_SVG)
    (DESIGN / "omni-prism-mono.svg").write_text(MONO_SVG)
    (DESIGN / "glow.svg").write_text(GLOW_SVG)
    (DESIGN / "aurora-a.svg").write_text(AURORA_A_SVG)
    (DESIGN / "aurora-b.svg").write_text(AURORA_B_SVG)

    # 2. Runtime images
    render(MARK_SVG, RUNTIME / "prism.png", 512)
    render(BEAM_SVG, RUNTIME / "prism-beam.png", 512)
    render(GLYPH_SVG, RUNTIME / "prism-glyph.png", 256)
    render(GLOW_SVG, RUNTIME / "prism-glow.png", 512)
    render(AURORA_A_SVG, RUNTIME / "aurora-a.png", 512)
    render(AURORA_B_SVG, RUNTIME / "aurora-b.png", 512)

    for name in ("prism-glow.png", "aurora-a.png", "aurora-b.png"):
        optimize(RUNTIME / name)

    # 3. Android launcher icons (Full Circle)
    for density, size in ANDROID_DENSITIES.items():
        folder = ANDROID_RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        render(full_circle_launcher_svg(size), folder / "ic_launcher.png", size)
        # Also create round icon for devices requesting ic_launcher_round
        render(full_circle_launcher_svg(size), folder / "ic_launcher_round.png", size)

    for density, size in ADAPTIVE_DENSITIES.items():
        folder = ANDROID_RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        render(adaptive_foreground_svg(size), folder / "ic_launcher_foreground.png", size)
        render(adaptive_background_svg(size), folder / "ic_launcher_background.png", size)
        render(adaptive_monochrome_svg(size), folder / "ic_launcher_monochrome.png", size)

    # 4. Android native splash
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
      <stop offset="0" stop-color="#141E46"/>
      <stop offset="0.55" stop-color="#0A0F26"/>
      <stop offset="1" stop-color="#040612"/>
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" fill="url(#tile)"/>
</svg>""",
            folder / "background.png",
            size,
        )

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

    # 5. iOS icons
    IOS_ICONS.mkdir(parents=True, exist_ok=True)
    for name, size in IOS_ICON_SIZES.items():
        render(full_circle_launcher_svg(size), IOS_ICONS / name, size)

    print("Brand assets successfully generated!")
    for p in sorted(RUNTIME.glob("*.png")):
        print(f"  {p.relative_to(ROOT)}  {p.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
