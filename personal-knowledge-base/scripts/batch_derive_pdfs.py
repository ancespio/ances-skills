from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def source_records(repo_root: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for source_path in (repo_root / "wiki" / "sources").glob("*.md"):
        text = source_path.read_text(encoding="utf-8-sig", errors="replace")
        match = re.search(r'(?m)^raw_file:\s*["\']?([^"\'\n]+)', text)
        if not match:
            continue
        raw_relative = match.group(1).strip().replace("\\", "/")
        if not raw_relative.lower().endswith(".pdf"):
            continue
        raw_path = repo_root / raw_relative
        if not raw_path.is_file():
            continue
        records.append(
            {
                "slug": source_path.stem,
                "raw_file": raw_relative,
                "bytes": raw_path.stat().st_size,
            }
        )
    return sorted(records, key=lambda record: (int(record["bytes"]), str(record["slug"])))


def write_status(path: Path, records: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def finalize_target(python: Path, finalizer: Path, target: Path, repo_root: Path) -> str:
    result = subprocess.run(
        [str(python), str(finalizer), str(target), "--quality-status", "pass"],
        cwd=repo_root,
        text=True,
    )
    return "pass" if result.returncode == 0 else "needs-review"


def derive_one(
    record: dict[str, object],
    derive_script: Path,
    python: Path,
    finalizer: Path,
    repo_root: Path,
) -> str:
    result = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(derive_script),
            "-RawFile",
            str(record["raw_file"]),
            "-Slug",
            str(record["slug"]),
        ],
        cwd=repo_root,
        text=True,
    )
    if result.returncode != 0:
        return "derive-failed"
    target = repo_root / "wiki" / "derived" / "pdfs" / str(record["slug"])
    return finalize_target(python, finalizer, target, repo_root)


def batch_mineru(
    records: list[dict[str, object]],
    repo_root: Path,
    python: Path,
    normalizer: Path,
    finalizer: Path,
) -> dict[str, str]:
    runtime_root = repo_root / ".local" / "pdf-ingest"
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    work_root = runtime_root / "work" / f"batch-{timestamp}"
    input_root = work_root / "input"
    output_root = work_root / "mineru-output"
    normalized_root = work_root / "normalized"
    input_root.mkdir(parents=True)
    normalized_root.mkdir()

    for record in records:
        source = repo_root / str(record["raw_file"])
        target = input_root / source.name
        try:
            os.link(source, target)
        except OSError:
            shutil.copy2(source, target)

    mineru = runtime_root / ".venv" / "Scripts" / "mineru.exe"
    version = subprocess.run(
        [str(mineru), "--version"],
        cwd=repo_root,
        capture_output=True,
        text=True,
    ).stdout.strip()
    env = os.environ.copy()
    env.update(
        {
            "PIP_CACHE_DIR": str(runtime_root / "cache" / "pip"),
            "HF_HOME": str(runtime_root / "cache" / "huggingface"),
            "MODELSCOPE_CACHE": str(runtime_root / "cache" / "modelscope"),
            "TORCH_HOME": str(runtime_root / "cache" / "torch"),
            "MINERU_TOOLS_CONFIG_JSON": str(runtime_root / "cache" / "mineru.json"),
        }
    )
    result = subprocess.run(
        [
            str(mineru),
            "-p",
            str(input_root),
            "-o",
            str(output_root),
            "-b",
            "pipeline",
            "-m",
            "auto",
        ],
        cwd=repo_root,
        env=env,
        text=True,
    )
    if result.returncode != 0:
        return {str(record["slug"]): "batch-mineru-failed" for record in records}

    statuses: dict[str, str] = {}
    for record in records:
        slug = str(record["slug"])
        raw_path = repo_root / str(record["raw_file"])
        engine_output = output_root / raw_path.stem
        target = repo_root / "wiki" / "derived" / "pdfs" / slug
        normalized = normalized_root / slug
        if not engine_output.is_dir():
            statuses[slug] = "batch-output-missing"
            continue
        normalize = subprocess.run(
            [
                str(python),
                str(normalizer),
                "--raw",
                str(raw_path),
                "--raw-relative",
                str(record["raw_file"]),
                "--slug",
                slug,
                "--engine",
                "mineru",
                "--engine-version",
                version,
                "--engine-output",
                str(engine_output),
                "--target",
                str(normalized),
            ],
            cwd=repo_root,
            text=True,
        )
        if normalize.returncode != 0:
            statuses[slug] = "normalize-failed"
            continue
        shutil.move(str(normalized), str(target))
        statuses[slug] = finalize_target(python, finalizer, target, repo_root)
    return statuses


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--slug", action="append", default=[])
    parser.add_argument("--stop-on-error", action="store_true")
    parser.add_argument("--per-file", action="store_true")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    derive_script = repo_root / "scripts" / "derive-pdf.ps1"
    normalizer = repo_root / "scripts" / "normalize_pdf_derivative.py"
    finalizer = repo_root / "scripts" / "finalize_pdf_derivative.py"
    python = repo_root / ".local" / "pdf-ingest" / ".venv" / "Scripts" / "python.exe"
    status_path = repo_root / ".local" / "pdf-ingest" / "work" / "batch-derive-status.json"
    selected = set(args.slug)
    records = source_records(repo_root)
    if selected:
        records = [record for record in records if record["slug"] in selected]
    if args.limit is not None:
        records = records[: args.limit]

    statuses: list[dict[str, object]] = []
    failures = 0
    pending: list[dict[str, object]] = []
    for record in records:
        slug = str(record["slug"])
        target = repo_root / "wiki" / "derived" / "pdfs" / slug
        status = {
            **record,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        if target.exists():
            status["status"] = "skipped-existing"
            statuses.append(status)
            write_status(status_path, statuses)
            continue
        pending.append(record)

    batch_statuses = (
        {}
        if args.per_file or not pending
        else batch_mineru(pending, repo_root, python, normalizer, finalizer)
    )
    for record in pending:
        slug = str(record["slug"])
        status = {
            **record,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        result = batch_statuses.get(slug)
        if result in {None, "batch-mineru-failed", "batch-output-missing", "normalize-failed"}:
            result = derive_one(record, derive_script, python, finalizer, repo_root)
        status["status"] = result
        status["finished_at"] = datetime.now(timezone.utc).isoformat()
        if result != "pass":
            failures += 1
            if args.stop_on_error:
                statuses.append(status)
                write_status(status_path, statuses)
                return 1
        statuses.append(status)
        write_status(status_path, statuses)

    print(json.dumps({"processed": len(statuses), "failures": failures}, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
