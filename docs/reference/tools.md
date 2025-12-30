# Tool reference

This file documents the MCP tools exposed by this server and their input/output shapes.

All tools return a human-readable `content` message plus a machine-validated `structuredContent` payload.

Note: while `codex exec` is running, this server may also emit MCP logging notifications (best-effort) for liveness/progress; the final tool result is still only returned when the tool call completes.

## `delegate_run`

Spawn a new specialist Codex sub-agent run via `codex exec`, writing a run directory with artifacts.

### Input

- `task`: string (required)
- `cwd`: string (required)
- `role`: string (default `"specialist"`)
- `model`: string (optional; forwarded as `codex exec -c model="..."`)
- `reasoning_effort`: string (optional; forwarded as `codex exec -c model_reasoning_effort="..."`)
- `config_overrides`: string[] (optional; forwarded as `codex exec -c <override>`)
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

### Example `content`

```text
delegate_run
status: completed (1234ms)
run_dir: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef
subagent_thread_id: thread-123

summary: Updated tool stdout formatting.

deliverables (2):
- src/server.ts — Use formatter for delegate_* tool content.
- src/lib/mcp/formatToolContent.ts — Add deterministic text formatting helpers.

open_questions (0):
- (none)

next_actions (2):
- Run npm test
- Run npm run build

Debug pointers:
- last_message.json: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef/last_message.json
```

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

### Example `content`

```text
delegate_resume
status: completed (1234ms)
run_dir: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef
subagent_thread_id: thread-123

summary: Updated tool stdout formatting.

deliverables (2):
- src/server.ts — Use formatter for delegate_* tool content.
- src/lib/mcp/formatToolContent.ts — Add deterministic text formatting helpers.

open_questions (0):
- (none)

next_actions (2):
- Run npm test
- Run npm run build

Debug pointers:
- last_message.json: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef/last_message.json
```

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

Notes:
- `thinking_level` is autopilot’s internal label (`low | medium | high`), not a Codex config key.
- `config_overrides` is a list of strings forwarded to `codex exec -c <override>` for that job (for example: `model_reasoning_effort="high"`).

### Example `content`

```text
delegate_autopilot
status: completed (3000ms)
run_dir: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef
should_delegate: true
reason: Multiple steps across code + docs + verification.

Autopilot plan:
- scan: Repo scan (thinking_level=low sandbox=read-only skills_mode=auto max_skills=6)
- implement: Implement (thinking_level=high sandbox=workspace-write skills_mode=auto max_skills=6)

Subruns:
- scan: completed (1000ms) subagent_thread_id=thread-scan
  summary: Found src/server.ts tool handlers.
  run_dir: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef/subruns/scan
  last_message.json: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef/subruns/scan/last_message.json
- implement: completed (2000ms) subagent_thread_id=thread-impl
  summary: Added formatter module + wired tool handlers.
  run_dir: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef/subruns/implement
  last_message.json: /home/user/.codex/delegator/runs/2025-12-30_000000_abcdef/subruns/implement/last_message.json

Aggregate:
summary: Repo scan (completed): Found src/server.ts tool handlers. Implement (completed): Added formatter module + wired tool handlers.

deliverables (1):
- src/lib/mcp/formatToolContent.ts — New formatter

open_questions (0):
- (none)

next_actions (1):
- Run tests
```
