#!/usr/bin/env python3
"""
Build the icon font of the app.

The interface draws its glyphs with Font Awesome, but the full solid font is
over 400 kB. Only a handful of icons are used, so the font is cut down to
those and renamed: the app then carries a font of a few kilobytes and the
icons stay crisp on every screen.

    python3 design/icons/build_font.py

The source font is expected in `node_modules/@fortawesome/fontawesome-free`
(or a tarball next to this script). The result is written to
`src/assets/fonts/OmniIcons.ttf`.
"""
from __future__ import annotations

import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
DESIGN = pathlib.Path(__file__).resolve().parent
# NativeScript copies `<appPath>/fonts` into the app's `files/app/fonts`, which
# is where the runtime looks for a font by its family name.
RUNTIME = ROOT / "src" / "fonts"
LICENSE = ROOT / "src" / "fonts" / "FontAwesome-LICENSE.txt"

# The family the app refers to.
FAMILY = "OmniIcons"

# The icons the interface uses, and the codepoint of each of them in the
# Font Awesome solid font.
ICONS = {
    "menu": "f0c9",  # bars
    "chevron-down": "f078",
    "chevron-left": "f053",
    "arrow-up": "f062",
    "stop": "f04d",  # square
    "plus": "2b",
    "close": "f00d",  # xmark
    "search": "f002",  # magnifying-glass
    "sliders": "f1de",
    "user": "f007",
    "dot": "f111",  # circle
    "check": "f00c",
    "dots": "f141",  # ellipsis
    "trash": "f1f8",
    "retry": "f2f1",  # rotate
    "warning": "f071",  # triangle-exclamation
    "plane": "f1d8",  # paper-plane
    "info": "f05a",  # circle-info
}


def find_source_font() -> pathlib.Path | None:
    """The solid font of the Font Awesome package, wherever it is."""
    candidates = [
        ROOT / "node_modules" / "@fortawesome" / "fontawesome-free" / "webfonts" / "fa-solid-900.ttf",
        pathlib.Path("/tmp/opencode/package") / "webfonts" / "fa-solid-900.ttf",
        pathlib.Path(tempfile.gettempdir()) / "package" / "webfonts" / "fa-solid-900.ttf",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def find_license() -> pathlib.Path | None:
    candidates = [
        ROOT / "node_modules" / "@fortawesome" / "fontawesome-free" / "LICENSE.txt",
        pathlib.Path("/tmp/opencode/package") / "LICENSE.txt",
        pathlib.Path(tempfile.gettempdir()) / "package" / "LICENSE.txt",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def main() -> int:
    source = find_source_font()
    if not source:
        print("The Font Awesome solid font was not found.", file=sys.stderr)
        print("Install it with: npm i @fortawesome/fontawesome-free", file=sys.stderr)
        return 1

    from fontTools import subset
    from fontTools.ttLib import TTFont

    RUNTIME.mkdir(parents=True, exist_ok=True)
    target = RUNTIME / f"{FAMILY}.ttf"

    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables = []

    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=[int(code, 16) for code in ICONS.values()])
    subsetter.subset(font)

    # The app refers to the font by its family name.
    for record in font["name"].names:
        if record.nameID in (1, 3, 4, 6, 16):
            value = FAMILY if record.nameID in (1, 16) else f"{FAMILY} Regular"
            if record.nameID == 6:
                value = "OmniIcons-Regular"
            record.string = value.encode("utf-16-be") if record.platformID == 3 else value.encode()

    font.save(str(target))

    license_source = find_license()
    if license_source:
        shutil.copy(license_source, LICENSE)

    size = target.stat().st_size
    print(f"{target.relative_to(ROOT)}  {size / 1024:.1f} kB  ({len(ICONS)} icons)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
