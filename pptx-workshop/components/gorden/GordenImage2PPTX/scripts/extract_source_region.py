#!/usr/bin/env python3
"""Extract an exact PNG crop for a source-preserved reconstruction asset."""

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path


def extract(source: Path, output: Path, bbox: tuple[int, int, int, int]) -> None:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Pillow is required") from exc

    x, y, width, height = bbox
    if x < 0 or y < 0 or width < 1 or height < 1:
        raise ValueError("bbox must be x>=0, y>=0, width>0, height>0")
    with Image.open(source) as image:
        if x + width > image.width or y + height > image.height:
            raise ValueError("bbox exceeds source image")
        expected = image.crop((x, y, x + width, y + height))
        output.parent.mkdir(parents=True, exist_ok=True)
        expected.save(output, format="PNG")
        expected_rgba = expected.convert("RGBA")
    with Image.open(output) as written:
        actual_rgba = written.convert("RGBA")
    if actual_rgba.size != expected_rgba.size or actual_rgba.tobytes() != expected_rgba.tobytes():
        output.unlink(missing_ok=True)
        raise RuntimeError("written PNG is not pixel-identical to the source crop")


def self_test() -> None:
    from PIL import Image

    with tempfile.TemporaryDirectory(prefix="source-region-test-") as temp:
        root = Path(temp)
        source = root / "source.png"
        output = root / "crop.png"
        image = Image.new("RGBA", (20, 12), (10, 20, 30, 255))
        image.putpixel((5, 4), (200, 100, 50, 120))
        image.save(source)
        extract(source, output, (4, 3, 5, 4))
        with Image.open(output) as crop:
            if crop.size != (5, 4) or crop.convert("RGBA").getpixel((1, 1)) != (200, 100, 50, 120):
                raise AssertionError("exact source crop self-test failed")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?")
    parser.add_argument("output", nargs="?")
    parser.add_argument("--bbox", nargs=4, type=int, metavar=("X", "Y", "W", "H"))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        print("Self-test passed: exact source crop preserved")
        return 0
    if not args.source or not args.output or args.bbox is None:
        parser.error("source, output and --bbox X Y W H are required")
    try:
        extract(
            Path(args.source).expanduser().resolve(),
            Path(args.output).expanduser().resolve(),
            tuple(args.bbox),
        )
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(Path(args.output).expanduser().resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
