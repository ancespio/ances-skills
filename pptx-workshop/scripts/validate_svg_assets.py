#!/usr/bin/env python3
"""Reject raster-bearing, animated, scripted, or suspiciously traced SVG assets."""

from __future__ import annotations

import argparse
import re
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET


RASTER_RE = re.compile(r"(?:data:image/(?:png|jpe?g|webp|gif|bmp)|\.(?:png|jpe?g|webp|gif|bmp)(?:[?#]|$))", re.I)
TRACE_RE = re.compile(r"potrace|autotrace|imagetracer|vectorizer\.ai", re.I)
FORBIDDEN_TAGS = {"image", "foreignObject", "script", "animate", "animateMotion", "animateTransform", "set"}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def validate_svg(path: Path, max_paths: int, max_path_chars: int) -> list[str]:
    errors: list[str] = []
    try:
        raw = path.read_text(encoding="utf-8")
        root = ET.fromstring(raw)
    except (OSError, UnicodeError, ET.ParseError) as exc:
        return [f"cannot read valid UTF-8 SVG: {exc}"]
    if local_name(root.tag) != "svg":
        errors.append("root element is not <svg>")
    if RASTER_RE.search(raw):
        errors.append("contains a raster data URI or raster file reference")
    if TRACE_RE.search(raw):
        errors.append("contains a raster-tracing tool signature")

    path_count = 0
    path_chars = 0
    for element in root.iter():
        name = local_name(element.tag)
        if name in FORBIDDEN_TAGS:
            errors.append(f"contains forbidden <{name}> element")
        if name == "text":
            errors.append("contains <text>; ordinary text must be a native PowerPoint text box")
        if name == "path":
            path_count += 1
            path_chars += len(element.get("d", ""))
        for value in element.attrib.values():
            if RASTER_RE.search(value):
                errors.append("contains a raster reference in an attribute")
    if path_count > max_paths or path_chars > max_path_chars:
        errors.append(
            f"suspicious path density ({path_count} paths, {path_chars} path chars); "
            "redesign as a clean vector asset instead of noisy raster tracing"
        )
    return sorted(set(errors))


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="pptx-workshop-svg-") as temp:
        root = Path(temp)
        clean = root / "clean.svg"
        clean.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<path d="M10 10H90V90H10Z" fill="#2563EB"/></svg>',
            encoding="utf-8",
        )
        raster = root / "raster.svg"
        raster.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<image href="data:image/png;base64,AAAA"/></svg>',
            encoding="utf-8",
        )
        text = root / "text.svg"
        text.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg"><text>hidden copy</text></svg>',
            encoding="utf-8",
        )
        if validate_svg(clean, 1500, 500000):
            raise AssertionError("clean SVG should pass")
        if not validate_svg(raster, 1500, 500000):
            raise AssertionError("embedded raster should fail")
        if not validate_svg(text, 1500, 500000):
            raise AssertionError("SVG text should fail")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", help="SVG file or directory")
    parser.add_argument("--max-paths", type=int, default=1500)
    parser.add_argument("--max-path-chars", type=int, default=500000)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        print("Self-test passed: clean SVG accepted; raster and SVG text rejected")
        return 0
    if not args.input:
        parser.error("input is required unless --self-test is used")
    target = Path(args.input).expanduser().resolve()
    files = [target] if target.is_file() else sorted(target.rglob("*.svg")) if target.is_dir() else []
    if not files:
        print(f"No SVG files found: {target}")
        return 1
    failures = 0
    for path in files:
        errors = validate_svg(path, args.max_paths, args.max_path_chars)
        if errors:
            failures += 1
            for error in errors:
                print(f"FAIL {path}: {error}")
        else:
            print(f"PASS {path}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
