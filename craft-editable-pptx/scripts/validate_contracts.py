#!/usr/bin/env python3
"""Validate craft-editable-pptx scenario contracts and hard gates."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCENARIOS = {
    "new-deck",
    "template-fill",
    "reconstruction",
    "reference-deck",
    "existing-deck",
}
PHASES = {"plan", "preview", "final"}
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
SLIDE_RE = re.compile(r"^P\d{2,3}$")
DOCS = {
    "brief": "plans/brief.json",
    "outline": "plans/outline.json",
    "slide_plan": "plans/slide_plan.json",
    "evidence_plan": "plans/evidence_plan.json",
    "asset_plan": "plans/asset_plan.json",
    "template_analysis": "plans/template_analysis.json",
    "adaptation_report": "plans/adaptation_report.json",
    "fill_plan": "plans/fill_plan.json",
    "reconstruction_plan": "plans/reconstruction_plan.json",
    "reference_profile": "plans/reference_profile.json",
    "change_plan": "plans/change_plan.json",
    "build_plan": "plans/build_plan.json",
    "artifacts": "manifests/pptx_artifacts.json",
    "report": "manifests/editability_report.json",
}
SCHEMA_VERSIONS = {
    "brief": "craft-editable-pptx.brief.v2",
    "outline": "craft-editable-pptx.outline.v2",
    "slide_plan": "craft-editable-pptx.slide-plan.v2",
    "evidence_plan": "craft-editable-pptx.evidence-plan.v1",
    "asset_plan": "craft-editable-pptx.asset-plan.v1",
    "template_analysis": "craft-editable-pptx.template-analysis.v1",
    "adaptation_report": "craft-editable-pptx.adaptation-report.v1",
    "fill_plan": "craft-editable-pptx.fill-plan.v1",
    "reconstruction_plan": "craft-editable-pptx.reconstruction-plan.v1",
    "reference_profile": "craft-editable-pptx.reference-profile.v1",
    "change_plan": "craft-editable-pptx.change-plan.v1",
    "build_plan": "craft-editable-pptx.build-plan.v2",
    "artifacts": "craft-editable-pptx.pptx-artifacts.v1",
    "report": "craft-editable-pptx.editability-report.v2",
}
PLAN_DOCS = {
    "new-deck": ["brief", "evidence_plan", "outline", "slide_plan", "asset_plan"],
    "template-fill": ["brief", "template_analysis", "adaptation_report", "fill_plan"],
    "reconstruction": ["brief", "reconstruction_plan", "asset_plan"],
    "reference-deck": [
        "brief", "reference_profile", "evidence_plan", "outline", "slide_plan", "asset_plan"
    ],
    "existing-deck": ["brief", "change_plan"],
}
CONFIRMED_STATUS = "confirmed"


class ContractError(ValueError):
    """Raised when one or more hard gates fail."""


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContractError(f"missing file: {path}") from exc
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"invalid UTF-8 JSON: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ContractError(f"top-level JSON must be an object: {path}")
    return value


def require(obj: dict[str, Any], fields: list[str], context: str) -> None:
    missing = [field for field in fields if field not in obj]
    if missing:
        raise ContractError(f"{context} missing fields: {', '.join(missing)}")


def resolve_inside(root: Path, relative: str, context: str) -> Path:
    path = (root / relative).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise ContractError(f"{context} must stay inside run directory: {relative}") from exc
    return path


def load_doc(root: Path, key: str, run_id: str) -> dict[str, Any]:
    doc = load_json(root / DOCS[key])
    expected = SCHEMA_VERSIONS[key]
    if doc.get("schema_version") != expected:
        raise ContractError(f"{DOCS[key]}.schema_version must be {expected}")
    if doc.get("run_id") != run_id:
        raise ContractError(f"{DOCS[key]}.run_id does not match project.json")
    if doc.get("status") == "confirmed_by_delegation":
        raise ContractError(f"{DOCS[key]} may not use confirmed_by_delegation")
    return doc


def validate_project_file(root: Path) -> dict[str, Any]:
    project = load_json(root / "project.json")
    require(
        project,
        ["schema_version", "run_id", "scenario", "phase", "source_files", "new_page_count"],
        "project.json",
    )
    if project["schema_version"] != "craft-editable-pptx.project.v1":
        raise ContractError("project.json.schema_version is invalid")
    if project["scenario"] not in SCENARIOS:
        raise ContractError("project.json.scenario is invalid")
    if not isinstance(project["new_page_count"], int) or project["new_page_count"] < 0:
        raise ContractError("project.json.new_page_count must be a non-negative integer")
    sources = project["source_files"]
    if not isinstance(sources, list):
        raise ContractError("project.json.source_files must be an array")
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ContractError(f"project.json.source_files[{index}] must be an object")
        require(source, ["path", "sha256", "role"], f"project.json.source_files[{index}]")
        path = Path(source["path"]).expanduser().resolve()
        if not path.is_file():
            raise ContractError(f"source file does not exist: {path}")
        if source["sha256"] != sha256(path):
            raise ContractError(f"source hash mismatch: {path}")
    return project


def slide_ids(doc: dict[str, Any], context: str) -> list[str]:
    slides = doc.get("slides")
    if not isinstance(slides, list) or not slides:
        raise ContractError(f"{context}.slides must be a non-empty array")
    ids: list[str] = []
    for index, slide in enumerate(slides):
        if not isinstance(slide, dict) or not SLIDE_RE.fullmatch(str(slide.get("id", ""))):
            raise ContractError(f"{context}.slides[{index}].id must match PNN or PNNN")
        ids.append(slide["id"])
    if len(ids) != len(set(ids)):
        raise ContractError(f"{context}.slides contains duplicate ids")
    return ids


def validate_plan_docs(root: Path, project: dict[str, Any], phase: str) -> dict[str, dict[str, Any]]:
    scenario = project["scenario"]
    keys = list(PLAN_DOCS[scenario])
    if scenario == "existing-deck" and project["new_page_count"] > 0:
        keys.extend(["outline", "slide_plan"])
    docs = {key: load_doc(root, key, project["run_id"]) for key in keys}

    brief = docs["brief"]
    require(brief, ["scenario", "audience", "objective", "success_criteria"], "brief.json")
    if brief["scenario"] != scenario:
        raise ContractError("brief.json.scenario does not match project.json")
    if phase in {"preview", "final"}:
        unconfirmed = [key for key, doc in docs.items() if doc.get("status") != CONFIRMED_STATUS]
        if unconfirmed:
            raise ContractError("preview/final requires confirmed plan files: " + ", ".join(unconfirmed))

    if "outline" in docs:
        outline_ids = slide_ids(docs["outline"], "outline.json")
        plan_ids = slide_ids(docs["slide_plan"], "slide_plan.json")
        if outline_ids != plan_ids:
            raise ContractError("outline and slide plan roster/order differ")
        if scenario == "existing-deck" and len(plan_ids) != project["new_page_count"]:
            raise ContractError("existing-deck new slide plan count does not match project.new_page_count")

    if scenario == "template-fill":
        analysis = docs["template_analysis"]
        if analysis.get("template_kind") not in {"placeholder-based", "framework-only", "mixed"}:
            raise ContractError("template_analysis.template_kind is invalid")
        if not isinstance(analysis.get("slide_families"), list) or not analysis["slide_families"]:
            raise ContractError("template_analysis.slide_families must not be empty")
        if not slide_ids(docs["fill_plan"], "fill_plan.json"):
            raise ContractError("fill plan must contain slides")

    if scenario == "reconstruction":
        reconstruction = docs["reconstruction_plan"]
        if reconstruction.get("source_locked") is not True:
            raise ContractError("reconstruction_plan.source_locked must be true")
        ids = slide_ids(reconstruction, "reconstruction_plan.json")
        pages = [slide.get("source_page") for slide in reconstruction["slides"]]
        if pages != list(range(1, len(pages) + 1)):
            raise ContractError("reconstruction source pages must stay sequential and start at 1")
        for slide in reconstruction["slides"]:
            for item in slide.get("objects", []):
                if item.get("semantic_role") == "text" and item.get("target_kind") != "native_text":
                    raise ContractError(f"{slide['id']} semantic text must target native_text")
        assets = docs["asset_plan"].get("items")
        if not isinstance(assets, list):
            raise ContractError("asset_plan.items must be an array")
        for item in assets:
            if item.get("asset_type") != "svg":
                raise ContractError("reconstruction asset_type must be svg")
            if item.get("contains_semantic_text") is not False:
                raise ContractError("reconstruction SVG assets may not contain semantic text")
            if not str(item.get("source", "")).lower().endswith(".svg"):
                raise ContractError("reconstruction asset source must end in .svg")
        if ids != [f"P{i:02d}" for i in range(1, len(ids) + 1)]:
            raise ContractError("reconstruction slide ids must preserve source order")

    if scenario == "existing-deck":
        change = docs["change_plan"]
        if not isinstance(change.get("changes"), list) or not isinstance(change.get("new_pages"), list):
            raise ContractError("change_plan changes/new_pages must be arrays")
        if len(change["new_pages"]) != project["new_page_count"]:
            raise ContractError("change_plan.new_pages count does not match project.json")
        for index, item in enumerate(change["changes"]):
            require(
                item,
                ["source_slide", "selector", "before", "after", "preserve"],
                f"change_plan.changes[{index}]",
            )
            required_format = {"font", "font_size", "color", "position", "size", "paragraph", "fill", "border"}
            if not required_format.issubset(set(item["preserve"])):
                raise ContractError("existing-deck changes must preserve the complete format contract")
    return docs


def approval_records(root: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    approval_dir = root / "approvals"
    if not approval_dir.exists():
        return records
    for path in sorted(approval_dir.glob("*.json")):
        record = load_json(path)
        require(
            record,
            ["schema_version", "gate", "status", "confirmed_by", "subject_path", "subject_sha256", "confirmed_at", "decision"],
            str(path.relative_to(root)),
        )
        if record["schema_version"] != "craft-editable-pptx.approval.v1":
            raise ContractError(f"invalid approval schema: {path}")
        if record["status"] != "confirmed" or record["confirmed_by"] != "user":
            raise ContractError(f"approval must be explicitly confirmed by user: {path}")
        subject = resolve_inside(root, record["subject_path"], "approval subject")
        if not subject.is_file() or record["subject_sha256"] != sha256(subject):
            raise ContractError(f"approval subject is missing or stale: {path}")
        records.append(record)
    return records


def require_approval(
    records: list[dict[str, Any]], gate: str, root: Path, subject: Path | None = None
) -> dict[str, Any]:
    candidates = [record for record in records if record["gate"] == gate]
    if subject is not None:
        relative = subject.resolve().relative_to(root).as_posix()
        candidates = [record for record in candidates if Path(record["subject_path"]).as_posix() == relative]
    if not candidates:
        label = f" for {subject.relative_to(root)}" if subject else ""
        raise ContractError(f"missing user approval: {gate}{label}")
    return candidates[0]


def pptx_slide_count(path: Path) -> int:
    try:
        with zipfile.ZipFile(path) as archive:
            return sum(
                1
                for name in archive.namelist()
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            )
    except (OSError, zipfile.BadZipFile) as exc:
        raise ContractError(f"invalid PPTX package: {path}: {exc}") from exc


def validate_artifacts(root: Path, run_id: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*.pptx")
        if path.is_file()
    }
    manifest_path = root / DOCS["artifacts"]
    if not actual and not manifest_path.exists():
        return None, []
    manifest = load_doc(root, "artifacts", run_id)
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise ContractError("pptx_artifacts.json.artifacts must not be empty")
    registered: set[str] = set()
    ids: set[str] = set()
    for index, artifact in enumerate(artifacts):
        context = f"pptx_artifacts.artifacts[{index}]"
        require(
            artifact,
            ["id", "purpose", "path", "sha256", "qa_path", "expected_pages", "reusable", "parents"],
            context,
        )
        if artifact["id"] in ids:
            raise ContractError(f"duplicate artifact id: {artifact['id']}")
        ids.add(artifact["id"])
        pptx = resolve_inside(root, artifact["path"], context)
        if not pptx.is_file() or pptx.suffix.lower() != ".pptx":
            raise ContractError(f"artifact PPTX missing: {pptx}")
        relative = pptx.relative_to(root).as_posix()
        registered.add(relative)
        if artifact["sha256"] != sha256(pptx):
            raise ContractError(f"artifact hash mismatch: {relative}")
        expected_pages = artifact["expected_pages"]
        if not isinstance(expected_pages, int) or expected_pages < 1:
            raise ContractError(f"{context}.expected_pages must be positive")
        if pptx_slide_count(pptx) != expected_pages:
            raise ContractError(f"PPTX slide count does not match expected_pages: {relative}")
        parents = artifact["parents"]
        if not isinstance(parents, list) or not parents:
            raise ContractError(f"{context}.parents must be a non-empty array")
        for parent_index, parent in enumerate(parents):
            parent_context = f"{context}.parents[{parent_index}]"
            require(parent, ["path", "sha256"], parent_context)
            parent_path = resolve_inside(root, parent["path"], parent_context)
            if not parent_path.is_file() or parent["sha256"] != sha256(parent_path):
                raise ContractError(f"artifact parent is missing or stale: {parent['path']}")

        qa_path = resolve_inside(root, artifact["qa_path"], f"{context}.qa_path")
        qa = load_json(qa_path)
        require(
            qa,
            ["schema_version", "artifact_id", "pptx_path", "pptx_sha256", "render_dir", "rendered_pages", "inspected_pages", "inspected_by", "status", "checks", "issues"],
            str(qa_path.relative_to(root)),
        )
        if qa["schema_version"] != "craft-editable-pptx.visual-qa.v1":
            raise ContractError(f"invalid visual QA schema: {qa_path}")
        if qa["artifact_id"] != artifact["id"] or qa["pptx_sha256"] != artifact["sha256"]:
            raise ContractError(f"visual QA does not bind current artifact: {qa_path}")
        if Path(qa["pptx_path"]).as_posix() != Path(artifact["path"]).as_posix():
            raise ContractError(f"visual QA pptx_path mismatch: {qa_path}")
        if qa["status"] != "pass" or qa["inspected_by"] not in {"agent", "user"}:
            raise ContractError(f"visual QA must be passed after actual inspection: {qa_path}")
        render_dir = resolve_inside(root, qa["render_dir"], "visual QA render_dir")
        if not render_dir.is_dir():
            raise ContractError(f"visual QA render_dir missing: {render_dir}")
        rendered = qa["rendered_pages"]
        inspected = qa["inspected_pages"]
        if len(rendered) != expected_pages or inspected != list(range(1, expected_pages + 1)):
            raise ContractError(f"visual QA must render and inspect every page: {qa_path}")
        for page in rendered:
            image = resolve_inside(root, page, "visual QA rendered page")
            if not image.is_file():
                raise ContractError(f"rendered page missing: {image}")
    if registered != actual:
        missing = sorted(actual - registered)
        stale = sorted(registered - actual)
        raise ContractError(f"PPTX registry mismatch; unregistered={missing}, missing={stale}")
    return manifest, artifacts


def artifact_by_purpose(artifacts: list[dict[str, Any]], purpose: str) -> list[dict[str, Any]]:
    return [artifact for artifact in artifacts if artifact.get("purpose") == purpose]


def artifact_path(root: Path, artifact: dict[str, Any]) -> Path:
    return resolve_inside(root, artifact["path"], "artifact path")


def require_preview_contract(
    root: Path,
    project: dict[str, Any],
    docs: dict[str, dict[str, Any]],
    artifacts: list[dict[str, Any]],
    approvals: list[dict[str, Any]],
) -> None:
    scenario = project["scenario"]
    if not artifacts:
        raise ContractError("preview requires registered PPTX artifacts")

    if "evidence_plan" in docs and any(item.get("included") for item in docs["evidence_plan"].get("items", [])):
        require_approval(approvals, "evidence-inclusion", root, root / DOCS["evidence_plan"])
    if "asset_plan" in docs:
        require_approval(approvals, "asset-plan", root, root / DOCS["asset_plan"])

    if scenario == "new-deck":
        layouts = artifact_by_purpose(artifacts, "layout-preview")
        if len(layouts) != 1:
            raise ContractError("new-deck requires exactly one complete layout-preview PPTX")
        require_approval(approvals, "layout-preview", root, artifact_path(root, layouts[0]))
        styles = []
        for purpose in ("style-option-a", "style-option-b", "style-option-c"):
            found = artifact_by_purpose(artifacts, purpose)
            if len(found) != 1 or found[0]["expected_pages"] != 3 or found[0]["reusable"] is not True:
                raise ContractError(f"{purpose} must be one reusable 3-page PPTX")
            styles.extend(found)
        if not any(
            require_candidate.get("gate") == "style-choice"
            and Path(require_candidate["subject_path"]).as_posix()
            in {Path(item["path"]).as_posix() for item in styles}
            for require_candidate in approvals
        ):
            raise ContractError("missing user style-choice approval for one style PPTX")

    elif scenario == "template-fill":
        require_approval(approvals, "template-analysis", root, root / DOCS["template_analysis"])
        require_approval(approvals, "template-adaptation", root, root / DOCS["adaptation_report"])
        require_approval(approvals, "template-fill-plan", root, root / DOCS["fill_plan"])
        analysis = docs["template_analysis"]
        if analysis.get("ambiguous_texts"):
            require_approval(approvals, "template-ambiguities", root, root / DOCS["template_analysis"])
        if analysis.get("missing_fonts"):
            require_approval(approvals, "missing-fonts", root, root / DOCS["template_analysis"])
        if docs["fill_plan"].get("capacity_conflicts"):
            require_approval(approvals, "template-capacity-conflict", root, root / DOCS["fill_plan"])
        reps = artifact_by_purpose(artifacts, "template-representatives")
        if len(reps) != 1 or reps[0]["expected_pages"] < 2 or reps[0]["reusable"] is not True:
            raise ContractError("template-fill requires one reusable representative PPTX with at least 2 pages")
        require_approval(approvals, "template-representatives", root, artifact_path(root, reps[0]))

    elif scenario == "reconstruction":
        if docs["reconstruction_plan"].get("uncertain_text"):
            require_approval(approvals, "uncertain-text", root, root / DOCS["reconstruction_plan"])
        reps = artifact_by_purpose(artifacts, "reconstruction-prototypes")
        if len(reps) != 1 or reps[0]["expected_pages"] != 2 or reps[0]["reusable"] is not True:
            raise ContractError("reconstruction requires one reusable 2-page prototype PPTX")
        require_approval(approvals, "reconstruction-prototypes", root, artifact_path(root, reps[0]))
        qa = load_json(root / reps[0]["qa_path"])
        diagnostics = qa.get("diagnostics")
        if not isinstance(diagnostics, list) or len(diagnostics) < reps[0]["expected_pages"] * 3:
            raise ContractError("reconstruction QA requires side-by-side, blend and diff diagnostics per page")
        for item in diagnostics:
            if not resolve_inside(root, item, "reconstruction diagnostic").is_file():
                raise ContractError(f"reconstruction diagnostic missing: {item}")

    elif scenario == "reference-deck":
        profile = docs["reference_profile"]
        if profile.get("conflicts"):
            require_approval(approvals, "primary-reference", root, root / DOCS["reference_profile"])
        layouts = artifact_by_purpose(artifacts, "layout-preview")
        reps = artifact_by_purpose(artifacts, "reference-representatives")
        if len(layouts) != 1 or len(reps) != 1 or reps[0]["expected_pages"] != 3 or reps[0]["reusable"] is not True:
            raise ContractError("reference-deck requires one layout preview and one reusable 3-page representative PPTX")
        require_approval(approvals, "layout-preview", root, artifact_path(root, layouts[0]))
        require_approval(approvals, "reference-representatives", root, artifact_path(root, reps[0]))

    elif scenario == "existing-deck":
        require_approval(approvals, "change-scope", root, root / DOCS["change_plan"])
        if docs["change_plan"].get("keep_original_slides") is False:
            require_approval(approvals, "delete-original-slides", root, root / DOCS["change_plan"])
        if project["new_page_count"] > 0:
            layouts = artifact_by_purpose(artifacts, "layout-preview")
            if len(layouts) != 1 or layouts[0]["expected_pages"] != project["new_page_count"]:
                raise ContractError("existing-deck new pages require a complete layout-preview PPTX")
            require_approval(approvals, "layout-preview", root, artifact_path(root, layouts[0]))


def validate_parents(root: Path, build: dict[str, Any]) -> None:
    parents = build.get("parents")
    if not isinstance(parents, list) or not parents:
        raise ContractError("build_plan.parents must be a non-empty array")
    for index, parent in enumerate(parents):
        require(parent, ["path", "sha256"], f"build_plan.parents[{index}]")
        path = resolve_inside(root, parent["path"], "build parent")
        if not path.is_file() or parent["sha256"] != sha256(path):
            raise ContractError(f"build parent is missing or stale: {parent['path']}")


def require_build_parent(root: Path, build: dict[str, Any], required_path: Path) -> None:
    relative = required_path.resolve().relative_to(root).as_posix()
    current_hash = sha256(required_path)
    if not any(
        Path(parent.get("path", "")).as_posix() == relative
        and parent.get("sha256") == current_hash
        for parent in build["parents"]
    ):
        raise ContractError(f"build_plan.json does not bind required parent: {relative}")


def validate_final(
    root: Path,
    project: dict[str, Any],
    docs: dict[str, dict[str, Any]],
    artifacts: list[dict[str, Any]],
    approvals: list[dict[str, Any]],
) -> None:
    build = load_doc(root, "build_plan", project["run_id"])
    validate_parents(root, build)
    scenario = project["scenario"]
    required_parents = {
        "new-deck": [root / DOCS["slide_plan"], root / DOCS["asset_plan"]],
        "template-fill": [root / DOCS["fill_plan"]],
        "reconstruction": [root / DOCS["reconstruction_plan"], root / DOCS["asset_plan"]],
        "reference-deck": [root / DOCS["reference_profile"], root / DOCS["slide_plan"], root / DOCS["asset_plan"]],
        "existing-deck": [root / DOCS["change_plan"]],
    }[scenario]
    if scenario == "new-deck":
        required_parents.append(resolve_inside(root, require_approval(approvals, "style-choice", root)["subject_path"], "style choice"))
    elif scenario == "template-fill":
        required_parents.append(artifact_path(root, artifact_by_purpose(artifacts, "template-representatives")[0]))
    elif scenario == "reconstruction":
        required_parents.append(artifact_path(root, artifact_by_purpose(artifacts, "reconstruction-prototypes")[0]))
    elif scenario == "reference-deck":
        required_parents.append(artifact_path(root, artifact_by_purpose(artifacts, "reference-representatives")[0]))
    elif scenario == "existing-deck" and project["new_page_count"] > 0:
        required_parents.append(artifact_path(root, artifact_by_purpose(artifacts, "layout-preview")[0]))
    for required_parent in required_parents:
        require_build_parent(root, build, required_parent)
    if scenario == "reconstruction":
        for slide in build.get("slides", []):
            for item in slide.get("objects", []):
                if item.get("kind") not in {"native_text", "svg"}:
                    raise ContractError("reconstruction build may contain only native_text and svg objects")

    finals = artifact_by_purpose(artifacts, "final-output")
    if len(finals) != 1:
        raise ContractError("final phase requires exactly one final-output PPTX")
    final = finals[0]
    build_path = root / DOCS["build_plan"]
    if not any(
        Path(parent.get("path", "")).as_posix() == Path(DOCS["build_plan"]).as_posix()
        and parent.get("sha256") == sha256(build_path)
        for parent in final["parents"]
    ):
        raise ContractError("final-output artifact must bind the current build_plan.json")
    report = load_doc(root, "report", project["run_id"])
    if Path(report.get("output_pptx", "")).as_posix() != Path(final["path"]).as_posix():
        raise ContractError("editability report does not point to final-output PPTX")
    if report.get("output_sha256") != final["sha256"]:
        raise ContractError("editability report output hash mismatch")
    slides = report.get("slides")
    if not isinstance(slides, list) or len(slides) != final["expected_pages"]:
        raise ContractError("editability report must cover every final slide")
    if scenario == "reconstruction":
        if any(slide.get("raster_assets") for slide in slides):
            raise ContractError("reconstruction editability report may not contain raster assets")
        qa = load_json(root / final["qa_path"])
        diagnostics = qa.get("diagnostics")
        if not isinstance(diagnostics, list) or len(diagnostics) < final["expected_pages"] * 3:
            raise ContractError("final reconstruction QA requires three diagnostics per page")
    if scenario == "existing-deck":
        change_map = report.get("change_map")
        if not isinstance(change_map, list) or not change_map:
            raise ContractError("existing-deck report must include change_map")
        if docs["change_plan"].get("keep_original_slides") is True:
            for index, mapping in enumerate(change_map):
                require(
                    mapping,
                    ["source_slide", "output_original_slide", "modified_copy_slide"],
                    f"editability_report.change_map[{index}]",
                )
                if mapping["modified_copy_slide"] != mapping["output_original_slide"] + 1:
                    raise ContractError("modified copy must immediately follow its retained original slide")
            final_qa = load_json(root / final["qa_path"])
            if final_qa.get("checks", {}).get("source_page_unchanged") != "pass":
                raise ContractError("existing-deck QA must prove retained source pages are unchanged")


def validate_run(root: Path, phase: str) -> None:
    root = root.expanduser().resolve()
    if phase not in PHASES:
        raise ContractError(f"unsupported phase: {phase}")
    project = validate_project_file(root)
    docs = validate_plan_docs(root, project, phase)
    approvals = approval_records(root)
    _manifest, artifacts = validate_artifacts(root, project["run_id"])
    if phase in {"preview", "final"}:
        require_preview_contract(root, project, docs, artifacts, approvals)
    if phase == "final":
        validate_final(root, project, docs, artifacts, approvals)


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_dummy_pptx(path: Path, pages: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        for index in range(1, pages + 1):
            archive.writestr(f"ppt/slides/slide{index}.xml", "<p:sld xmlns:p='p'/>")


def base_doc(version: str, run_id: str, status: str = "confirmed") -> dict[str, Any]:
    return {"schema_version": version, "run_id": run_id, "status": status}


def add_artifact(
    root: Path,
    artifacts: list[dict[str, Any]],
    artifact_id: str,
    purpose: str,
    pages: int,
    reusable: bool,
    parent_paths: list[Path],
    reconstruction: bool = False,
) -> dict[str, Any]:
    pptx_rel = f"previews/{artifact_id}.pptx" if purpose != "final-output" else f"exports/{artifact_id}.pptx"
    pptx = root / pptx_rel
    write_dummy_pptx(pptx, pages)
    render_rel = f"qa/{artifact_id}/render"
    render_dir = root / render_rel
    render_dir.mkdir(parents=True, exist_ok=True)
    rendered: list[str] = []
    for index in range(1, pages + 1):
        image_rel = f"{render_rel}/slide-{index}.png"
        (root / image_rel).write_bytes(b"PNG")
        rendered.append(image_rel)
    diagnostics: list[str] = []
    if reconstruction:
        for index in range(1, pages + 1):
            for name in ("side-by-side", "blend", "diff-heatmap"):
                rel = f"qa/{artifact_id}/{name}-{index}.png"
                (root / rel).write_bytes(b"PNG")
                diagnostics.append(rel)
    qa_rel = f"qa/{artifact_id}/visual_qa.json"
    qa = {
        "schema_version": "craft-editable-pptx.visual-qa.v1",
        "artifact_id": artifact_id,
        "pptx_path": pptx_rel,
        "pptx_sha256": sha256(pptx),
        "render_dir": render_rel,
        "rendered_pages": rendered,
        "inspected_pages": list(range(1, pages + 1)),
        "inspected_by": "agent",
        "status": "pass",
        "checks": {"overflow": "pass", "wrapping": "pass", "layering": "pass"},
        "issues": [],
        "diagnostics": diagnostics,
    }
    write_json(root / qa_rel, qa)
    artifact = {
        "id": artifact_id,
        "purpose": purpose,
        "path": pptx_rel,
        "sha256": sha256(pptx),
        "qa_path": qa_rel,
        "expected_pages": pages,
        "reusable": reusable,
        "parents": [
            {"path": parent.relative_to(root).as_posix(), "sha256": sha256(parent)}
            for parent in parent_paths
        ],
    }
    artifacts.append(artifact)
    return artifact


def approve(root: Path, gate: str, subject: Path, decision: dict[str, Any] | None = None) -> None:
    rel = subject.resolve().relative_to(root.resolve()).as_posix()
    write_json(
        root / "approvals" / f"{gate}.json",
        {
            "schema_version": "craft-editable-pptx.approval.v1",
            "gate": gate,
            "status": "confirmed",
            "confirmed_by": "user",
            "subject_path": rel,
            "subject_sha256": sha256(subject),
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            "decision": decision or {},
        },
    )


def make_fixture(root: Path, scenario: str) -> None:
    run_id = f"test-{scenario}"
    source = root / "external-source.bin"
    source.write_bytes(b"source")
    new_pages = 1 if scenario == "existing-deck" else 0
    write_json(
        root / "project.json",
        {
            "schema_version": "craft-editable-pptx.project.v1",
            "run_id": run_id,
            "scenario": scenario,
            "phase": "final",
            "source_files": [{"path": str(source.resolve()), "sha256": sha256(source), "role": "primary"}],
            "new_page_count": new_pages,
        },
    )
    brief = base_doc(SCHEMA_VERSIONS["brief"], run_id)
    brief.update(
        {
            "scenario": scenario,
            "audience": "测试受众",
            "objective": "验证通路",
            "success_criteria": ["合同通过"],
            "source_policy": {},
            "constraints": {},
        }
    )
    write_json(root / DOCS["brief"], brief)

    outline = base_doc(SCHEMA_VERSIONS["outline"], run_id)
    outline["slides"] = [
        {"id": "P01", "title": "测试", "purpose": "验证", "key_message": "通过", "audience_move": "理解", "evidence_ids": []}
    ]
    slide_plan = base_doc(SCHEMA_VERSIONS["slide_plan"], run_id)
    slide_plan["slides"] = [
        {"id": "P01", "content_blocks": [{"type": "title", "text": "测试"}], "layout": {"pattern": "hero"}, "asset_ids": [], "native_objects": ["native_text"], "qa_assertions": ["文字可编辑"]}
    ]
    evidence = base_doc(SCHEMA_VERSIONS["evidence_plan"], run_id)
    evidence["items"] = []
    asset = base_doc(SCHEMA_VERSIONS["asset_plan"], run_id)
    asset["items"] = []

    if scenario in {"new-deck", "reference-deck"}:
        write_json(root / DOCS["outline"], outline)
        write_json(root / DOCS["slide_plan"], slide_plan)
        write_json(root / DOCS["evidence_plan"], evidence)
        write_json(root / DOCS["asset_plan"], asset)
    if scenario == "template-fill":
        analysis = base_doc(SCHEMA_VERSIONS["template_analysis"], run_id)
        analysis.update({"template_kind": "framework-only", "preserve": ["Theme", "Master", "Layout"], "slide_families": [{"id": "family-1"}], "ambiguous_texts": [], "missing_fonts": []})
        adaptation = base_doc(SCHEMA_VERSIONS["adaptation_report"], run_id)
        adaptation.update({"content_regions": [{}], "capacity_risks": [], "unsupported_objects": []})
        fill = base_doc(SCHEMA_VERSIONS["fill_plan"], run_id)
        fill.update({"slides": [{"id": "P01", "source_slide": 1, "layout_rationale": "容量匹配", "edits": []}], "capacity_conflicts": []})
        write_json(root / DOCS["template_analysis"], analysis)
        write_json(root / DOCS["adaptation_report"], adaptation)
        write_json(root / DOCS["fill_plan"], fill)
    if scenario == "reconstruction":
        reconstruction = base_doc(SCHEMA_VERSIONS["reconstruction_plan"], run_id)
        reconstruction.update({"source_locked": True, "slides": [{"id": "P01", "source_page": 1, "ref_width": 1920, "ref_height": 1080, "objects": [{"id": "t1", "semantic_role": "text", "target_kind": "native_text"}]}], "uncertain_text": []})
        write_json(root / DOCS["reconstruction_plan"], reconstruction)
        write_json(root / DOCS["asset_plan"], asset)
    if scenario == "reference-deck":
        profile = base_doc(SCHEMA_VERSIONS["reference_profile"], run_id)
        profile.update({"primary_reference": "primary", "references": [{"id": "primary"}], "design_rules": {}, "conflicts": []})
        write_json(root / DOCS["reference_profile"], profile)
    if scenario == "existing-deck":
        write_json(root / DOCS["outline"], outline)
        write_json(root / DOCS["slide_plan"], slide_plan)
        change = base_doc(SCHEMA_VERSIONS["change_plan"], run_id)
        change.update({"source_pptx": str(source.resolve()), "changes": [{"source_slide": 1, "selector": "title", "before": "旧", "after": "新", "preserve": ["font", "font_size", "color", "position", "size", "paragraph", "fill", "border"]}], "new_pages": [{"id": "P01"}], "keep_original_slides": True})
        write_json(root / DOCS["change_plan"], change)

    artifacts: list[dict[str, Any]] = []
    if scenario == "new-deck":
        layout = add_artifact(root, artifacts, "layout", "layout-preview", 1, False, [root / DOCS["slide_plan"]])
        styles = [add_artifact(root, artifacts, f"style-{letter}", f"style-option-{letter}", 3, True, [root / layout["path"]]) for letter in ("a", "b", "c")]
        approve(root, "layout-preview", root / layout["path"])
        approve(root, "style-choice", root / styles[0]["path"], {"selected": "style-a"})
        approve(root, "asset-plan", root / DOCS["asset_plan"])
    elif scenario == "template-fill":
        reps = add_artifact(root, artifacts, "template-reps", "template-representatives", 2, True, [root / DOCS["fill_plan"]])
        approve(root, "template-analysis", root / DOCS["template_analysis"])
        approve(root, "template-adaptation", root / DOCS["adaptation_report"])
        approve(root, "template-fill-plan", root / DOCS["fill_plan"])
        approve(root, "template-representatives", root / reps["path"])
    elif scenario == "reconstruction":
        reps = add_artifact(root, artifacts, "rebuild-reps", "reconstruction-prototypes", 2, True, [root / DOCS["reconstruction_plan"]], True)
        approve(root, "asset-plan", root / DOCS["asset_plan"])
        approve(root, "reconstruction-prototypes", root / reps["path"])
    elif scenario == "reference-deck":
        layout = add_artifact(root, artifacts, "layout", "layout-preview", 1, False, [root / DOCS["slide_plan"]])
        reps = add_artifact(root, artifacts, "reference-reps", "reference-representatives", 3, True, [root / DOCS["reference_profile"], root / layout["path"]])
        approve(root, "layout-preview", root / layout["path"])
        approve(root, "reference-representatives", root / reps["path"])
        approve(root, "asset-plan", root / DOCS["asset_plan"])
    else:
        layout = add_artifact(root, artifacts, "layout", "layout-preview", 1, False, [root / DOCS["slide_plan"]])
        approve(root, "change-scope", root / DOCS["change_plan"])
        approve(root, "layout-preview", root / layout["path"])
    parent_key = {
        "new-deck": "slide_plan",
        "template-fill": "fill_plan",
        "reconstruction": "reconstruction_plan",
        "reference-deck": "slide_plan",
        "existing-deck": "change_plan",
    }[scenario]
    parent_path = root / DOCS[parent_key]
    build_parent_paths = [parent_path]
    if scenario in {"new-deck", "reconstruction", "reference-deck"}:
        build_parent_paths.append(root / DOCS["asset_plan"])
    if scenario == "new-deck":
        build_parent_paths.append(root / styles[0]["path"])
    elif scenario == "template-fill":
        build_parent_paths.append(root / reps["path"])
    elif scenario == "reconstruction":
        build_parent_paths.append(root / reps["path"])
    elif scenario == "reference-deck":
        build_parent_paths.extend([root / DOCS["reference_profile"], root / reps["path"]])
    elif scenario == "existing-deck" and new_pages > 0:
        build_parent_paths.append(root / layout["path"])
    kinds = ["native_text"] if scenario == "reconstruction" else ["native_text", "native_shape"]
    build_slides = [
        {"id": "P01", "objects": [{"id": f"o{i}", "kind": kind, "bbox": [0.1, 0.1, 0.3, 0.1], "build_method": kind, "editable": kind != "svg"} for i, kind in enumerate(kinds, 1)]}
    ]
    if scenario == "existing-deck":
        build_slides.append({"id": "P02", "objects": build_slides[0]["objects"]})
    build = {
        "schema_version": SCHEMA_VERSIONS["build_plan"],
        "run_id": run_id,
        "parents": [
            {"path": item.relative_to(root).as_posix(), "sha256": sha256(item)}
            for item in build_parent_paths
        ],
        "slides": build_slides,
    }
    write_json(root / DOCS["build_plan"], build)
    final_pages = 2 if scenario == "existing-deck" else 1
    final = add_artifact(
        root,
        artifacts,
        "final",
        "final-output",
        final_pages,
        True,
        [root / DOCS["build_plan"]],
        scenario == "reconstruction",
    )
    if scenario == "existing-deck":
        final_qa = load_json(root / final["qa_path"])
        final_qa["checks"]["source_page_unchanged"] = "pass"
        write_json(root / final["qa_path"], final_qa)
    write_json(
        root / DOCS["artifacts"],
        {"schema_version": SCHEMA_VERSIONS["artifacts"], "run_id": run_id, "artifacts": artifacts},
    )
    report_slides = [
        {"id": f"P{index:02d}", "native_text": 1, "native_objects": 0, "svg_assets": 0, "raster_assets": [], "warnings": []}
        for index in range(1, final_pages + 1)
    ]
    report = {
        "schema_version": SCHEMA_VERSIONS["report"],
        "run_id": run_id,
        "output_pptx": final["path"],
        "output_sha256": final["sha256"],
        "slides": report_slides,
        "limitations": [],
    }
    if scenario == "existing-deck":
        report["change_map"] = [{"source_slide": 1, "output_original_slide": 1, "modified_copy_slide": 2}]
    write_json(root / DOCS["report"], report)


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="craft-editable-pptx-tests-") as temp:
        base = Path(temp)
        for scenario in sorted(SCENARIOS):
            root = base / scenario
            root.mkdir()
            make_fixture(root, scenario)
            validate_run(root, "plan")
            validate_run(root, "preview")
            validate_run(root, "final")

        delegated = base / "new-deck" / DOCS["slide_plan"]
        value = load_json(delegated)
        value["status"] = "confirmed_by_delegation"
        write_json(delegated, value)
        try:
            validate_run(base / "new-deck", "preview")
        except ContractError:
            pass
        else:
            raise AssertionError("delegated confirmation must fail")

        asset_path = base / "reconstruction" / DOCS["asset_plan"]
        value = load_json(asset_path)
        value["items"] = [{"id": "bad", "pages": ["P01"], "purpose": "bad", "asset_type": "raster", "source": "bad.png", "contains_semantic_text": False}]
        write_json(asset_path, value)
        try:
            validate_run(base / "reconstruction", "plan")
        except ContractError:
            pass
        else:
            raise AssertionError("reconstruction raster asset must fail")

        extra = base / "template-fill" / "exports" / "unregistered.pptx"
        write_dummy_pptx(extra, 1)
        try:
            validate_run(base / "template-fill", "preview")
        except ContractError:
            pass
        else:
            raise AssertionError("unregistered PPTX must fail")

        stale_root = base / "stale-parent"
        stale_root.mkdir()
        make_fixture(stale_root, "existing-deck")
        stale_change_plan = stale_root / DOCS["change_plan"]
        value = load_json(stale_change_plan)
        value["changes"][0]["after"] = "确认后被篡改"
        write_json(stale_change_plan, value)
        try:
            validate_run(stale_root, "final")
        except ContractError:
            pass
        else:
            raise AssertionError("stale approval or parent hash must fail")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", nargs="?", help="Run directory")
    parser.add_argument("--phase", choices=sorted(PHASES), default="plan")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            self_test()
            print("Self-test passed: five scenarios and negative hard gates")
            return 0
        if not args.run_dir:
            parser.error("run_dir is required unless --self-test is used")
        validate_run(Path(args.run_dir), args.phase)
    except ContractError as exc:
        print(f"Validation failed: {exc}")
        return 1
    print(f"Validation passed: {args.phase}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
