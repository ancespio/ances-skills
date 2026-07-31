#!/usr/bin/env python3
"""Record an already-given user approval and bind it to the subject SHA-256."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Persist an approval only after the user explicitly confirmed it in conversation. "
            "This command does not obtain or infer consent."
        )
    )
    parser.add_argument("run_dir")
    parser.add_argument("gate")
    parser.add_argument("subject", help="Subject path relative to run_dir")
    parser.add_argument("--decision-json", default="{}", help="JSON object with the user's exact choice")
    args = parser.parse_args()

    root = Path(args.run_dir).expanduser().resolve()
    subject = (root / args.subject).resolve()
    try:
        subject.relative_to(root)
    except ValueError:
        print("Approval subject must stay inside run_dir")
        return 1
    if not subject.is_file():
        print(f"Approval subject does not exist: {subject}")
        return 1
    try:
        decision = json.loads(args.decision_json)
    except json.JSONDecodeError as exc:
        print(f"Invalid --decision-json: {exc}")
        return 1
    if not isinstance(decision, dict):
        print("--decision-json must decode to an object")
        return 1

    record = {
        "schema_version": "pptx-workshop.approval.v1",
        "gate": args.gate,
        "status": "confirmed",
        "confirmed_by": "user",
        "subject_path": subject.relative_to(root).as_posix(),
        "subject_sha256": sha256(subject),
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        "decision": decision,
    }
    output = root / "approvals" / f"{args.gate}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
