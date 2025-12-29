# Tool reference

This file documents the MCP tools exposed by this server and their input/output shapes.

All tools return a human-readable `content` message plus a machine-validated `structuredContent` payload.

## `delegate_run`

Spawn a new specialist Codex sub-agent run via `codex exec`, writing a run directory with artifacts.

### Input

- `task`: string (required)
- `cwd`: string (required)
- `role`: string (default `"specialist"`)
- `skills_mode`: `"auto" | "explicit" | "none"` (default `"auto"`)
- `skills`: string[] (only used when `skills_mode="explicit"`)
- `max_skills`: number (default `6`)
- `include_repo_skills`: boolean (default `true`)
- `include_global_skills`: boolean (default `true`)
- `sandbox`: `"read-only" | "workspace-write" | "danger-full-access"` (default `"read-only"`)
- `skip_git_repo_check`: boolean (default `false`)

### Output (`structuredContent`)

- `run_id`: string
- `run_dir`: string
- `subagent_thread_id`: string | null
- `selected_skills`: `{ name, description?, origin: "repo" | "global", path }[]`
- `summary`: string
- `deliverables`: `{ path, description }[]`
- `open_questions`: string[]
- `next_actions`: string[]
- `artifacts`: `{ name, path }[]`
- `timing`: `{ started_at, finished_at, duration_ms }`
- `status`: `"completed" | "failed" | "cancelled"`
- `error`: string | null

## `delegate_resume`

Resume an existing specialist Codex sub-agent thread via `codex exec resume`, writing a run directory with artifacts.

### Input

All `delegate_run` fields, plus:
- `thread_id`: string (required)
- `task`: string (optional follow-up prompt)

Notes:
- If `skills_mode="auto"` but `task` is empty, skill selection is skipped (`selected_skills` will be empty).

### Output

Same shape as `delegate_run`.

## `delegate_autopilot`

Decide whether delegation is worthwhile, and if so orchestrate one or more specialist sub-agent runs.

### Input

- `task`: string (required)
- `cwd`: string (optional; defaults to the server process working directory)
- `sandbox`: `"read-only" | "workspace-write" | "danger-full-access"` (default `"workspace-write"`)
- `role`: string (default `"specialist"`)
- `skills_mode`: `"auto" | "explicit" | "none"` (default `"auto"`)
- `skills`: string[] (only used when `skills_mode="explicit"`)
- `max_skills`: number (default `6`)
- `include_repo_skills`: boolean (default `true`)
- `include_global_skills`: boolean (default `true`)
- `skip_git_repo_check`: boolean (default `false`)
- `max_agents`: number (default `3`)
- `max_parallel`: number (default `2`)

### Output (`structuredContent`)

- `run_id`, `run_dir`
- `decision`: `{ should_delegate: boolean, reason: string }`
- `plan`: `{ jobs: { id, title, thinking_level, role?, task, sandbox, model?, config_overrides?, skills_mode?, ... }[] }`
- `jobs`: per-job results, each with `run_dir` + `subagent_thread_id` and the same summary/deliverables/open_questions/next_actions pattern
- `aggregate`: consolidated `{ summary, deliverables, open_questions, next_actions }`
- `artifacts`: includes `autopilot_*.json` plus `subruns/`
- `timing`, `status`, `error`
