from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path


MARKDOWN_IMAGE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
HTML_IMAGE = re.compile(r"(<img\b[^>]*\bsrc=[\"'])([^\"']+)([\"'])", re.IGNORECASE)


def is_external(target: str) -> bool:
    return target.startswith(("http://", "https://", "#", "data:"))


def resolve_target(document: Path, target: str) -> Path:
    value = target.strip().strip("<>").split("#", 1)[0].replace("\\", "/")
    return document.parent / value


def repair_document(document: Path) -> tuple[int, list[str]]:
    text = document.read_text(encoding="utf-8-sig")
    asset_root = next(
        (parent / "assets" for parent in document.parents if (parent / "assets").is_dir()),
        None,
    )
    if asset_root is None:
        return 0, []
    assets = {path.name for path in asset_root.glob("*") if path.is_file()}
    changes = 0

    def rewritten_target(target: str) -> str | None:
        nonlocal changes
        if is_external(target) or resolve_target(document, target).is_file():
            return None
        name = Path(target.split("#", 1)[0].replace("\\", "/")).name
        if name not in assets:
            return None
        changes += 1
        return os.path.relpath(asset_root / name, document.parent).replace("\\", "/")

    def replace_markdown(match: re.Match[str]) -> str:
        label, target = match.groups()
        rewritten = rewritten_target(target)
        return f"![{label}]({rewritten})" if rewritten else match.group(0)

    def replace_html(match: re.Match[str]) -> str:
        prefix, target, suffix = match.groups()
        rewritten = rewritten_target(target)
        return f"{prefix}{rewritten}{suffix}" if rewritten else match.group(0)

    updated = HTML_IMAGE.sub(replace_html, MARKDOWN_IMAGE.sub(replace_markdown, text))
    if updated != text:
        document.write_text(updated, encoding="utf-8", newline="\n")

    unresolved: list[str] = []
    for _, target in MARKDOWN_IMAGE.findall(updated):
        if not is_external(target) and not resolve_target(document, target).is_file():
            unresolved.append(target)
    for _, target, _ in HTML_IMAGE.findall(updated):
        if not is_external(target) and not resolve_target(document, target).is_file():
            unresolved.append(target)
    return changes, unresolved


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", action="append", default=[])
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    selected = set(args.slug)
    total_changes = 0
    unresolved: dict[str, list[str]] = {}
    for target in sorted((repo_root / "wiki" / "derived" / "pdfs").iterdir()):
        if not target.is_dir() or selected and target.name not in selected:
            continue
        documents = [
            target / name
            for name in ("transcript.md", "abstract.zh-CN.md", "translation.zh-CN.md")
        ]
        documents.extend(target.glob("intermediate/**/document.md"))
        for document in documents:
            if not document.is_file():
                continue
            changes, broken = repair_document(document)
            total_changes += changes
            if broken:
                unresolved[document.relative_to(repo_root).as_posix()] = broken
    print(json.dumps({"rewritten": total_changes, "unresolved": unresolved}, ensure_ascii=False))
    return 1 if unresolved else 0


if __name__ == "__main__":
    raise SystemExit(main())
