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
- Test: `npm test`
- Lint/typecheck: `npm run lint`

## Universal conventions
- Default to small, finishable steps.
- State assumptions + open questions explicitly.
- Prefer pointers (paths + search commands) over long prose in AGENTS.
- Verify before claiming “done”.

## Security & secrets
- Never commit secrets/tokens/keys.
- Put secrets in `.env`/secret manager; `.env` is gitignored.

## JIT directory map (add as the repo grows)
- `apps/<name>/` → `apps/<name>/AGENTS.md`
- `packages/<name>/` → `packages/<name>/AGENTS.md`
- `services/<name>/` → `services/<name>/AGENTS.md`
- `docs/` → `docs/AGENTS.md` (only if needed)

## Planning (ExecPlans)
- Rules live in: `.agent/PLANS.md`
- Create plans in: `.agent/execplans/`
- Archive completed plans in: `.agent/execplans/archive/`
- Debug journal: `.agent/DEBUG.md` (local-only by default)

## Global Codex skills (available in `~/.codex/skills`)
- Planning: `brainstorming`, `writing-plans`, `ground-execplan`, `executing-plans`
- Shipping: `commit-work`, `create-pr`, `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`
- Debugging: `systematic-debugging`, `bug-triage`, `root-cause-tracing`, `test-driven-development`
- MCP: `mcp-builder`
- Docs/hygiene: `lp-repo-docs-update`, `coding-guidelines-verify`
- Docs/files: `docx`, `pptx`, `xlsx`, `pdf`

Default: list only the 4–10 skills you expect to use on this repo (don’t dump the entire global catalog).

## Definition of done
- tests/checks pass (or you state what ran + why not)
- behavior verified with evidence (example/screenshot/log)
- docs sync gate: if the change is significant (commands/entry points/structure/constraints), update `README.md` + relevant `AGENTS.md` (and any module docs/runbooks)
- if unsure: run `lp-repo-docs-update` for a docs-only pass grounded in the diff
- no secrets in diff
