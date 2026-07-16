from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


def clean_control_characters(text: str) -> str:
    return "".join(
        character
        for character in text
        if character in "\n\t" or ord(character) >= 32
    )

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def detect_language(text: str) -> str:
    visible = re.sub(r"\s+", "", text)
    if not visible:
        return "unknown"
    cjk = len(re.findall(r"[\u3400-\u9fff]", visible))
    return "zh-CN" if cjk / len(visible) >= 0.15 else "en"


def detect_page_count(raw_path: Path, engine_output: Path) -> int:
    try:
        return len(PdfReader(raw_path).pages)
    except Exception:
        pass

    for content_list in engine_output.rglob("*_content_list.json"):
        if content_list.name.endswith("_content_list_v2.json"):
            continue
        try:
            items = json.loads(content_list.read_text(encoding="utf-8-sig"))
            page_indexes = [
                item.get("page_idx")
                for item in items
                if isinstance(item, dict) and isinstance(item.get("page_idx"), int)
            ]
            if page_indexes:
                return max(page_indexes) + 1
        except (OSError, json.JSONDecodeError):
            continue

    try:
        import pymupdf

        with pymupdf.open(raw_path) as document:
            return document.page_count
    except Exception as exc:
        raise RuntimeError(f"Unable to determine PDF page count for {raw_path}") from exc


def choose_markdown(engine_output: Path) -> Path:
    candidates = [
        path
        for path in engine_output.rglob("*.md")
        if path.is_file() and path.stat().st_size > 0
    ]
    if not candidates:
        raise RuntimeError(f"No Markdown output found under {engine_output}")
    return max(candidates, key=lambda path: path.stat().st_size)


def strip_frontmatter(text: str) -> str:
    if not text.startswith("---\n"):
        return text
    end = text.find("\n---\n", 4)
    return text[end + 5 :] if end >= 0 else text


def copy_flat_file(source: Path, target_dir: Path, preferred_name: str) -> Path:
    target = target_dir / preferred_name
    if target.exists():
        if sha256_file(target) == sha256_file(source):
            return target
        target = target_dir / f"{sha256_file(source)[:16]}-{preferred_name}"
        if target.exists() and sha256_file(target) != sha256_file(source):
            raise RuntimeError(f"Flattened file collision: {source} -> {target}")
    shutil.copy2(source, target)
    return target


def copy_assets(engine_output: Path, assets_dir: Path) -> dict[Path, Path]:
    mapping: dict[Path, Path] = {}
    for source in engine_output.rglob("*"):
        if not source.is_file() or source.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        target = copy_flat_file(source, assets_dir, source.name)
        mapping[source.resolve()] = target
    return mapping


def canonical_intermediate_name(source: Path, markdown_path: Path) -> str:
    if source.resolve() == markdown_path.resolve():
        return "document.md"
    suffixes = (
        ("_content_list_v2.json", "content-list-v2.json"),
        ("_content_list.json", "content-list.json"),
        ("_layout.pdf", "layout.pdf"),
        ("_middle.json", "middle.json"),
        ("_model.json", "model.json"),
        ("_origin.pdf", "origin.pdf"),
        ("_span.pdf", "span.pdf"),
    )
    for suffix, replacement in suffixes:
        if source.name.endswith(suffix):
            return replacement
    return source.name


def copy_intermediate(
    engine_output: Path,
    intermediate_dir: Path,
    markdown_path: Path,
) -> dict[Path, Path]:
    mapping: dict[Path, Path] = {}
    for source in engine_output.rglob("*"):
        if not source.is_file() or source.suffix.lower() in IMAGE_SUFFIXES:
            continue
        target = copy_flat_file(
            source,
            intermediate_dir,
            canonical_intermediate_name(source, markdown_path),
        )
        mapping[source.resolve()] = target
    return mapping


def rewrite_image_links(
    text: str,
    markdown_path: Path,
    asset_mapping: dict[Path, Path],
    output_document: Path,
) -> str:
    markdown_pattern = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
    html_pattern = re.compile(r"(<img\b[^>]*\bsrc=[\"'])([^\"']+)([\"'])", re.IGNORECASE)

    def rewritten_target(raw_target: str) -> str | None:
        target = raw_target.strip().strip("<>")
        if re.match(r"^(?:https?:|data:|#)", target, re.IGNORECASE):
            return None
        source = (markdown_path.parent / target).resolve()
        copied = asset_mapping.get(source)
        if copied is None:
            return None
        return os.path.relpath(copied, output_document.parent).replace("\\", "/")

    def replace_markdown(match: re.Match[str]) -> str:
        label, raw_target = match.groups()
        target = rewritten_target(raw_target)
        return f"![{label}]({target})" if target else match.group(0)

    def replace_html(match: re.Match[str]) -> str:
        prefix, raw_target, suffix = match.groups()
        target = rewritten_target(raw_target)
        return f"{prefix}{target}{suffix}" if target else match.group(0)

    return html_pattern.sub(replace_html, markdown_pattern.sub(replace_markdown, text))


def artifact_records(target_root: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for path in sorted(target_root.rglob("*")):
        if not path.is_file() or path.name == "manifest.json":
            continue
        records.append(
            {
                "path": path.relative_to(target_root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    return records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", required=True, type=Path)
    parser.add_argument("--raw-relative", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--engine", required=True)
    parser.add_argument("--engine-version", default="unknown")
    parser.add_argument("--engine-output", required=True, type=Path)
    parser.add_argument("--target", required=True, type=Path)
    args = parser.parse_args()

    raw_path = args.raw.resolve()
    engine_output = args.engine_output.resolve()
    target_root = args.target.resolve()
    if target_root.exists():
        raise RuntimeError(f"Target already exists: {target_root}")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.slug):
        raise RuntimeError("Slug must use lowercase English letters, digits, and hyphens.")

    markdown_path = choose_markdown(engine_output)
    source_text = clean_control_characters(
        markdown_path.read_text(encoding="utf-8-sig", errors="replace")
    )
    source_text = strip_frontmatter(source_text).strip() + "\n"
    generated_at = datetime.now(timezone.utc).isoformat()
    raw_hash = sha256_file(raw_path)
    page_count = detect_page_count(raw_path, engine_output)

    target_root.mkdir(parents=True)
    intermediate_dir = target_root / "intermediate" / args.engine
    intermediate_dir.mkdir(parents=True)
    assets_dir = target_root / "assets"
    assets_dir.mkdir()
    asset_mapping = copy_assets(engine_output, assets_dir)
    intermediate_mapping = copy_intermediate(engine_output, intermediate_dir, markdown_path)
    intermediate_markdown = intermediate_mapping[markdown_path.resolve()]
    intermediate_markdown.write_text(
        rewrite_image_links(
            source_text,
            markdown_path,
            asset_mapping,
            intermediate_markdown,
        ),
        encoding="utf-8",
        newline="\n",
    )
    body = rewrite_image_links(
        source_text,
        markdown_path,
        asset_mapping,
        target_root / "transcript.md",
    )
    language = detect_language(body)

    transcript = target_root / "transcript.md"
    frontmatter = [
        "---",
        "type: derived-transcript",
        f"date: {generated_at[:10]}",
        f"source_slug: {yaml_string(args.slug)}",
        f"raw_file: {yaml_string(args.raw_relative)}",
        f"raw_sha256: {yaml_string(raw_hash)}",
        f"language: {yaml_string(language)}",
        f"generator: {yaml_string(args.engine)}",
        f"generator_version: {yaml_string(args.engine_version)}",
        f"generated_at: {yaml_string(generated_at)}",
        "ocr_used: unknown",
        "quality_status: needs-review",
        "graph-excluded: true",
        "---",
        "",
    ]
    transcript.write_text("\n".join(frontmatter) + body, encoding="utf-8", newline="\n")

    manifest = {
        "schema_version": 2,
        "derived_layout": "flat-v1",
        "source_slug": args.slug,
        "raw_file": args.raw_relative,
        "raw_sha256": raw_hash,
        "page_count": page_count,
        "language": language,
        "generated_at": generated_at,
        "parser": {
            "name": args.engine,
            "version": args.engine_version,
            "source_markdown": intermediate_mapping[markdown_path.resolve()]
            .relative_to(target_root)
            .as_posix(),
        },
        "ocr_used": "unknown",
        "quality_status": "needs-review",
        "translation": {"abstract": "pending" if language != "zh-CN" else "not-needed", "full": "not-requested"},
        "artifacts": artifact_records(target_root),
        "warnings": ["PDF page markers require manual verification."],
    }
    (target_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    print(json.dumps({"target": str(target_root), "manifest": manifest}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
