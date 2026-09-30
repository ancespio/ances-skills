#!/usr/bin/env python3
"""Probe local PPTX backend capabilities without installing or modifying anything."""

from __future__ import annotations

import argparse
import hashlib
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


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


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
    gorden_root = Path(__file__).resolve().parent.parent
    gorden_sha_file = gorden_root / "GORDEN_UPSTREAM_COMMIT"
    gorden_sha = (
        gorden_sha_file.read_text(encoding="utf-8").strip()
        if gorden_sha_file.is_file()
        else None
    )
    image_ppt = gorden_root / "GordenImagePPTGen"
    image_to_pptx = gorden_root / "GordenImage2PPTX"
    gorden = {
        "root": str(gorden_root),
        "bundled": True,
        "available": gorden_root.is_dir(),
        "source_sha": gorden_sha,
        "image_ppt_gen": {
            "available": bool(image_ppt and (image_ppt / "WORKFLOW.md").is_file()),
            "compose_pptx": bool(image_ppt and (image_ppt / "scripts" / "compose_pptx.py").is_file()),
        },
        "image_to_pptx": {
            "available": bool(image_to_pptx and (image_to_pptx / "WORKFLOW.md").is_file()),
            "compose_pptx": bool(image_to_pptx and (image_to_pptx / "scripts" / "compose_pptx.py").is_file()),
            "layout_guard": bool(image_to_pptx and (image_to_pptx / "scripts" / "layout_guard.py").is_file()),
            "placement_qa": bool(image_to_pptx and (image_to_pptx / "scripts" / "placement_qa.py").is_file()),
            "visual_compare_qa": bool(
                image_to_pptx and (image_to_pptx / "scripts" / "visual_compare_qa.py").is_file()
            ),
        },
        "standard_license_file": bool(
            any((gorden_root / name).is_file() for name in ("LICENSE", "LICENSE.txt", "LICENSE.md"))
        ),
        "attribution_notice": (gorden_root / "GORDEN_NOTICE.md").is_file(),
        "imagegen_required": True,
    }
    skill_root = Path(__file__).resolve().parent.parent
    style_catalog_path = skill_root / "assets" / "style-library" / "catalog.json"
    style_manager_path = skill_root / "scripts" / "manage_style_library.py"
    style_catalog: dict[str, object] = {}
    style_catalog_error = None
    if style_catalog_path.is_file():
        try:
            style_catalog = json.loads(style_catalog_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            style_catalog_error = str(exc)
    entries = style_catalog.get("entries")
    style_library = {
        "root": str((skill_root / "assets" / "style-library").resolve()),
        "catalog_path": str(style_catalog_path.resolve()),
        "catalog_sha256": sha256(style_catalog_path) if style_catalog_path.is_file() else None,
        "catalog_schema": style_catalog.get("schema_version"),
        "selectable_entries": len(entries) if isinstance(entries, list) else 0,
        "manager": str(style_manager_path.resolve()) if style_manager_path.is_file() else None,
        "available": bool(
            style_catalog.get("schema_version") == "pptx-workshop.style-library.v1"
            and isinstance(entries, list)
            and entries
            and style_manager_path.is_file()
        ),
        "error": style_catalog_error,
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
        "schema": "pptx-workshop.backend-probe.v1",
        "ppt_master": ppt_master,
        "gorden_super_ppt": gorden,
        "style_library": style_library,
        "python_modules": {
            "python_pptx": importlib.util.find_spec("pptx") is not None,
            "Pillow": importlib.util.find_spec("PIL") is not None,
            "numpy": importlib.util.find_spec("numpy") is not None,
            "PyMuPDF": importlib.util.find_spec("fitz") is not None,
        },
        "rendering": {
            "libreoffice": libreoffice,
            "pdftoppm": shutil.which("pdftoppm"),
        },
        "notes": [
            "Probe is read-only and does not install dependencies.",
            "A missing capability is blocking for routes that require it; do not silently flatten slides.",
            "Gorden workflows are embedded with attribution and a pinned upstream commit marker.",
            "Run manage_style_library.py --check before presenting bundled style choices.",
        ],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
