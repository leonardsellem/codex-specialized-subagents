#!/usr/bin/env python3
"""
Create a new ExecPlan file + artifacts folder.

Usage:
  python3 scripts/new_execplan.py "short description"
"""

from __future__ import annotations

import argparse
import re
from datetime import date
from pathlib import Path


SKELETON = """# {title}

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Explain (briefly) what someone gains after this change and how they can see it working.

## Progress

- [ ] ({today} 00:00) First concrete step.

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Decision Log

- Decision: …
  Rationale: …
  Date/Author: …

## Outcomes & Retrospective

## Context and Orientation

## Plan of Work

## Concrete Steps

## Validation and Acceptance

## Idempotence and Recovery

## Artifacts and Notes

## Interfaces and Dependencies
"""


def slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "plan"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("title", help="Short, action-oriented description")
    args = ap.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    execplans_dir = repo_root / ".agent" / "execplans"
    artifacts_dir = execplans_dir / "artifacts"

    execplans_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    today = date.today().isoformat()
    stem = f"{today}_{slugify(args.title)[:60]}"
    plan_path = execplans_dir / f"{stem}.md"

    if plan_path.exists():
        print(f"ExecPlan already exists: {plan_path}")
        return 0

    plan_path.write_text(
        SKELETON.format(title=args.title.strip(), today=today),
        encoding="utf-8",
    )

    (artifacts_dir / stem).mkdir(parents=True, exist_ok=True)

    print(f"Created ExecPlan: {plan_path}")
    print(f"Artifacts folder: {artifacts_dir / stem}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
