#!/usr/bin/env python3
"""Second exploration round: negative-space marks that read on any background."""
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


def grad(idname, stops, x1=0, y1=0, x2=1, y2=1):
    body = "".join(
        f'<stop offset="{o}" stop-color="{c}"' + ("" if a is None else f' stop-opacity="{a}"') + "/>"
        for o, c, a in stops
    )
    return (
        f'<linearGradient id="{idname}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{body}</linearGradient>'
    )


SPECTRUM = [("0%", "#3E68F9", None), ("42%", "#7C4DFF", None), ("100%", "#22D3EE", None)]
SPECTRUM_V = [("0%", "#3E68F9", None), ("45%", "#7C4DFF", None), ("100%", "#1FB6D9", None)]
INK = "#0E111B"

# A diagonal channel, expressed as a rotated rectangle in the mark's own space.
CHANNEL = '<rect x="-60" y="222" width="632" height="68" fill="#000" transform="rotate(45 256 256)"/>'


def defs(extra=""):
    return f"""<defs>
  {grad("spectrum", SPECTRUM)}
  {grad("spectrumV", SPECTRUM_V, 0, 0, 0, 1)}
  <mask id="cut"><rect width="512" height="512" fill="#fff"/>{CHANNEL}</mask>
  <path id="prism" d="{PATH}"/>
  {extra}
</defs>"""


def svg(body, bg=None):
    b = f'<rect width="512" height="512" fill="{bg}"/>' if bg else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
{defs()}{b}
{body}
</svg>"""


VARIANTS = {
    # I: negative-space diagonal channel (the light path)
    "i": svg('<use xlink:href="#prism" fill="url(#spectrum)" mask="url(#cut)"/>'),
    # J: negative-space channel, vertical spectrum
    "j": svg('<use xlink:href="#prism" fill="url(#spectrumV)" mask="url(#cut)"/>'),
    # K: solid gradient with a light beam (needs a dark ground)
    "k": svg(
        """<use xlink:href="#prism" fill="url(#spectrum)"/>
<g clip-path="url(#clipPrism)"><rect x="-60" y="222" width="632" height="68" fill="#fff" opacity="0.95" transform="rotate(45 256 256)"/></g>""",
        bg=INK,
    ),
    # L: solid gradient, no cut (the plain gem)
    "l": svg('<use xlink:href="#prism" fill="url(#spectrum)"/>'),
}

for name, content in VARIANTS.items():
    (OUT / f"v2_{name}.svg").write_text(content)
    subprocess.run(
        ["rsvg-convert", "-w", "512", "-h", "512", "-o", str(OUT / f"v2_{name}.png"), str(OUT / f"v2_{name}.svg")],
        check=True,
    )

names = ["i", "j", "k", "l"]
sheet = Image.new("RGBA", (512 * 4 + 150, 512 + 80), (242, 243, 246, 255))
for i, n in enumerate(names):
    im = Image.open(OUT / f"v2_{n}.png").convert("RGBA")
    sheet.alpha_composite(im, (30 + i * 522, 40))
sheet.save(OUT / "sheet3.png")

small = Image.new("RGBA", (960, 190), (242, 243, 246, 255))
for i, n in enumerate(names):
    im = Image.open(OUT / f"v2_{n}.png").convert("RGBA")
    for j, s in enumerate((96, 48, 28)):
        r = im.resize((s, s), Image.LANCZOS)
        small.alpha_composite(r, (30 + i * 235 + j * 108, 40 + (96 - s)))
small.save(OUT / "sheet3_small.png")
print("ok")
