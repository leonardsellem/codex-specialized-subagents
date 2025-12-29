# scripts/AGENTS.md

Scope: helper scripts under `scripts/` (Python + shell).

## What lives here
- ExecPlan helpers:
  - `scripts/new_execplan.py`
  - `scripts/archive_execplan.py`
- Optional git hook tooling:
  - `scripts/install-git-hooks.sh`
  - `scripts/ai_commit_message.py` (used by `.githooks/prepare-commit-msg`)

## Conventions
- Prefer scripts to be safe + non-destructive by default.
- Keep usage documented in the script docstring/header.
- Avoid adding third-party Python deps unless absolutely necessary.
- Do not print or write secrets; `.env` is gitignored.

## JIT search
- Find script entrypoints: `ls -la scripts`
- Find ExecPlan tooling usage: `rg -n \"new_execplan|archive_execplan\" -S .agent scripts README.md`

