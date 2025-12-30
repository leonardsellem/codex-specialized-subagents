# Usage

This MCP server is meant to be registered with the Codex CLI and then invoked from Codex (interactive or non-interactive) via MCP tool calls.

## Register with Codex

From the repo root:

```bash
npm install
npm run build
```

Register the stdio MCP server:

```bash
codex mcp add codex-specialized-subagents -- node "$(pwd)/dist/cli.js"
```

Verify the registration:

```bash
codex mcp get codex-specialized-subagents
```

## Which tool to use

- `delegate_autopilot`: best default for multi-step work (it can route into scan/implement/verify jobs).
- `delegate_run`: run a single specialist sub-agent (one prompt → one result).
- `delegate_resume`: resume a previous sub-agent thread (follow-up on a `thread_id`).

## Example inputs

Note: `cwd` should typically be an absolute path. `delegate_autopilot` defaults `cwd` to the server process working directory if omitted.

### `delegate_autopilot`

```json
{
  "task": "Audit the repo docs and propose improvements.",
  "cwd": "/absolute/path/to/your/repo",
  "sandbox": "read-only",
  "max_agents": 3,
  "max_parallel": 2
}
```

### `delegate_run`

```json
{
  "task": "Find the most likely root cause of the failing tests and propose a minimal fix.",
  "cwd": "/absolute/path/to/your/repo",
  "sandbox": "read-only",
  "skills_mode": "auto",
  "max_skills": 6
}
```

### `delegate_resume`

```json
{
  "thread_id": "019b6c00-7270-75a0-b8b3-ad68febc8406",
  "task": "Continue by implementing the fix and updating docs.",
  "cwd": "/absolute/path/to/your/repo",
  "sandbox": "workspace-write"
}
```

## Sandbox guidance

- `read-only`: audits, investigations, planning, code review.
- `workspace-write`: most coding tasks (safe default for typical repo work).
- `danger-full-access`: only when the task truly needs it.

## Skills (repo + global)

Delegated sub-agents can load skills from:
- the nearest ancestor `.codex/skills` directory relative to the delegated `cwd`
- `${CODEX_HOME:-$HOME/.codex}/skills`

In `skills_mode=auto`, the server selects up to `max_skills` skills based on the task text. Use `skills_mode=explicit` to request specific skills by name, or `skills_mode=none` to disable skills entirely.

## Per-job thinking level (reasoning effort) overrides (autopilot)

`delegate_autopilot` assigns each planned job a `thinking_level` (`low | medium | high`). This is an internal label produced by this server’s routing logic.

In Codex, the knob that controls “thinking level” is the `model_reasoning_effort` config key (documented values: `minimal | low | medium | high | xhigh`).

If you set any of the env vars below on the MCP server process, this server maps each job’s `thinking_level` into a per-job `codex exec -c model_reasoning_effort="..."` override.

Environment variables (server process):
- `CODEX_AUTOPILOT_REASONING_EFFORT_LOW`
- `CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM`
- `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH`

If an env var is unset/empty/whitespace, the server does not override `model_reasoning_effort` for that thinking level.

### Example: set env vars when registering the MCP server

```bash
codex mcp add codex-specialized-subagents \
  --env CODEX_AUTOPILOT_REASONING_EFFORT_LOW=low \
  --env CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM=medium \
  --env CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=xhigh \
  -- node "$(pwd)/dist/cli.js"
```

### Example: set env vars for local dev

```bash
export CODEX_AUTOPILOT_REASONING_EFFORT_LOW=low
export CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM=medium
export CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=xhigh
npm run dev
```

### Optional/advanced: per-job model-name overrides (compat)

If you want to override the Codex model *name* per job (separate from reasoning effort), set:
- `CODEX_AUTOPILOT_MODEL_LOW`
- `CODEX_AUTOPILOT_MODEL_MEDIUM`
- `CODEX_AUTOPILOT_MODEL_HIGH`

When set, this server passes `codex exec -c model="..."` for the matching jobs.

### Caveat: managed Codex config may supersede CLI overrides

Some environments may apply managed configuration that can override CLI `-c` settings, so per-job overrides may not take effect everywhere.

## Where results and logs go

Every tool call returns a `run_dir` and writes artifacts under:

```bash
${CODEX_HOME:-$HOME/.codex}/delegator/runs/<run_id>/
```

See `reference/run-directories.md` for the full layout and debugging tips.
