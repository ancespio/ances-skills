from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
WIKI_DIR = ROOT / "wiki"
RAW_DIR = ROOT / "raw"
REPORT_DIR = WIKI_DIR / "outputs"

WIKILINK_RE = re.compile(r"(?<!!)\[\[([^\]]+)\]\]")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
STALE_DAYS = {"high": 90, "medium": 180, "low": 365}
SYSTEM_FILES = {
    Path("index.md"),
    Path("log.md"),
    Path("overview.md"),
    Path("QUESTIONS.md"),
}
KNOWLEDGE_DIRS = {"sources", "concepts", "entities", "synthesis"}


class Page:
    def __init__(self, path: Path, rel: Path, text: str) -> None:
        self.path = path
        self.rel = rel
        self.text = text
        self.frontmatter_text = ""
        self.frontmatter: dict[str, Any] = {}
        self.body = text
        self.yaml_error = ""
        self.has_frontmatter = False
        self._parse()

    def _parse(self) -> None:
        if not self.text.startswith("---\n") and not self.text.startswith("---\r\n"):
            self.yaml_error = "missing frontmatter delimiter"
            return

        normalized = self.text.replace("\r\n", "\n")
        end = normalized.find("\n---\n", 4)
        if end == -1:
            self.yaml_error = "missing closing frontmatter delimiter"
            return

        self.has_frontmatter = True
        self.frontmatter_text = normalized[4:end]
        self.body = normalized[end + 5 :]
        try:
            self.frontmatter = parse_frontmatter(self.frontmatter_text)
        except ValueError as exc:
            self.yaml_error = str(exc)


def parse_frontmatter(text: str) -> dict[str, Any]:
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(text) or {}
        if not isinstance(data, dict):
            raise ValueError("frontmatter is not a mapping")
        return dict(data)
    except ImportError:
        return parse_frontmatter_minimal(text)
    except Exception as exc:  # YAML syntax errors are reported as lint issues.
        raise ValueError(f"invalid YAML: {exc}") from exc


def parse_frontmatter_minimal(text: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    current_array_key: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        if stripped.startswith("- "):
            if current_array_key is None:
                raise ValueError(f"array item without key: {raw_line}")
            data.setdefault(current_array_key, []).append(parse_scalar(stripped[2:].strip()))
            continue

        if ":" not in line:
            raise ValueError(f"invalid line: {raw_line}")

        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            raise ValueError(f"empty key: {raw_line}")

        if value == "":
            data[key] = []
            current_array_key = key
        else:
            data[key] = parse_scalar(value)
            current_array_key = key if isinstance(data[key], list) else None

    return data


def parse_scalar(value: str) -> Any:
    if value in {"true", "True"}:
        return True
    if value in {"false", "False"}:
        return False
    if value in {"[]", ""}:
        return []
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [parse_scalar(part.strip()) for part in inner.split(",")]
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    return value


def read_pages() -> list[Page]:
    pages: list[Page] = []
    for path in sorted(WIKI_DIR.rglob("*.md")):
        rel = path.relative_to(WIKI_DIR)
        if "intermediate" in rel.parts:
            continue
        text = path.read_text(encoding="utf-8-sig")
        pages.append(Page(path, rel, text))
    return pages


def rel_display(path: Path) -> str:
    return path.as_posix()


def normalize_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value is None:
        return None
    text = str(value).strip()
    if not text or text == "YYYY-MM-DD":
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, tuple):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    return [text] if text else []


def page_targets(pages: list[Page]) -> set[str]:
    targets: set[str] = set()
    stems: defaultdict[str, int] = defaultdict(int)
    for page in pages:
        if page.rel.parts and page.rel.parts[0] == "outputs":
            continue
        no_suffix = page.rel.with_suffix("").as_posix()
        targets.add(no_suffix)
        targets.add(page.rel.stem)
        stems[page.rel.stem] += 1

    ambiguous = {stem for stem, count in stems.items() if count > 1}
    return {target for target in targets if target not in ambiguous}


def extract_wikilinks(text: str) -> list[tuple[str, str | None]]:
    links: list[tuple[str, str | None]] = []
    for match in WIKILINK_RE.finditer(text):
        raw = match.group(1).strip()
        target_part, _, alias = raw.partition("|")
        target = target_part.split("#", 1)[0].strip()
        links.append((target, alias.strip() or None))
    return links


def normalized_target(target: str) -> str:
    target = target.strip()
    if target.startswith("wiki/"):
        target = target[5:]
    if target.endswith(".md"):
        target = target[:-3]
    return target.strip("/")


def check_frontmatter(pages: list[Page]) -> list[str]:
    issues: list[str] = []
    for page in pages:
        missing = []
        if page.yaml_error:
            issues.append(f"- {rel_display(page.rel)}: {page.yaml_error}")
            continue
        if "type" not in page.frontmatter:
            missing.append("type")
        if "date" not in page.frontmatter:
            missing.append("date")
        if missing:
            issues.append(f"- {rel_display(page.rel)}: missing {', '.join(missing)}")
    return issues


def check_broken_wikilinks(pages: list[Page]) -> list[str]:
    targets = page_targets(pages)
    issues: list[str] = []
    for page in pages:
        if page.rel.parts and page.rel.parts[0] == "outputs":
            continue
        for target, alias in extract_wikilinks(page.text):
            normalized = normalized_target(target)
            if normalized not in targets:
                suffix = f" alias '{alias}'" if alias else ""
                issues.append(f"- {rel_display(page.rel)}: broken link [[{target}]]{suffix}")
    return issues


def check_index_consistency(pages: list[Page]) -> list[str]:
    index = WIKI_DIR / "index.md"
    if not index.exists():
        return ["- wiki/index.md does not exist"]

    targets = page_targets(pages)
    text = index.read_text(encoding="utf-8-sig")
    issues: list[str] = []
    for target, _alias in extract_wikilinks(text):
        normalized = normalized_target(target)
        if normalized not in targets:
            issues.append(f"- index.md references missing page [[{target}]]")

    for match in re.finditer(r"wiki/[A-Za-z0-9_./-]+\.md", text):
        raw_path = match.group(0)
        rel = Path(raw_path[5:])
        if not (WIKI_DIR / rel).exists():
            issues.append(f"- index.md references missing file {raw_path}")

    return sorted(set(issues))


def check_stub_pages(pages: list[Page]) -> list[str]:
    issues: list[str] = []
    for page in pages:
        if not page.rel.parts or page.rel.parts[0] not in KNOWLEDGE_DIRS:
            continue
        body_without_links = re.sub(WIKILINK_RE, "", page.body)
        visible_chars = re.sub(r"\s+", "", body_without_links)
        if len(visible_chars) < 100:
            issues.append(f"- {rel_display(page.rel)}: body has {len(visible_chars)} non-space chars")
    return issues


def slug_jaccard(a: str, b: str) -> float:
    a_tokens = set(a.split("-"))
    b_tokens = set(b.split("-"))
    if not a_tokens or not b_tokens:
        return 0.0
    return len(a_tokens & b_tokens) / len(a_tokens | b_tokens)


def check_near_duplicate_concepts(pages: list[Page]) -> list[str]:
    concepts = [page for page in pages if page.rel.parts[:1] == ("concepts",)]
    issues: list[str] = []
    for i, left in enumerate(concepts):
        for right in concepts[i + 1 :]:
            score = slug_jaccard(left.rel.stem, right.rel.stem)
            if score > 0.7:
                issues.append(
                    f"- {rel_display(left.rel)} <-> {rel_display(right.rel)}: Jaccard={score:.2f}"
                )
    return issues


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check_sha_integrity(pages: list[Page]) -> list[str]:
    issues: list[str] = []
    for page in pages:
        if page.rel.parts[:1] != ("sources",):
            continue
        raw_file = str(page.frontmatter.get("raw_file", "")).strip()
        expected_hash = str(page.frontmatter.get("raw_sha256", "")).strip().lower()
        if not raw_file or not expected_hash:
            continue
        raw_path = ROOT / raw_file
        try:
            resolved = raw_path.resolve()
        except OSError:
            issues.append(f"- {rel_display(page.rel)}: raw file path is invalid: {raw_file}")
            continue
        try:
            resolved.relative_to(RAW_DIR.resolve())
        except ValueError:
            issues.append(f"- {rel_display(page.rel)}: raw_file is outside raw/: {raw_file}")
            continue
        if not resolved.exists():
            issues.append(f"- {rel_display(page.rel)}: raw file missing: {raw_file}")
            continue
        actual_hash = sha256_file(resolved)
        if actual_hash.lower() != expected_hash:
            issues.append(
                f"- {rel_display(page.rel)}: ⚠ SOURCE MODIFIED {raw_file} expected {expected_hash} actual {actual_hash}"
            )
    return issues


def check_derived_integrity(
    pages: list[Page],
    root: Path = ROOT,
    wiki_dir: Path = WIKI_DIR,
    raw_dir: Path = RAW_DIR,
) -> list[str]:
    derived_dir = wiki_dir / "derived" / "pdfs"
    if not derived_dir.exists():
        return []

    issues: list[str] = []
    sources = {
        page.rel.stem: page
        for page in pages
        if page.rel.parts[:1] == ("sources",)
    }
    for target in sorted(path for path in derived_dir.iterdir() if path.is_dir()):
        slug = target.name
        prefix = f"derived/pdfs/{slug}"
        manifest_path = target / "manifest.json"
        transcript_path = target / "transcript.md"
        if not manifest_path.exists() or not transcript_path.exists():
            issues.append(f"- {prefix}: manifest.json or transcript.md is missing")
            continue

        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as exc:
            issues.append(f"- {prefix}/manifest.json: invalid JSON: {exc}")
            continue

        if manifest.get("source_slug") != slug:
            issues.append(f"- {prefix}/manifest.json: source_slug does not match directory")
        raw_file = str(manifest.get("raw_file", "")).strip()
        expected_raw_hash = str(manifest.get("raw_sha256", "")).strip().lower()
        raw_path = (root / raw_file).resolve()
        try:
            raw_path.relative_to(raw_dir.resolve())
        except ValueError:
            issues.append(f"- {prefix}/manifest.json: raw_file is outside raw/: {raw_file}")
            continue
        if not raw_path.exists():
            issues.append(f"- {prefix}/manifest.json: raw file missing: {raw_file}")
        elif sha256_file(raw_path).lower() != expected_raw_hash:
            issues.append(f"- {prefix}/manifest.json: raw SHA-256 mismatch")

        source = sources.get(slug)
        if source is None:
            issues.append(f"- {prefix}: matching wiki/sources/{slug}.md is missing")
        else:
            expected_manifest = f"wiki/derived/pdfs/{slug}/manifest.json"
            expected_transcript = f"wiki/derived/pdfs/{slug}/transcript.md"
            if source.frontmatter.get("derived_manifest") != expected_manifest:
                issues.append(f"- sources/{slug}.md: derived_manifest is missing or incorrect")
            if source.frontmatter.get("derived_transcript") != expected_transcript:
                issues.append(f"- sources/{slug}.md: derived_transcript is missing or incorrect")
            if str(source.frontmatter.get("raw_sha256", "")).lower() != expected_raw_hash:
                issues.append(f"- sources/{slug}.md: raw SHA differs from derived manifest")
            if source.frontmatter.get("derived_status") != manifest.get("quality_status"):
                issues.append(f"- sources/{slug}.md: derived_status differs from manifest")

        markdown_paths = [transcript_path]
        markdown_paths.extend(
            path
            for path in (target / "abstract.zh-CN.md", target / "translation.zh-CN.md")
            if path.exists()
        )
        for markdown_path in markdown_paths:
            page = Page(
                markdown_path,
                markdown_path.relative_to(wiki_dir),
                markdown_path.read_text(encoding="utf-8-sig"),
            )
            if page.frontmatter.get("graph-excluded") is not True:
                issues.append(f"- {rel_display(page.rel)}: graph-excluded must be true")
            if page.frontmatter.get("source_slug") != slug:
                issues.append(f"- {rel_display(page.rel)}: source_slug mismatch")
            if str(page.frontmatter.get("raw_sha256", "")).lower() != expected_raw_hash:
                issues.append(f"- {rel_display(page.rel)}: raw SHA differs from manifest")

        page_count = manifest.get("page_count")
        anchors = re.findall(r"<!-- page: (\d+) -->", transcript_path.read_text(encoding="utf-8-sig"))
        if not isinstance(page_count, int) or anchors != [str(i) for i in range(1, page_count + 1)]:
            issues.append(f"- {prefix}/transcript.md: page anchors are incomplete or out of order")

        recorded: set[str] = set()
        for artifact in manifest.get("artifacts", []):
            if not isinstance(artifact, dict):
                issues.append(f"- {prefix}/manifest.json: invalid artifact entry")
                continue
            relative = str(artifact.get("path", ""))
            artifact_path = (target / relative).resolve()
            try:
                artifact_path.relative_to(target.resolve())
            except ValueError:
                issues.append(f"- {prefix}/manifest.json: artifact escapes target: {relative}")
                continue
            recorded.add(Path(relative).as_posix())
            if not artifact_path.exists():
                issues.append(f"- {prefix}/manifest.json: artifact missing: {relative}")
                continue
            if artifact_path.stat().st_size != artifact.get("bytes"):
                issues.append(f"- {prefix}/manifest.json: artifact size mismatch: {relative}")
            if sha256_file(artifact_path).lower() != str(artifact.get("sha256", "")).lower():
                issues.append(f"- {prefix}/manifest.json: artifact SHA mismatch: {relative}")
        actual = {
            path.relative_to(target).as_posix()
            for path in target.rglob("*")
            if path.is_file() and path.name != "manifest.json"
        }
        for relative in sorted(actual - recorded):
            issues.append(f"- {prefix}/manifest.json: unrecorded artifact: {relative}")
    return issues


def check_stale_pages(pages: list[Page]) -> list[str]:
    today = date.today()
    issues: list[str] = []
    for page in pages:
        volatility = str(page.frontmatter.get("domain_volatility", "")).strip().lower()
        if volatility not in STALE_DAYS:
            continue
        reviewed = (
            normalize_date(page.frontmatter.get("last_reviewed"))
            or normalize_date(page.frontmatter.get("last_verified"))
            or normalize_date(page.frontmatter.get("updated"))
            or normalize_date(page.frontmatter.get("date"))
        )
        if reviewed is None:
            continue
        age = (today - reviewed).days
        threshold = STALE_DAYS[volatility]
        if age > threshold:
            issues.append(
                f"- {rel_display(page.rel)}: {age} days old, volatility={volatility}, threshold={threshold}"
            )
    return issues


def normalize_url(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    parts = urlsplit(text)
    path = re.sub(r"/+$", "", parts.path)
    return urlunsplit((parts.scheme, parts.netloc.removeprefix("www."), path, "", ""))


def check_cross_language_duplicates(pages: list[Page]) -> list[str]:
    issues: list[str] = []
    sources = [page for page in pages if page.rel.parts[:1] == ("sources",)]
    for i, left in enumerate(sources):
        left_url = normalize_url(left.frontmatter.get("source_url"))
        if not left_url:
            continue
        for right in sources[i + 1 :]:
            right_url = normalize_url(right.frontmatter.get("source_url"))
            if not right_url:
                continue
            left_parts = urlsplit(left_url)
            right_parts = urlsplit(right_url)
            if (
                left_parts.netloc == "doi.org"
                and right_parts.netloc == "doi.org"
                and left_parts.path != right_parts.path
            ):
                continue
            if (
                left_parts.netloc == "arxiv.org"
                and right_parts.netloc == "arxiv.org"
                and re.fullmatch(r"/abs/\d{4}\.\d{4,5}(?:v\d+)?", left_parts.path)
                and re.fullmatch(r"/abs/\d{4}\.\d{4,5}(?:v\d+)?", right_parts.path)
                and left_parts.path != right_parts.path
            ):
                continue
            score = SequenceMatcher(None, left_url, right_url).ratio()
            if score >= 0.85 and left_url != right_url:
                issues.append(
                    f"- URL similar: {rel_display(left.rel)} <-> {rel_display(right.rel)} ratio={score:.2f}"
                )

    concepts = [page for page in pages if page.rel.parts[:1] == ("concepts",)]
    alias_map: dict[Path, set[str]] = {}
    for page in concepts:
        alias_map[page.rel] = {alias.lower() for alias in as_list(page.frontmatter.get("aliases"))}

    for i, left in enumerate(concepts):
        for right in concepts[i + 1 :]:
            overlap = alias_map[left.rel] & alias_map[right.rel]
            if overlap:
                shown = ", ".join(sorted(overlap))
                issues.append(
                    f"- Alias overlap: {rel_display(left.rel)} <-> {rel_display(right.rel)} aliases={shown}"
                )
    return issues


def check_wikilink_format(pages: list[Page]) -> list[str]:
    targets = page_targets(pages)
    forbidden = {"log", "index", "overview", "QUESTIONS", "ingest", "query", "reflect"}
    issues: list[str] = []
    for page in pages:
        if page.rel.parts and page.rel.parts[0] == "outputs":
            continue
        for target, alias in extract_wikilinks(page.text):
            normalized = normalized_target(target)
            basename = normalized.rsplit("/", 1)[-1]
            if "/" in normalized or not SLUG_RE.match(basename):
                issues.append(f"- {rel_display(page.rel)}: non-slug wikilink target [[{target}]]")
            if basename in forbidden or normalized.startswith("outputs/lint-"):
                issues.append(f"- {rel_display(page.rel)}: forbidden wikilink target [[{target}]]")
            if alias and normalized not in targets:
                issues.append(f"- {rel_display(page.rel)}: alias link target missing [[{target}|{alias}]]")
    return sorted(set(issues))


def build_report(checks: list[tuple[str, list[str]]]) -> str:
    today = date.today().isoformat()
    total_issues = sum(len(items) for _name, items in checks)
    lines = [
        "---",
        "type: lint-report",
        f"date: {today}",
        "graph-excluded: true",
        "---",
        "",
        f"# Lint Report {today}",
        "",
        f"Total issues: {total_issues}",
        "",
        "## Checks",
        "",
    ]

    for index, (name, issues) in enumerate(checks, start=1):
        status = "PASS" if not issues else f"{len(issues)} issue(s)"
        lines.extend([f"### {index}. {name}", "", f"Status: {status}", ""])
        if issues:
            lines.extend(issues)
            lines.append("")
        else:
            lines.extend(["- No issues found.", ""])

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    if not WIKI_DIR.exists():
        print("wiki/ does not exist", file=sys.stderr)
        return 1

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    pages = read_pages()
    checks = [
        ("YAML frontmatter legality, type, and date", check_frontmatter(pages)),
        ("Broken Wikilinks", check_broken_wikilinks(pages)),
        ("Index consistency", check_index_consistency(pages)),
        ("Stub pages", check_stub_pages(pages)),
        ("Near-duplicate concept slugs", check_near_duplicate_concepts(pages)),
        ("SHA-256 source integrity", check_sha_integrity(pages)),
        ("PDF derived integrity", check_derived_integrity(pages)),
        ("Stale pages", check_stale_pages(pages)),
        ("Cross-language duplicates", check_cross_language_duplicates(pages)),
        ("Wikilink format and alias link validity", check_wikilink_format(pages)),
    ]
    report = build_report(checks)
    report_path = REPORT_DIR / f"lint-{date.today().isoformat()}.md"
    report_path.write_text(report, encoding="utf-8")

    total_issues = sum(len(items) for _name, items in checks)
    print(f"Wrote {report_path.relative_to(ROOT).as_posix()}")
    print(f"Checks: {len(checks)}")
    print(f"Issues: {total_issues}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
