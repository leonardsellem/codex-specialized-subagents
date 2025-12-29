# .agent/AGENTS.md

Scope: planning + debugging workflow under `.agent/`.

## ExecPlans (source of truth)
- Rules: `.agent/PLANS.md`
- Active plans: `.agent/execplans/`
- Archive plans: `.agent/execplans/archive/`
- Artifacts (gitignored by default):
  - `.agent/execplans/artifacts/<plan-id>/`
  - `.agent/execplans/archive/artifacts/<plan-id>/`

## Commands
- Create a new ExecPlan: `python3 scripts/new_execplan.py "short description"`
- Archive an ExecPlan: `python3 scripts/archive_execplan.py .agent/execplans/YYYY-MM-DD_slug.md`

## Conventions
- Keep ExecPlans self-contained and append-only: never delete prior logs; append new entries.
- Keep smoke-test transcripts in artifacts folders (but remember artifacts are ignored by default).
- Keep `.agent/DEBUG.md` for local debugging notes; avoid pasting secrets.

## JIT search
- Find the latest active plan: `ls -1 .agent/execplans | sort`
- Find milestone status: `rg -n \"^\\- \\[[ x]\\]\" .agent/execplans .agent/execplans/archive -S`

