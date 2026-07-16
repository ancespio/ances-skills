import hashlib
import json
import tempfile
import unittest
from pathlib import Path

if __package__:
    from scripts.lint import Page, check_cross_language_duplicates, check_derived_integrity
else:
    from lint import Page, check_cross_language_duplicates, check_derived_integrity


def source_page(name: str, source_url: str) -> Page:
    text = f"""---
type: source
date: 2026-07-11
source_url: \"{source_url}\"
---

# Test source
"""
    return Page(Path(name), Path("sources") / name, text)


class CrossLanguageDuplicateTests(unittest.TestCase):
    def test_distinct_dois_are_not_near_duplicates(self) -> None:
        pages = [
            source_page("one.md", "https://doi.org/10.1038/s41598-023-41516-4"),
            source_page("two.md", "https://doi.org/10.1038/s41598-025-24725-x"),
        ]

        self.assertEqual(check_cross_language_duplicates(pages), [])


class DerivedIntegrityTests(unittest.TestCase):
    def make_fixture(self, root: Path) -> tuple[list[Page], Path]:
        raw = root / "raw" / "pdfs" / "paper.pdf"
        raw.parent.mkdir(parents=True)
        raw.write_bytes(b"pdf evidence")
        raw_hash = hashlib.sha256(raw.read_bytes()).hexdigest().upper()

        target = root / "wiki" / "derived" / "pdfs" / "paper"
        target.mkdir(parents=True)
        transcript = target / "transcript.md"
        transcript.write_text(
            "---\ntype: derived-transcript\ndate: 2026-07-16\n"
            "source_slug: paper\nraw_sha256: " + raw_hash + "\n"
            "graph-excluded: true\n---\n<!-- page: 1 -->\n# Paper\n",
            encoding="utf-8",
        )
        transcript_hash = hashlib.sha256(transcript.read_bytes()).hexdigest().upper()
        manifest = {
            "source_slug": "paper",
            "raw_file": "raw/pdfs/paper.pdf",
            "raw_sha256": raw_hash,
            "quality_status": "pass",
            "page_count": 1,
            "artifacts": [
                {
                    "path": "transcript.md",
                    "bytes": transcript.stat().st_size,
                    "sha256": transcript_hash,
                }
            ],
        }
        (target / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        source_text = (
            "---\ntype: source\ndate: 2026-07-16\n"
            "raw_file: raw/pdfs/paper.pdf\nraw_sha256: " + raw_hash + "\n"
            "derived_manifest: wiki/derived/pdfs/paper/manifest.json\n"
            "derived_transcript: wiki/derived/pdfs/paper/transcript.md\n"
            "derived_status: pass\n---\n# Paper\n"
        )
        source_path = root / "wiki" / "sources" / "paper.md"
        source_path.parent.mkdir(parents=True)
        source_path.write_text(source_text, encoding="utf-8")
        pages = [Page(source_path, Path("sources/paper.md"), source_text)]
        return pages, transcript

    def test_valid_derivative_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pages, _transcript = self.make_fixture(root)
            self.assertEqual(
                check_derived_integrity(pages, root, root / "wiki", root / "raw"),
                [],
            )

    def test_tampered_derivative_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pages, transcript = self.make_fixture(root)
            transcript.write_text(transcript.read_text(encoding="utf-8") + "tampered\n", encoding="utf-8")
            issues = check_derived_integrity(pages, root, root / "wiki", root / "raw")
            self.assertTrue(any("artifact SHA mismatch" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
