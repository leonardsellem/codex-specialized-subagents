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
- `${CODEX_HOME:-~/.codex}/skills`

In `skills_mode=auto`, the server selects up to `max_skills` skills based on the task text. Use `skills_mode=explicit` to request specific skills by name, or `skills_mode=none` to disable skills entirely.

## Where results and logs go

Every tool call returns a `run_dir` and writes artifacts under:

```bash
${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/
```

See `reference/run-directories.md` for the full layout and debugging tips.

