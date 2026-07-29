#!/usr/bin/env python3
"""Probe local PPTX backend capabilities without installing or modifying anything."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
from pathlib import Path


def first_existing(candidates: list[Path]) -> str | None:
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate.resolve())
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ppt-master-root")
    args = parser.parse_args()

    root_value = args.ppt_master_root or os.environ.get("PPT_MASTER_ROOT")
    root = Path(root_value).expanduser().resolve() if root_value else None
    scripts = root / "scripts" if root else None
    ppt_master = {
        "root": str(root) if root else None,
        "available": bool(root and root.is_dir()),
        "pptx_intake": bool(scripts and (scripts / "pptx_intake.py").is_file()),
        "template_fill": bool(
            scripts
            and (
                (scripts / "template_fill_pptx.py").is_file()
                or (scripts / "template_fill_pptx" / "cli.py").is_file()
            )
        ),
        "svg_to_pptx": bool(scripts and (scripts / "svg_to_pptx.py").is_file()),
    }
    libreoffice = first_existing(
        [
            Path(shutil.which("soffice") or ""),
            Path(shutil.which("libreoffice") or ""),
            Path(r"C:\Program Files\LibreOffice\program\soffice.com"),
            Path(r"C:\Program Files\LibreOffice\program\soffice.exe"),
        ]
    )
    report = {
        "schema": "craft-editable-pptx.backend-probe.v1",
        "ppt_master": ppt_master,
        "python_modules": {
            "python_pptx": importlib.util.find_spec("pptx") is not None,
            "Pillow": importlib.util.find_spec("PIL") is not None,
            "PyMuPDF": importlib.util.find_spec("fitz") is not None,
        },
        "rendering": {
            "libreoffice": libreoffice,
            "pdftoppm": shutil.which("pdftoppm"),
        },
        "notes": [
            "Probe is read-only and does not install dependencies.",
            "A missing capability is blocking for routes that require it; do not silently flatten slides.",
        ],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
