# codex-specialized-subagents

MCP server that lets Codex delegate to isolated codex exec sub-agents, selecting repo+global skills automatically.

Status: MCP server + `delegate.*` tool stubs implemented; Codex `codex exec` integration is next. See `.agent/execplans/2025-12-29_codex-specialized-subagents-mcp-server.md`.

## Quickstart

1) Install dependencies:

```bash
npm install
```

2) Build:

```bash
npm run build
```

3) Run tests:

```bash
npm test
```

4) (Optional) Run the MCP server locally (stdio):

```bash
npm run dev
```

5) Register with Codex (global):

```bash
codex mcp add codex-specialized-subagents -- node "$(pwd)/dist/cli.js"
```

Verify:

```bash
codex mcp list
```

## Workflow

- **Agent instructions:** see `AGENTS.md`
- **Planning for big work:** see `.agent/PLANS.md` and store ExecPlans in `.agent/execplans/`
- **Debug journal:** `.agent/DEBUG.md` (local-only by default)
- **Repo skills:** `.codex/skills/`

## What this will provide (v1)

- MCP tools:
  - `delegate.run` — run a specialist sub-agent via `codex exec`
  - `delegate.resume` — resume a prior sub-agent thread via `codex exec resume`
- Skill selection:
  - repo-local `.codex/skills` (nearest ancestor of the delegated `cwd`)
  - global `${CODEX_HOME:-~/.codex}/skills`
- Artifact-first:
  - full sub-agent event stream + outputs saved to a run directory
  - MCP tool returns only a small structured summary + artifact paths

## What works today (stubbed)

- Tools are registered and callable:
  - `delegate.run` creates a run directory and writes `request.json`
  - `delegate.resume` creates a run directory and writes `request.json`
- Run directories are created under `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/`.

## Project structure

- `.agent/` — planning + debugging scaffolding
- `.codex/skills/` — repo-scoped Codex skills
- `.githooks/` — versioned git hooks (optional)
- `scripts/` — helper scripts (ExecPlans + git hooks)
- As the repo grows, add `README.md` files at major directory boundaries (more comprehensive than `AGENTS.md`).

## Notes

- `.env` is gitignored. Put secrets there, not in code.
- The optional AI commit-message hook is **opt-in** (see `scripts/install-git-hooks.sh`).

## License

TBD (choose one and update this section).
