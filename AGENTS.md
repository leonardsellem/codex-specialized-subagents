# AGENTS.md

This file is for **AI coding agents**.

Keep it short. Use **hierarchical, nearest-wins** `AGENTS.md` files:
- Root = global defaults + JIT map
- Subfolders = concrete commands + patterns for that scope

## Project snapshot
- **Name:** codex-specialized-subagents
- **What is this?** MCP server that lets Codex delegate to isolated codex exec sub-agents, selecting repo+global skills automatically.
- Repo type: single project
- Primary stack: Node.js + TypeScript + `@modelcontextprotocol/sdk` + `zod`

## Root commands (verify these are real)
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Integration test (requires `codex` CLI + auth): `RUN_CODEX_INTEGRATION_TESTS=1 npm test`
- Lint/typecheck: `npm run lint`

## Universal conventions
- Default to small, finishable steps.
- State assumptions + open questions explicitly.
- Prefer pointers (paths + search commands) over long prose in AGENTS.
- Verify before claiming “done”.

## Security & secrets
- Never commit secrets/tokens/keys.
- Put secrets in `.env`/secret manager; `.env` is gitignored.
- Avoid pasting secrets from `${CODEX_HOME:-~/.codex}` (it may contain auth/config).

## JIT directory map (nearest-wins)
- `.agent/` → `.agent/AGENTS.md` (ExecPlans + artifacts workflow)
- `.codex/skills/` → `.codex/skills/AGENTS.md` (repo-local skill authoring)
- `docs/` → (human-facing docs; user + contributor guides)
- `src/` → `src/AGENTS.md` (MCP server + tool implementations)
- `scripts/` → `scripts/AGENTS.md` (helper scripts)
- `.githooks/` → `.githooks/AGENTS.md` (optional git hooks)

As the repo grows:
- `apps/<name>/` → `apps/<name>/AGENTS.md`
- `packages/<name>/` → `packages/<name>/AGENTS.md`
- `services/<name>/` → `services/<name>/AGENTS.md`
- Add `docs/AGENTS.md` only if docs need scope-specific agent rules.

## Planning (ExecPlans)
- Rules live in: `.agent/PLANS.md`
- Create plans in: `.agent/execplans/`
- Archive completed plans in: `.agent/execplans/archive/`
- Debug journal: `.agent/DEBUG.md` (local-only by default)

## Preferred Codex skills (keep this list small)
- `agents-md` (keep hierarchical `AGENTS.md` repo-true)
- `lp-repo-docs-update` (docs sync grounded in git diffs)
- `executing-plans` (implement ExecPlans in batches)
- `verification-before-completion` (run checks before claiming done)
- `bug-triage` (fast repro → fix → report)
- `coding-guidelines-verify` (enforce local conventions + checks)
- `mcp-builder` (MCP tool design/interop best practices)
- `commit-work` (clean, reviewable commits)

Default: list only the 4–10 skills you expect to use on this repo (don’t dump the entire global catalog).

## Definition of done
- tests/checks pass (or you state what ran + why not)
- behavior verified with evidence (example/screenshot/log)
- docs sync gate: if the change is significant (commands/entry points/structure/constraints), update `README.md` + relevant `AGENTS.md` (and any module docs/runbooks)
- if unsure: run `lp-repo-docs-update` for a docs-only pass grounded in the diff
- no secrets in diff
