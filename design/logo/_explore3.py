#!/usr/bin/env python3
"""Third round: lock the mark (deepened spectrum + tapered beam + glow)."""
import pathlib
import subprocess

from PIL import Image

OUT = pathlib.Path("/tmp/opencode")
PATH = (
    "M 273.00 77.00 L 435.00 239.00 A 34.0 34.0 0 0 1 435.00 273.00 "
    "L 273.00 435.00 A 34.0 34.0 0 0 1 239.00 435.00 L 77.00 273.00 "
    "A 34.0 34.0 0 0 1 77.00 239.00 L 239.00 77.00 A 34.0 34.0 0 0 1 273.00 77.00 Z"
)

DEEP = [("0%", "#2F55F5"), ("38%", "#6D3BF5"), ("100%", "#0FB6D6")]
DEEP2 = [("0%", "#3A63F9"), ("40%", "#7A45F7"), ("100%", "#14C0DE")]


def grad(idname, stops, x1=0, y1=0, x2=1, y2=1):
    body = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{idname}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{body}</linearGradient>'


def defs(extra=""):
    return f"""<defs>
  {grad("spectrum", DEEP)}
  {grad("spectrum2", DEEP2)}
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


def beam(width, opacity, color="#FFFFFF", taper=0):
    """A band along the 45 degree diagonal, optionally tapered."""
    if taper:
        # parallelogram: narrow at the entry (top-left), wide at the exit
        h = width / 2
        pts = "{},{} {},{} {},{} {},{}".format(
            -140, -140, 140, -140, 140 + taper * 2, 140, -140 + taper * 2, 140
        )
        return (
            f'<polygon points="{pts}" fill="{color}" opacity="{opacity}" '
            f'transform="translate(256 256) rotate(45)"/>'
        )
    return (
        f'<rect x="-120" y="{256 - width / 2}" width="752" height="{width}" '
        f'fill="{color}" opacity="{opacity}" transform="rotate(45 256 256)"/>'
    )


VARIANTS = {
    # M: deepened spectrum, straight beam with glow, on ink
    "m": svg(
        f"""<use xlink:href="#prism" fill="url(#spectrum)"/>
<g clip-path="url(#clipPrism)">
  {beam(104, 0.22)}
  {beam(56, 0.98)}
</g>""",
        bg="#0E111B",
    ),
    # N: same mark on paper
    "n": svg(
        f"""<use xlink:href="#prism" fill="url(#spectrum)"/>
<g clip-path="url(#clipPrism)">
  {beam(104, 0.22)}
  {beam(56, 0.98)}
</g>"""
    ),
    # O: tapered beam on ink
    "o": svg(
        f"""<use xlink:href="#prism" fill="url(#spectrum)"/>
<g clip-path="url(#clipPrism)">
  {beam(90, 0.22, taper=18)}
  {beam(48, 0.98, taper=14)}
</g>""",
        bg="#0E111B",
    ),
    # P: deeper spectrum, straight beam, on ink
    "p": svg(
        f"""<use xlink:href="#prism" fill="url(#spectrum2)"/>
<g clip-path="url(#clipPrism)">
  {beam(104, 0.22)}
  {beam(56, 0.98)}
</g>""",
        bg="#0E111B",
    ),
}

for name, content in VARIANTS.items():
    (OUT / f"v3_{name}.svg").write_text(content)
    subprocess.run(
        ["rsvg-convert", "-w", "512", "-h", "512", "-o", str(OUT / f"v3_{name}.png"), str(OUT / f"v3_{name}.svg")],
        check=True,
    )

names = ["m", "n", "o", "p"]
sheet = Image.new("RGBA", (512 * 4 + 150, 512 + 80), (242, 243, 246, 255))
for i, n in enumerate(names):
    im = Image.open(OUT / f"v3_{n}.png").convert("RGBA")
    sheet.alpha_composite(im, (30 + i * 522, 40))
sheet.save(OUT / "sheet4.png")

small = Image.new("RGBA", (1000, 200), (242, 243, 246, 255))
for i, n in enumerate(names):
    im = Image.open(OUT / f"v3_{n}.png").convert("RGBA")
    for j, s in enumerate((100, 48, 28)):
        r = im.resize((s, s), Image.LANCZOS)
        small.alpha_composite(r, (30 + i * 245 + j * 80, 40 + (100 - s)))
small.save(OUT / "sheet4_small.png")
print("ok")
