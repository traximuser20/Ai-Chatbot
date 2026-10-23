#!/usr/bin/env python3
"""
Build the icon set of the app.

Every icon of the interface is an Android vector drawable: a native resource
of the app, drawn by the platform itself. It stays crisp on every screen, it
follows the density of the device, and it is tinted with the colour of the
scheme - so the icons follow the palette of the active route.

The shapes come from the Material Icons (Apache 2.0), cut down to the icons
the interface uses. The sources are kept next to this script, so the build
works without a network.

    python3 design/icons/build_drawables.py

The result is written to
`App_Resources/Android/src/main/res/drawable`, and the app loads the
drawables from there at runtime (see `src/utils/icons.ts`).
"""
from __future__ import annotations

import pathlib
import sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
DESIGN = pathlib.Path(__file__).resolve().parent
# The sources of the shapes: the Material Icons, one file per icon.
SOURCES = DESIGN / "svg"
# Where the app keeps its native resources.
TARGET = ROOT / "App_Resources" / "Android" / "src" / "main" / "res" / "drawable"

SVG_NS = "{http://www.w3.org/2000/svg}"

# The icons the interface uses, and the Material icon that draws each of them.
# The name on the left is the name the app asks for; the drawable of an icon
# is named after it (`ic_` and underscores), so the app and the resources
# speak the same language.
ICONS = {
    "menu": "menu",
    "chevron-down": "expand_more",
    "chevron-left": "chevron_left",
    "arrow-up": "arrow_upward",
    "stop": "stop",
    "plus": "add",
    "close": "close",
    "search": "search",
    "sliders": "tune",
    "user": "person",
    "dot": "circle",
    "check": "check",
    "dots": "more_horiz",
    "trash": "delete",
    "retry": "refresh",
    "copy": "content_copy",
    "edit": "edit",
    "warning": "warning",
    "plane": "send",
    "info": "info",
    # The controls of the voice, the attachments and the camera.
    "microphone": "mic",
    "camera": "photo_camera",
    "paperclip": "attach_file",
    "image": "image",
    "file": "description",
    "volume": "volume_up",
    "play": "play_arrow",
    # The voice chat: the wave button that opens the full screen voice mode.
    "wave": "graphic_eq",
}

# The colour of a shape. It is black: the icon is tinted with the colour of
# the scheme at runtime, and a filter replaces the colour of the shape.
FILL = "#FF000000"


def drawable_name(name: str) -> str:
    """The name of the drawable of an icon."""
    return f"ic_{name.replace('-', '_')}"


def read_source(name: str) -> tuple[float, float, list[ET.Element]]:
    """The viewport and the paths of a Material icon."""
    path = SOURCES / f"{name}.svg"
    if not path.exists():
        raise FileNotFoundError(f"The source of the icon '{name}' is missing: {path}")

    root = ET.parse(path).getroot()
    viewbox = (root.get("viewBox") or "0 0 24 24").split()
    if len(viewbox) != 4:
        raise ValueError(f"The icon '{name}' has a broken viewBox: {root.get('viewBox')}")

    width, height = float(viewbox[2]), float(viewbox[3])
    paths = root.findall(f"{SVG_NS}path")
    if not paths:
        raise ValueError(f"The icon '{name}' has no path.")

    return width, height, paths


def build(name: str, source: str) -> str:
    """The vector drawable of an icon."""
    width, height, paths = read_source(source)

    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<!--",
        f"  The '{name}' icon of the interface.",
        "",
        "  Material Icons (Round), by Google - Apache License 2.0.",
        "  See design/icons/MaterialIcons-LICENSE.txt.",
        "-->",
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:width="24dp"',
        '    android:height="24dp"',
        f'    android:viewportWidth="{width:g}"',
        f'    android:viewportHeight="{height:g}">',
    ]

    for path in paths:
        data = path.get("d")
        if not data:
            continue
        fill_type = path.get("fill-rule")
        lines.append("    <path")
        lines.append(f'        android:fillColor="{FILL}"')
        if fill_type == "evenodd":
            lines.append('        android:fillType="evenOdd"')
        lines.append(f'        android:pathData="{data}" />')

    lines.append("</vector>")
    return "\n".join(lines) + "\n"


def main() -> int:
    TARGET.mkdir(parents=True, exist_ok=True)

    for name, source in ICONS.items():
        try:
            xml = build(name, source)
        except (FileNotFoundError, ValueError) as error:
            print(error, file=sys.stderr)
            return 1

        target = TARGET / f"{drawable_name(name)}.xml"
        target.write_text(xml, encoding="utf-8")

    size = sum((TARGET / f"{drawable_name(name)}.xml").stat().st_size for name in ICONS)
    print(f"{TARGET.relative_to(ROOT)}  {len(ICONS)} drawables  {size / 1024:.1f} kB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
