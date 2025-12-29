# ExecPlans folder

Put active ExecPlans (living plan documents) in this folder.

Naming convention:
- `YYYY-MM-DD_short-description.md`

Artifacts convention:
- Put supporting outputs under `.agent/execplans/artifacts/<same-stem>/`
  Example:
  - ExecPlan: `.agent/execplans/2025-12-24_auth-refactor.md`
  - Artifacts: `.agent/execplans/artifacts/2025-12-24_auth-refactor/`

When a plan is complete:
- Move the ExecPlan to `.agent/execplans/archive/`
- Move its artifacts folder to `.agent/execplans/archive/artifacts/`

Helpers:
- `python3 scripts/new_execplan.py "short description"`
- `python3 scripts/archive_execplan.py .agent/execplans/YYYY-MM-DD_slug.md`
