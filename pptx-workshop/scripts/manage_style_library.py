#!/usr/bin/env python3
"""Build or verify the bundled PPTX Workshop style-library catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
import zipfile
from pathlib import Path
from typing import Any


CATALOG_VERSION = "pptx-workshop.style-library.v1"
SKILL_ROOT = Path(__file__).resolve().parent.parent
LIBRARY_ROOT = SKILL_ROOT / "assets" / "style-library"
CATALOG_PATH = LIBRARY_ROOT / "catalog.json"
PPT_MASTER_COMMIT = "2296b80c5f2c3df6eac4461dd788b9f526b72e14"
SAN_COMMIT = "801cd2bd46c3cc4ca2c846ff28da2d9284816cd9"
GORDEN_COMMIT = "8c05583dab8334182b71738e8dfbbec5c56a1951"


class CatalogError(ValueError):
    """Raised when the bundled style library is incomplete or stale."""


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(SKILL_ROOT.resolve()).as_posix()
    except ValueError as exc:
        raise CatalogError(f"asset escapes the skill root: {path}") from exc


def file_record(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise CatalogError(f"missing style-library file: {path}")
    return {
        "path": relative(path),
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
    }


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise CatalogError(f"invalid PNG: {path}")
    return struct.unpack(">II", header[16:24])


def png_record(path: Path) -> dict[str, Any]:
    record = file_record(path)
    record["width"], record["height"] = png_dimensions(path)
    return record


def pptx_slide_count(path: Path) -> int:
    try:
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            if "[Content_Types].xml" not in names or "ppt/presentation.xml" not in names:
                raise CatalogError(f"invalid PPTX package: {path}")
            count = sum(bool(re.fullmatch(r"ppt/slides/slide\d+\.xml", name)) for name in names)
    except zipfile.BadZipFile as exc:
        raise CatalogError(f"invalid PPTX zip: {path}") from exc
    if count < 1:
        raise CatalogError(f"PPTX has no slides: {path}")
    return count


def source_reviews() -> list[dict[str, Any]]:
    return [
        {
            "id": "ppt-master",
            "repository": "hugohe3/ppt-master",
            "url": "https://github.com/hugohe3/ppt-master",
            "commit": PPT_MASTER_COMMIT,
            "license": "MIT",
            "status": "bundled",
            "license_file": file_record(LIBRARY_ROOT / "ppt-master" / "LICENSE.txt"),
            "metadata_file": file_record(
                LIBRARY_ROOT / "ppt-master" / "upstream-examples.json"
            ),
        },
        {
            "id": "ppt-agent-workflow-san",
            "repository": "mucsbr/ppt-agent-workflow-san",
            "url": "https://github.com/mucsbr/ppt-agent-workflow-san",
            "commit": SAN_COMMIT,
            "license": "Apache-2.0 (declared in upstream README)",
            "status": "bundled",
            "license_file": file_record(
                LIBRARY_ROOT / "san-dark-product-analysis" / "LICENSE.txt"
            ),
        },
        {
            "id": "gorden-super-ppt-skills",
            "repository": "GordenSun/GordenSuperPPTSkills",
            "url": "https://github.com/GordenSun/GordenSuperPPTSkills",
            "commit": GORDEN_COMMIT,
            "license": "custom README permission; attribution required",
            "status": "bundled-attributed",
            "notice_file": file_record(
                SKILL_ROOT / "components" / "gorden" / "NOTICE.md"
            ),
        },
        {
            "id": "pptx-template-skills",
            "repository": "CxyZyr/PPTX-Template-Skills",
            "url": "https://github.com/CxyZyr/PPTX-Template-Skills",
            "commit": "e3139a08b4bf96bb2cda0046b8d3627e69737f11",
            "license": "MIT",
            "status": "no-binary-style-assets",
            "reason": "repository contains template parsing/filling skills but no PPTX or visual samples",
        },
        {
            "id": "ppt-craft-editable",
            "repository": "ilioner/ppt-craft-editable",
            "url": "https://github.com/ilioner/ppt-craft-editable",
            "commit": "be70ac403c6ab7af63e426123b0b2d3afbd6c338",
            "license": "not found at audited commit",
            "status": "remote-only-license-unclear",
            "reason": "binary files are validation artifacts and no repository-level redistribution license was found",
        },
    ]


def build_ppt_master_entries() -> list[dict[str, Any]]:
    root = LIBRARY_ROOT / "ppt-master"
    metadata = json.loads((root / "upstream-examples.json").read_text(encoding="utf-8"))
    projects = metadata.get("projects")
    if not isinstance(projects, list) or len(projects) != 21:
        raise CatalogError("PPT Master metadata must contain exactly 21 projects")
    entries: list[dict[str, Any]] = []
    for project in projects:
        project_id = project["id"]
        project_root = root / project_id
        deck_path = project_root / "reference.pptx"
        cover_path = project_root / "cover.svg"
        preview_path = project_root / "preview.png"
        slide_count = pptx_slide_count(deck_path)
        metadata_slides = project.get("slides")
        if not isinstance(metadata_slides, list) or slide_count != len(metadata_slides):
            raise CatalogError(f"PPT Master slide count differs from metadata: {project_id}")
        entries.append(
            {
                "id": f"ppt-master-{project_id.removeprefix('ppt169_')}",
                "title": project["title"],
                "style_name": project.get("styleName") or project.get("style") or project["title"],
                "description": project.get("description") or project.get("desc") or "",
                "asset_kind": "reference-deck",
                "source_id": "ppt-master",
                "source_commit": PPT_MASTER_COMMIT,
                "source_project_id": project_id,
                "license": "MIT",
                "usage": "visual-reference-only",
                "scene_eligibility": ["new-deck-style-reference", "reference-deck-reference"],
                "template_status": "not-validated-for-template-fill",
                "tags": list(project.get("tags") or []),
                "limitations": [
                    "do not copy source facts, brands, photos, animations, narration or slide text without separate review",
                    "do not treat this reference deck as a scene 2 template without template analysis",
                ],
                "preview": png_record(preview_path),
                "cover_svg": file_record(cover_path),
                "reference_deck": {
                    **file_record(deck_path),
                    "slide_count": slide_count,
                },
            }
        )
    return entries


GORDEN_STYLES = {
    "leader_love": {
        "title": "蓝白咨询框架",
        "style_name": "Blue Consulting Framework",
        "tags": ["蓝白", "咨询", "项目管理", "体系总览", "高信息密度"],
        "best_for": ["企业方法论", "项目管理体系", "流程与能力地图"],
    },
    "red_grey_project": {
        "title": "红灰战略经营",
        "style_name": "Red Grey Strategy",
        "tags": ["红灰", "战略", "经营分析", "数字卡片"],
        "best_for": ["年度战略", "经营分析", "业绩复盘"],
    },
    "scholar_green": {
        "title": "学术研究绿",
        "style_name": "Scholar Green",
        "tags": ["学术", "白底", "绿色", "关系图", "研究汇报"],
        "best_for": ["学术研究", "政策分析", "法学与社会科学"],
    },
    "tech_prize": {
        "title": "科技项目申报蓝",
        "style_name": "Technology Award Blue",
        "tags": ["科技", "项目申报", "蓝白", "证据图片", "传统汇报"],
        "best_for": ["重大项目申报", "科技奖项", "成果汇报"],
        "limitations": ["legacy-low-resolution reference images"],
    },
    "work_result": {
        "title": "红蓝工作总结",
        "style_name": "Red Blue Work Summary",
        "tags": ["红蓝", "工作总结", "计划", "对称结构"],
        "best_for": ["半年总结", "年度复盘", "下阶段计划"],
    },
}


def build_gorden_entries() -> list[dict[str, Any]]:
    gallery = SKILL_ROOT / "components" / "gorden" / "GordenImagePPTGen" / "参考图"
    actual_groups = {path.name for path in gallery.iterdir() if path.is_dir()}
    if actual_groups != set(GORDEN_STYLES):
        raise CatalogError("Gorden gallery groups differ from the approved catalog")
    entries: list[dict[str, Any]] = []
    for group_id, metadata in GORDEN_STYLES.items():
        samples = [png_record(path) for path in sorted((gallery / group_id).glob("*.png"))]
        if not samples:
            raise CatalogError(f"Gorden style group is empty: {group_id}")
        entries.append(
            {
                "id": f"gorden-{group_id.replace('_', '-')}",
                "title": metadata["title"],
                "style_name": metadata["style_name"],
                "description": "GordenImagePPTGen bundled reference family",
                "asset_kind": "style-family",
                "source_id": "gorden-super-ppt-skills",
                "source_commit": GORDEN_COMMIT,
                "source_group": group_id,
                "license": "custom README permission; attribution required",
                "usage": "visual-reference-only",
                "scene_eligibility": ["new-deck-style-reference", "reference-deck-reference"],
                "template_status": "not-a-template",
                "tags": metadata["tags"],
                "best_for": metadata["best_for"],
                "limitations": metadata.get("limitations", []),
                "preview": samples[0],
                "samples": samples,
            }
        )
    return entries


def build_san_entry() -> dict[str, Any]:
    root = LIBRARY_ROOT / "san-dark-product-analysis"
    slides = [png_record(path) for path in sorted((root / "slides").glob("*.png"))]
    if len(slides) != 8:
        raise CatalogError("SAN style family must contain exactly 8 slides")
    return {
        "id": "san-dark-product-analysis",
        "title": "深蓝产品分析",
        "style_name": "Dark Product Analysis",
        "description": "深蓝渐变、青绿高亮、大字号中文标题和玻璃卡片的八页产品分析样例",
        "asset_kind": "style-family",
        "source_id": "ppt-agent-workflow-san",
        "source_commit": SAN_COMMIT,
        "license": "Apache-2.0 (declared in upstream README)",
        "usage": "visual-reference-only",
        "scene_eligibility": ["new-deck-style-reference", "reference-deck-reference"],
        "template_status": "not-a-template",
        "tags": ["深蓝", "渐变", "科技", "产品分析", "玻璃卡片"],
        "best_for": ["产品分析", "科技商业汇报", "竞争格局"],
        "limitations": [],
        "preview": slides[0],
        "samples": slides,
    }


def supporting_assets() -> list[dict[str, Any]]:
    gorden = [
        {**png_record(path), "source_id": "gorden-super-ppt-skills", "role": "workflow-example"}
        for path in sorted((LIBRARY_ROOT / "gorden-workflow-examples").glob("*.png"))
    ]
    san = [
        {**png_record(path), "source_id": "ppt-agent-workflow-san", "role": "workflow-screenshot"}
        for path in sorted(
            (LIBRARY_ROOT / "san-dark-product-analysis" / "workflow-screenshots").glob("*.png")
        )
    ]
    if len(gorden) != 5 or len(san) != 2:
        raise CatalogError("supporting Gorden/SAN asset counts are incomplete")
    return gorden + san


def build_catalog() -> dict[str, Any]:
    notice = file_record(LIBRARY_ROOT / "NOTICE.md")
    entries = build_ppt_master_entries() + build_gorden_entries() + [build_san_entry()]
    supporting = supporting_assets()
    bundled_bytes = sum(
        path.stat().st_size
        for path in list(LIBRARY_ROOT.rglob("*"))
        + list(
            (
                SKILL_ROOT
                / "components"
                / "gorden"
                / "GordenImagePPTGen"
                / "参考图"
            ).rglob("*")
        )
        if path.is_file() and path != CATALOG_PATH
    )
    return {
        "schema_version": CATALOG_VERSION,
        "library_id": "pptx-workshop-bundled-style-library",
        "catalog_revision": "2026-07-31-r1",
        "notice": notice,
        "summary": {
            "selectable_entries": len(entries),
            "reference_decks": sum(entry["asset_kind"] == "reference-deck" for entry in entries),
            "style_families": sum(entry["asset_kind"] == "style-family" for entry in entries),
            "supporting_assets": len(supporting),
            "bundled_bytes_excluding_catalog": bundled_bytes,
        },
        "source_reviews": source_reviews(),
        "entries": entries,
        "supporting_assets": supporting,
    }


def collect_declared_paths(value: Any) -> set[str]:
    paths: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "path" and isinstance(child, str):
                paths.add(child)
            else:
                paths.update(collect_declared_paths(child))
    elif isinstance(value, list):
        for child in value:
            paths.update(collect_declared_paths(child))
    return paths


def verify_catalog(catalog: dict[str, Any]) -> None:
    if catalog.get("schema_version") != CATALOG_VERSION:
        raise CatalogError("style-library schema version is invalid")
    entries = catalog.get("entries")
    if not isinstance(entries, list) or len(entries) != 27:
        raise CatalogError("style library must contain 27 selectable entries")
    ids = [entry.get("id") for entry in entries]
    if len(ids) != len(set(ids)) or any(not isinstance(item, str) or not item for item in ids):
        raise CatalogError("style-library entry ids must be unique and non-empty")
    for entry in entries:
        required = {
            "title", "style_name", "asset_kind", "source_id", "source_commit",
            "license", "usage", "scene_eligibility", "template_status", "preview",
        }
        if not required.issubset(entry):
            raise CatalogError(f"style-library entry is incomplete: {entry.get('id')}")
        if entry["usage"] != "visual-reference-only":
            raise CatalogError(f"style-library entry may not become an implicit template: {entry['id']}")
        if entry["template_status"] not in {"not-a-template", "not-validated-for-template-fill"}:
            raise CatalogError(f"style-library template status is unsafe: {entry['id']}")

    declared_paths = collect_declared_paths(catalog)
    for path_text in declared_paths:
        path = (SKILL_ROOT / path_text).resolve()
        if not path.is_file() or sha256(path) != next_hash_for_path(catalog, path_text):
            raise CatalogError(f"catalog path is missing or stale: {path_text}")

    actual_paths = {
        relative(path)
        for path in LIBRARY_ROOT.rglob("*")
        if path.is_file() and path != CATALOG_PATH
    }
    gallery = SKILL_ROOT / "components" / "gorden" / "GordenImagePPTGen" / "参考图"
    actual_paths.update(relative(path) for path in gallery.rglob("*") if path.is_file())
    actual_paths.add(relative(SKILL_ROOT / "components" / "gorden" / "NOTICE.md"))
    if actual_paths != declared_paths:
        missing = sorted(actual_paths - declared_paths)
        stale = sorted(declared_paths - actual_paths)
        raise CatalogError(f"style-library file roster differs; unlisted={missing}; missing={stale}")


def next_hash_for_path(value: Any, target: str) -> str:
    if isinstance(value, dict):
        if value.get("path") == target:
            digest = value.get("sha256")
            if not isinstance(digest, str):
                raise CatalogError(f"catalog path has no SHA-256: {target}")
            return digest
        for child in value.values():
            try:
                return next_hash_for_path(child, target)
            except KeyError:
                pass
    elif isinstance(value, list):
        for child in value:
            try:
                return next_hash_for_path(child, target)
            except KeyError:
                pass
    raise KeyError(target)


def write_catalog() -> None:
    catalog = build_catalog()
    verify_catalog(catalog)
    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        f"Wrote {CATALOG_PATH}: {catalog['summary']['selectable_entries']} entries, "
        f"{catalog['summary']['bundled_bytes_excluding_catalog']} bundled bytes"
    )


def check_catalog() -> None:
    if not CATALOG_PATH.is_file():
        raise CatalogError(f"catalog is missing: {CATALOG_PATH}")
    current = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    expected = build_catalog()
    if current != expected:
        raise CatalogError("catalog.json is stale; run manage_style_library.py --write")
    verify_catalog(current)
    print(
        f"Style library valid: {current['summary']['selectable_entries']} entries, "
        f"{current['summary']['reference_decks']} reference decks, "
        f"{current['summary']['style_families']} style families"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--write", action="store_true", help="rebuild catalog.json")
    action.add_argument("--check", action="store_true", help="verify catalog and all assets")
    args = parser.parse_args()
    try:
        if args.write:
            write_catalog()
        else:
            check_catalog()
    except (CatalogError, OSError, json.JSONDecodeError, KeyError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
