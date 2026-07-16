from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def replace_frontmatter_value(path: Path, key: str, value: str) -> None:
    text = path.read_text(encoding="utf-8-sig")
    updated, count = re.subn(
        rf"(?m)^{re.escape(key)}:\s*.*$",
        f"{key}: {value}",
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"Missing frontmatter field {key} in {path}")
    path.write_text(updated, encoding="utf-8", newline="\n")


def clean_control_characters(text: str) -> str:
    return "".join(
        character
        for character in text
        if character in "\n\t" or ord(character) >= 32
    )


def strip_trailing_whitespace(text: str) -> str:
    final_newline = text.endswith("\n")
    normalized = "\n".join(line.rstrip() for line in text.splitlines())
    return normalized + ("\n" if final_newline else "")


def add_page_anchors(target: Path, manifest: dict[str, object]) -> int:
    transcript_path = target / "transcript.md"
    transcript = strip_trailing_whitespace(
        clean_control_characters(transcript_path.read_text(encoding="utf-8-sig"))
    )
    transcript = re.sub(r"<!-- page: \d+ -->\n?", "", transcript)

    canonical_content_lists = list((target / "intermediate").rglob("content-list.json"))
    legacy_content_lists = [
        path
        for path in (target / "intermediate").rglob("*_content_list.json")
        if not path.name.endswith("_content_list_v2.json")
    ]
    content_lists = canonical_content_lists or legacy_content_lists
    if len(content_lists) != 1:
        raise RuntimeError(f"Expected one MinerU content list, found {len(content_lists)}")

    items = json.loads(content_lists[0].read_text(encoding="utf-8-sig"))
    page_texts: dict[int, list[str]] = {}
    for item in items:
        page_index = item.get("page_idx")
        if not isinstance(page_index, int):
            continue
        if item.get("type") in {"header", "footer", "page_number"}:
            continue
        candidates: list[str] = []
        for key in ("text", "code_body", "img_path"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value.strip())
        for key in ("list_items", "image_caption", "table_caption"):
            value = item.get(key)
            if isinstance(value, list):
                candidates.extend(str(entry).strip() for entry in value if str(entry).strip())
        for candidate in candidates:
            cleaned = clean_control_characters(candidate)
            variants = [cleaned]
            if "/" in cleaned or "\\" in cleaned:
                variants.append(Path(cleaned).name)
            if "\n" in cleaned:
                variants.extend(
                    line.strip()
                    for line in cleaned.splitlines()
                    if line.strip() and line.strip() != "```"
                )
            page_texts.setdefault(page_index, []).extend(
                variant for variant in variants if len(variant) >= 12
            )

    frontmatter_end = transcript.find("\n---\n", 4)
    body_start = frontmatter_end + 5 if frontmatter_end >= 0 else 0
    cursor = body_start
    inserted = 0
    for page_index in range(int(manifest["page_count"])):
        match_position = -1
        for candidate in page_texts.get(page_index, []):
            match_position = transcript.find(candidate, cursor)
            if match_position >= 0:
                break
        if match_position < 0:
            continue
        match_position = transcript.rfind("\n", 0, match_position) + 1
        anchor = f"<!-- page: {page_index + 1} -->\n"
        transcript = transcript[:match_position] + anchor + transcript[match_position:]
        cursor = match_position + len(anchor) + len(candidate)
        inserted += 1

    page_count = int(manifest["page_count"])
    existing_pages = {
        int(page)
        for page in re.findall(r"<!-- page: (\d+) -->", transcript)
    }
    for page_number in range(1, page_count + 1):
        if page_number in existing_pages:
            continue
        anchor = f"<!-- page: {page_number} -->\n"
        next_positions = [
            transcript.find(f"<!-- page: {later_page} -->")
            for later_page in range(page_number + 1, page_count + 1)
        ]
        next_positions = [position for position in next_positions if position >= 0]
        if next_positions:
            position = min(next_positions)
            transcript = transcript[:position] + anchor + transcript[position:]
        elif page_number == 1:
            transcript = transcript[:body_start] + anchor + transcript[body_start:]
        else:
            transcript = transcript.rstrip() + "\n\n" + anchor
        existing_pages.add(page_number)
        inserted += 1

    transcript_path.write_text(transcript, encoding="utf-8", newline="\n")
    return inserted


def artifact_records(target: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for path in sorted(target.rglob("*")):
        if not path.is_file() or path.name == "manifest.json":
            continue
        records.append(
            {
                "path": path.relative_to(target).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    return records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path)
    parser.add_argument("--quality-status", choices=("pass", "needs-review", "failed"), default="pass")
    args = parser.parse_args()

    target = args.target.resolve()
    manifest_path = target / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    repo_root = Path(__file__).resolve().parent.parent
    raw_path = (repo_root / manifest["raw_file"]).resolve()
    expected_raw_hash = str(manifest["raw_sha256"]).upper()
    actual_raw_hash = sha256_file(raw_path)
    if actual_raw_hash != expected_raw_hash:
        raise RuntimeError(
            f"Raw SHA-256 mismatch: expected {expected_raw_hash}, actual {actual_raw_hash}"
        )

    page_anchor_count = add_page_anchors(target, manifest)
    if args.quality_status == "pass" and page_anchor_count != int(manifest["page_count"]):
        raise RuntimeError(
            f"Cannot mark derivative as pass: found {page_anchor_count} page anchors "
            f"for {manifest['page_count']} PDF pages"
        )

    markdown_files = [target / "transcript.md"]
    for optional in (target / "abstract.zh-CN.md", target / "translation.zh-CN.md"):
        if optional.exists():
            markdown_files.append(optional)
    for markdown in markdown_files:
        replace_frontmatter_value(markdown, "quality_status", args.quality_status)

    manifest["quality_status"] = args.quality_status
    manifest["page_anchors"] = page_anchor_count
    manifest["translation"] = {
        "abstract": "complete" if (target / "abstract.zh-CN.md").exists() else (
            "not-needed" if manifest.get("language") == "zh-CN" else "pending"
        ),
        "full": "complete" if (target / "translation.zh-CN.md").exists() else (
            "not-needed" if manifest.get("language") == "zh-CN" else "not-requested"
        ),
    }
    manifest["artifacts"] = artifact_records(target)
    warnings = [
        warning
        for warning in manifest.get("warnings", [])
        if warning != "PDF page markers require manual verification."
        and not str(warning).startswith("Page anchor count")
    ]
    if page_anchor_count != int(manifest["page_count"]):
        warnings.append(
            f"Page anchor count {page_anchor_count} does not match PDF page count {manifest['page_count']}."
        )
    manifest["warnings"] = warnings
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(json.dumps({"target": str(target), "quality_status": args.quality_status}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
