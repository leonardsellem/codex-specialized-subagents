# codex-specialized-subagents

MCP server that lets Codex delegate to isolated codex exec sub-agents, selecting repo+global skills automatically.

Status: `delegate.run` + `delegate.resume` are wired to `codex exec` / `codex exec resume` (artifact-first). See `.agent/execplans/2025-12-29_codex-specialized-subagents-mcp-server.md`.

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

## What works today

- `delegate.run` runs a Codex sub-agent via `codex exec` and writes artifacts including `request.json`, `skills_index.json`, `selected_skills.json`, `subagent_prompt.txt`, `events.jsonl`, `stderr.log`, `last_message.json`, `result.json`.
- `delegate.resume` resumes an existing `thread_id` via `codex exec resume` and writes a new run directory with similar artifacts.
- Run directories are created under `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/`.

## MCP tools (v1)

### `delegate.run`

Input:
- `task`: string (required)
- `cwd`: string (required; absolute path recommended)
- `role`: string (optional; default `"specialist"`)
- `skills_mode`: `"auto" | "explicit" | "none"` (default `"auto"`)
- `skills`: string[] (explicit mode only)
- `max_skills`: number (auto mode; default `6`)
- `include_repo_skills`: boolean (default `true`)
- `include_global_skills`: boolean (default `true`)
- `sandbox`: `"read-only" | "workspace-write" | "danger-full-access"` (default `"read-only"`)
- `skip_git_repo_check`: boolean (default `false`)

Output (structured):
- `run_id`, `run_dir`, `subagent_thread_id`
- `selected_skills`: `{ name, description?, origin, path }[]`
- `summary`, `deliverables`, `open_questions`, `next_actions`
- `artifacts`: `{ name, path }[]`
- `timing`: `{ started_at, finished_at, duration_ms }`
- `status`: `"completed" | "failed" | "cancelled"`, `error`

### `delegate.resume`

Input: same as `delegate.run`, plus:
- `thread_id`: string (required)
- `task`: string (optional follow-up prompt)

Output: same shape as `delegate.run`.

## Run directory layout

Each tool call creates a new directory under `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/` containing:
- `request.json`
- `skills_index.json`
- `selected_skills.json`
- `subagent_prompt.txt`
- `subagent_output.schema.json`
- `events.jsonl`
- `stderr.log`
- `last_message.json`
- `result.json`
- `thread.json` (best-effort; present when the session/thread id is detected)

## Codex MCP config (timeouts)

Delegated runs can take minutes; increase the MCP client tool timeout for this server in `${CODEX_HOME:-~/.codex}/config.toml`:

```toml
[mcp_servers.codex-specialized-subagents]
tool_timeout_sec = 600
```

## Tests

- Default: `npm test` (skips real Codex integration).
- Integration (requires `codex` CLI + auth): `RUN_CODEX_INTEGRATION_TESTS=1 npm test`.

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
