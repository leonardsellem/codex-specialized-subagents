# codex-specialized-subagents

Artifact-first sub-agent delegation for Codex CLI (MCP server).

This repo provides a local (stdio) MCP server that exposes:
- `delegate_autopilot` — decide whether to delegate and, if yes, orchestrate one or more `codex exec` sub-agent runs
- `delegate_run` — run a single specialist sub-agent via `codex exec`
- `delegate_resume` — resume a prior sub-agent thread via `codex exec resume`

Each tool call writes a run directory under `${CODEX_HOME:-$HOME/.codex}/delegator/runs/<run_id>/` containing the prompt, selected skills, event stream, and structured results (artifact-first debugging).

## When to use

- You want parallelism and specialization for multi-step / cross-cutting work.
- You want durable artifacts (logs + outputs) to debug and review what happened.

## Requirements

- Node.js `>=20` (see `package.json#engines`)
- `npm`
- `codex` CLI on your PATH and authenticated (required for real delegation runs)

Optional:
- Python 3 (only for helper scripts under `.agent/`)

## Install & quickstart (from source)

From the repo root (installs deps + builds `dist/`):

```bash
npm install
npm run build
```

### Configure Codex (recommended, prevents timeouts)

Delegated runs can take minutes. Set this server’s MCP tool timeout to 1200 seconds (20 minutes) in your Codex config (`$HOME/.codex/config.toml`):

```bash
mkdir -p "$HOME/.codex"
cat >> "$HOME/.codex/config.toml" <<'EOF'

[mcp_servers.codex-specialized-subagents]
tool_timeout_sec = 1200
EOF
```

If you already have a `[mcp_servers.codex-specialized-subagents]` section, edit the existing `tool_timeout_sec` instead of appending a duplicate.

### Register with Codex (recommended defaults)

From the repo root (includes per-job reasoning-effort overrides for `delegate_autopilot`):

```bash
codex mcp add codex-specialized-subagents \
  --env CODEX_AUTOPILOT_REASONING_EFFORT_LOW=low \
  --env CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM=medium \
  --env CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=high \
  -- node "$(pwd)/dist/cli.js"
```

Verify:

```bash
codex mcp get codex-specialized-subagents
```

Remove:

```bash
codex mcp remove codex-specialized-subagents
```

## Usage

### Interactive autopilot (recommended)

In Codex interactive mode, `delegate_autopilot` can split a request into jobs (scan / implement / verify) and run specialist sub-agents.

To make delegation feel automatic in interactive mode, install the included `delegation-autopilot` skill globally:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills/delegation-autopilot"
cp .codex/skills/delegation-autopilot/SKILL.md \
  "${CODEX_HOME:-$HOME/.codex}/skills/delegation-autopilot/SKILL.md"
```

Then try prompts like:
- “Refactor the MCP server and update tests + README.”
- “Audit the repo docs and propose improvements.”

Optional: `delegate_autopilot` assigns each job a `thinking_level` (`low | medium | high`). You can set `CODEX_AUTOPILOT_REASONING_EFFORT_LOW|MEDIUM|HIGH` on the MCP server process to override Codex `model_reasoning_effort` per job (see `docs/usage.md`). (Legacy/advanced: `CODEX_AUTOPILOT_MODEL_LOW|MEDIUM|HIGH` overrides model name.)

### Manual tool calls

If you prefer explicit tool usage, tell Codex to call one of:
- `delegate_autopilot` (multi-agent orchestration)
- `delegate_run` (single sub-agent run)
- `delegate_resume` (resume a prior sub-agent thread)

## Skills

Sub-agent runs can load Codex skills from:
- repo-local `.codex/skills` (nearest ancestor of the delegated `cwd`)
- global `${CODEX_HOME:-$HOME/.codex}/skills`

Note: this repo’s `delegation-autopilot` skill is marked `delegator_exclude: true` (parent-only) to prevent delegation recursion.

## Artifacts (run directories)

Each tool call writes a run directory under `${CODEX_HOME:-$HOME/.codex}/delegator/runs/<run_id>/`.

## Documentation

Start with `docs/README.md` (index), then:
- `docs/usage.md` — how to use the tools effectively
- `docs/troubleshooting.md` — common failure modes (timeouts, missing `codex`, etc.)
- `docs/development.md` — local development and test matrix
- `docs/reference/tools.md` — full tool schemas (inputs/outputs)
- `docs/reference/run-directories.md` — run directory layout and artifact meaning

## Development

```bash
npm test
npm run lint
npm run dev
```

Integration tests (requires Codex CLI + auth):

```bash
RUN_CODEX_INTEGRATION_TESTS=1 npm test
```

Contributing: `CONTRIBUTING.md`.

## Security

- Don’t commit secrets (`.env` is gitignored; use `.env.example` as a template).
- Run directories can contain sensitive prompts/output; treat `${CODEX_HOME:-$HOME/.codex}/delegator/runs` as sensitive.

Reporting: `SECURITY.md`.

## License

MIT
