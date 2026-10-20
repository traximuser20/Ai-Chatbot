#!/usr/bin/env python3
"""Exploratory renders of the OmniRoute mark so the shape can be judged visually."""
import math
import pathlib
import subprocess

from PIL import Image

OUT = pathlib.Path("/tmp/opencode")
OUT.mkdir(parents=True, exist_ok=True)

CX = CY = 256.0
HALF_DIAGONAL = 196.0
CORNER = 34.0


def rounded_rhombus(half=HALF_DIAGONAL, r=CORNER, cx=CX, cy=CY):
    """Path of a square rotated 45 degrees with rounded corners."""
    k = r / math.sqrt(2)  # trim along each edge
    t = cx, cy - half
    rgt = cx + half, cy
    b = cx, cy + half
    lft = cx - half, cy
    ctr = [
        (cx, cy - (half - r)),
        (cx + (half - r), cy),
        (cx, cy + (half - r)),
        (cx - (half - r), cy),
    ]
    verts = [t, rgt, b, lft]

    def unit(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy)
        return dx / n, dy / n

    nxt_pt, prev_pt = [], []
    for i, v in enumerate(verts):
        ux, uy = unit(v, verts[(i + 1) % 4])
        px, py = unit(v, verts[(i - 1) % 4])
        nxt_pt.append((v[0] + ux * k, v[1] + uy * k))
        prev_pt.append((v[0] + px * k, v[1] + py * k))

    f = lambda v: f"{v[0]:.2f} {v[1]:.2f}"
    d = [f"M {f(nxt_pt[0])}"]
    for i in range(4):
        j = (i + 1) % 4
        d.append(f"L {f(prev_pt[j])}")
        d.append(f"A {r} {r} 0 0 1 {f(nxt_pt[j])}")
    d.append("Z")
    return " ".join(d)


PATH = rounded_rhombus()
print("path:", PATH)

SPECTRUM = [("0%", "#3E68F9"), ("42%", "#7C4DFF"), ("100%", "#22D3EE")]
WASH = [("0%", 1.0), ("26%", 0.92), ("52%", 0.18), ("100%", 0.0)]


def defs(extra=""):
    return f"""<defs>
  <linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="1">
    {''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in SPECTRUM)}
  </linearGradient>
  <linearGradient id="wash" x1="0" y1="0" x2="0.78" y2="0.78">
    {''.join(f'<stop offset="{o}" stop-color="#FFFFFF" stop-opacity="{a}"/>' for o, a in WASH)}
  </linearGradient>
  <path id="prism" d="{PATH}"/>
  <clipPath id="clipPrism"><use xlink:href="#prism"/></clipPath>
  {extra}
</defs>"""


def svg(body, bg=None):
    b = f'<rect width="512" height="512" fill="{bg}"/>' if bg else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
{defs()}{b}
{body}
</svg>"""


VARIANTS = {
    # E: gradient prism, white beam clipped inside, soft wash at the entry corner
    "e": svg(
        """<use xlink:href="#prism" fill="url(#spectrum)"/>
<g clip-path="url(#clipPrism)">
  <use xlink:href="#prism" fill="url(#wash)"/>
  <rect x="-20" y="216" width="552" height="80" fill="#FFFFFF" opacity="0.95" transform="rotate(45 256 256)"/>
</g>"""
    ),
    # F: gradient prism only, no beam
    "f": svg("""<use xlink:href="#prism" fill="url(#spectrum)"/>"""),
    # G: gradient prism, beam only (no wash)
    "g": svg(
        """<use xlink:href="#prism" fill="url(#spectrum)"/>
<g clip-path="url(#clipPrism)">
  <rect x="-20" y="216" width="552" height="80" fill="#FFFFFF" opacity="0.95" transform="rotate(45 256 256)"/>
</g>"""
    ),
    # H: gradient prism, wash + a thin sharp beam
    "h": svg(
        """<use xlink:href="#prism" fill="url(#spectrum)"/>
<g clip-path="url(#clipPrism)">
  <use xlink:href="#prism" fill="url(#wash)"/>
  <rect x="-20" y="228" width="552" height="56" fill="#FFFFFF" opacity="0.97" transform="rotate(45 256 256)"/>
</g>"""
    ),
}

for name, content in VARIANTS.items():
    svg_path = OUT / f"variant_{name}.svg"
    png_path = OUT / f"variant_{name}.png"
    svg_path.write_text(content)
    subprocess.run(
        ["rsvg-convert", "-w", "512", "-h", "512", "-o", str(png_path), str(svg_path)],
        check=True,
    )

# contact sheet on paper, plus a small-size row
names = ["e", "f", "g", "h"]
sheet = Image.new("RGBA", (512 * 4 + 150, 512 + 80), (242, 243, 246, 255))
for i, n in enumerate(names):
    im = Image.open(OUT / f"variant_{n}.png").convert("RGBA")
    sheet.alpha_composite(im, (30 + i * 522, 40))
sheet.save(OUT / "sheet2.png")

small = Image.new("RGBA", (900, 200), (242, 243, 246, 255))
for i, n in enumerate(["e", "f", "g", "h"]):
    im = Image.open(OUT / f"variant_{n}.png").convert("RGBA")
    for j, s in enumerate((96, 48, 24)):
        r = im.resize((s, s), Image.LANCZOS)
        small.alpha_composite(r, (30 + i * 220 + j * 110, 40 + (96 - s)))
small.save(OUT / "sheet2_small.png")
print("ok")
