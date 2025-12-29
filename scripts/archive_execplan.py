#!/usr/bin/env python3
"""
Archive an ExecPlan and its artifacts folder.

Usage:
  python scripts/archive_execplan.py .agent/execplans/YYYY-MM-DD_slug.md
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("execplan_path", help="Path to the ExecPlan .md file")
    args = ap.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    plan_path = (repo_root / args.execplan_path).resolve()

    # Safety: ensure we're operating within this repo.
    try:
        plan_path.relative_to(repo_root)
    except ValueError:
        raise SystemExit(f"Refusing to move a file outside repo root: {plan_path}")

    if not plan_path.exists() or plan_path.suffix.lower() != ".md":
        raise SystemExit(f"ExecPlan not found (or not a .md file): {plan_path}")

    execplans_dir = repo_root / ".agent" / "execplans"
    archive_dir = execplans_dir / "archive"
    artifacts_dir = execplans_dir / "artifacts"
    archive_artifacts_dir = archive_dir / "artifacts"

    archive_dir.mkdir(parents=True, exist_ok=True)
    archive_artifacts_dir.mkdir(parents=True, exist_ok=True)

    stem = plan_path.stem
    dst_plan = archive_dir / plan_path.name

    if dst_plan.exists():
        raise SystemExit(f"Destination already exists: {dst_plan}")

    shutil.move(str(plan_path), str(dst_plan))

    src_artifacts = artifacts_dir / stem
    if src_artifacts.exists() and src_artifacts.is_dir():
        dst_artifacts = archive_artifacts_dir / stem
        if dst_artifacts.exists():
            raise SystemExit(f"Archive artifacts destination exists: {dst_artifacts}")
        shutil.move(str(src_artifacts), str(dst_artifacts))
        print(f"Moved artifacts: {src_artifacts} -> {dst_artifacts}")
    else:
        print(f"No artifacts folder found for: {stem}")

    print(f"Archived ExecPlan: {dst_plan}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
