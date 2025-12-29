# Codex specialized subagents MCP server

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Build a local (stdio) MCP server that lets Codex delegate work to isolated **`codex exec` sub-agents**.

In v1, Codex can call:
- `delegate.run` — spawn a new specialist sub-agent (new `codex exec` run)
- `delegate.resume` — resume a prior specialist session (`codex exec resume <thread_id>`)

The server:
- Discovers skills from:
  - **repo-local** `.codex/skills` (nearest ancestor of the delegated `cwd`)
  - **global** `${CODEX_HOME:-~/.codex}/skills`
- Selects skills (explicit or auto) and references them by **name + path** in the sub-agent prompt (does not inline skill bodies).
- Writes a full run directory (events, last message, metadata, skill index/selection) under:
  - `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/`
- Returns only a small structured summary + artifact paths to keep the main chat context light.

How you can see it working (end state):
1) Register this MCP server with Codex: `codex mcp add …`
2) Ask Codex to delegate a task (Codex calls `delegate.run`)
3) Verify a new run directory exists and contains the expected files (see **Validation and Acceptance**)

## Progress

- [x] (2025-12-29 19:18) Scaffolded repo with `lp-project-scaffold` and created initial ExecPlan.
- [x] (2025-12-29 19:25) Added minimal Node/TS project skeleton (no delegation logic yet).
- [x] (2025-12-29 19:26) Updated `README.md` + `AGENTS.md` to be repo-specific and point to this ExecPlan.
- [x] (2025-12-29 19:27) Verified local commands: `npm install`, `npm run build`, `npm test`.
- [x] (2025-12-29 19:39) Re-grounded this ExecPlan via Context7 + web research + repo scan; wrote artifacts:
  - `.agent/execplans/artifacts/2025-12-29_codex-specialized-subagents-mcp-server/external-research.md`
  - `.agent/execplans/artifacts/2025-12-29_codex-specialized-subagents-mcp-server/repo-scan.md`
- [x] (2025-12-29 19:58) Milestone 1: MCP tool stubs + local client test (no `codex exec`).
- [x] (2025-12-29 20:03) Docs sync: updated `README.md` to reflect `delegate.*` stubs and added `npm test` to Quickstart.
- [x] (2025-12-29 20:10) Milestone 2: Skill discovery + selection (+ persisted JSON artifacts).
- [x] (2025-12-29 20:20) Milestone 3: `codex exec` runner for `delegate.run` (events + last message + result summary).
- [x] (2025-12-29 20:27) Milestone 4: `delegate.resume`.
- [ ] Milestone 5: Tests + docs + manual smoke tests in 2 repos.

## Surprises & Discoveries

- Observation: `@modelcontextprotocol/sdk` has a required peer dependency on `zod` and internally imports `zod/v4` while supporting `zod/v3` and `zod/v4` entry points.
  Evidence: `node_modules/@modelcontextprotocol/sdk/README.md`.

- Observation: MCP tool handlers receive an `AbortSignal` (`extra.signal`) that flips when the client cancels a request; use it to terminate long-running work (kill the spawned `codex exec` process).
  Evidence: `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts`.

- Observation: Codex MCP defaults are too low for delegated runs; `tool_timeout_sec` must be increased for this server to avoid tool-call timeouts.
  Evidence: `https://developers.openai.com/codex/mcp`.

- Observation: `codex exec --json` produces a JSONL event stream; `--output-schema` enforces structured final output; `-o <file>` writes the last assistant message to disk (use as `last_message.json`).
  Evidence: `https://developers.openai.com/codex/sdk`.

- Observation: No separate “parent macro ExecPlan” exists in this repo; the closest macro scope is the root `README.md` section “What this will provide (v1)”.
  Evidence: `ls .agent/execplans` and `README.md`.

- Observation: MCP `Client.callTool()` validates `structuredContent` against the server-advertised tool output schema and throws if `structuredContent` is missing (unless `isError` is set).
  Evidence: `node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js` (`callTool(...)`).

- Observation: Node v24 can execute `.test.ts` under `node --test` without a loader, but we still run tests via `node --test --import tsx src/tests.ts` for Node 20+ compatibility.
  Evidence: `package.json` `test` script and `src/tests.ts`.

- Observation: TypeScript types for `fs.promises` do not include `Dirent`; import `Dirent` from `node:fs` when using `readdir(..., { withFileTypes: true })` with `promises as fs`.
  Evidence: `tsc` error `TS2694` while building `src/lib/skills/discover.ts`.

- Observation: `codex exec` supports reading the prompt from stdin when `PROMPT` is `-`, which avoids shell escaping/argument-length issues.
  Evidence: `codex exec --help` and `src/lib/codex/runCodexExec.ts`.

- Observation: `codex exec` options (e.g., `-C`, `--sandbox`, `--json`, `--output-schema`, `-o`) work when placed before the `resume` subcommand (`codex exec [OPTIONS] resume <id> -`).
  Evidence: `RUN_CODEX_INTEGRATION_TESTS=1 npm test` (integration test exercises `delegate.resume`).

## Decision Log

- Decision: Keep entrypoints as-is (`src/cli.ts` → `src/server.ts`) and implement logic in small modules under `src/lib/`.
  Rationale: Minimizes churn; matches current scaffold (`repo-scan.md`).
  Date/Author: 2025-12-29 / agent

- Decision: Use `McpServer.registerTool(...)` with Zod v4 schemas and return `structuredContent` (optionally with a small text `content` summary).
  Rationale: Strong typing + output validation; aligns with MCP SDK conventions.
  Date/Author: 2025-12-29 / agent

- Decision: Standardize on Zod v4 entry point imports (`zod/v4`) for all MCP schema work in this repo.
  Rationale: Avoid ambiguity/mixing when the SDK itself imports `zod/v4`.
  Date/Author: 2025-12-29 / agent

- Decision: Default delegated sub-agent sandbox to `read-only` unless explicitly requested by tool input.
  Rationale: Delegation can modify files; safe-by-default reduces accidental writes.
  Date/Author: 2025-12-29 / agent

- Decision: Persist delegation artifacts under `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/` and return paths rather than inlining content.
  Rationale: Keeps main chat context small; artifacts are durable and inspectable.
  Date/Author: 2025-12-29 / agent

- Decision: Implement cancellation by honoring MCP `extra.signal` and killing the child `codex` process.
  Rationale: Prevents orphaned processes and wasted compute after user cancels.
  Date/Author: 2025-12-29 / agent

- Decision: Prevent recursive delegation by (a) prompt-level guard (“do not call delegate.*”), and (b) if feasible, passing a Codex config override that disables this MCP server for the child process.
  Rationale: Avoid “delegate calls delegate” loops.
  Date/Author: 2025-12-29 / agent

- Decision: Once tests are added, update `npm test` to run TypeScript tests directly (e.g., `node --test --import tsx`), rather than requiring a build step.
  Rationale: Repo is TS-only; current `node --test` will not execute `.ts` tests without a loader/import.
  Date/Author: 2025-12-29 / agent

- Decision: Add `src/tests.ts` as a single test entrypoint that imports `src/**/*.test.ts`, and run it via `node --test --import tsx src/tests.ts`.
  Rationale: Keeps `npm test` cross-platform and Node 20-compatible without relying on shell glob expansion or Node’s test file discovery rules.
  Date/Author: 2025-12-29 / agent

- Decision: Align `Progress` milestone numbering with `Plan of Work` (fold “run directory + tool output schema plumbing” into Milestone 1).
  Rationale: Milestone numbering drifted; keeping one consistent set avoids confusion during execution and validation.
  Date/Author: 2025-12-29 / agent

- Decision: Skill indexing discovers all `**/SKILL.md` under both roots; if frontmatter is missing/invalid, fallback skill `name` is the parent folder name.
  Rationale: Keeps discovery resilient across uneven skill docs while still producing stable names for selection.
  Date/Author: 2025-12-29 / agent

- Decision: Explicit skill selection is case-insensitive by `name`, and prefers `origin="repo"` when names collide between repo/global.
  Rationale: Repo-local skills should override global defaults when the user requests a skill by name.
  Date/Author: 2025-12-29 / agent

- Decision: For `delegate.resume`, if `skills_mode="auto"` but the follow-up `task` is empty, treat selection as `"none"` and continue (with a warning) rather than failing the tool.
  Rationale: Resume calls can be valid even without new instructions; blocking on a missing task would be surprising.
  Date/Author: 2025-12-29 / agent

- Decision: Pipe `delegate.run` prompt via stdin (`codex exec -`) and persist it to `<run_dir>/subagent_prompt.txt` for reproducibility.
  Rationale: Avoids quoting/escaping bugs and provides an inspectable artifact for every delegated run.
  Date/Author: 2025-12-29 / agent

- Decision: If `delegate.resume.task` is empty, default the follow-up prompt to “Continue the previous thread…” (still enforcing the JSON output schema).
  Rationale: The tool schema allows an empty follow-up; we still need a concrete prompt to run `codex exec resume` non-interactively.
  Date/Author: 2025-12-29 / agent

## Outcomes & Retrospective

(Fill in after shipping v1.)

## Context and Orientation

### Key files and folders (repo-relative)

- `src/cli.ts` — executable entrypoint used by MCP registration (`dist/cli.js`)
- `src/server.ts` — `startServer()`; currently only connects stdio transport
- `package.json` — scripts + dependency versions
- `.codex/skills/` — repo-scoped skills (currently only a README)
- `.agent/execplans/artifacts/2025-12-29_codex-specialized-subagents-mcp-server/` — research + transcripts

### Definitions

- **Codex CLI**: `codex` binary; we spawn it in non-interactive mode via `codex exec`.
- **Delegator server**: this repo’s MCP server process, started by Codex via `codex mcp add ... -- node ...`.
- **Sub-agent**: a separate `codex exec` process doing a focused task.
- **Skill**: a directory containing `SKILL.md` with YAML frontmatter including at least `name` and `description`.
- **Repo-local skills root**: the nearest `.codex/skills` when walking upward from the delegated `cwd`.
- **Global skills root**: `${CODEX_HOME:-~/.codex}/skills`.
- **Run directory**: `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/` containing request + logs + outputs for one delegation call.

### Assumptions / open questions (resolve during implementation)

- How to best disable this MCP server for a child `codex exec` (exact config override key/value format). If unclear, ship v1 with prompt-only recursion guard.
- Whether Codex (as an MCP client) supplies `progressToken` on tool calls; implement progress as best-effort and safe to ignore.
- How to handle `cwd` that is not inside a git repo: decide whether to require an explicit `skip_git_repo_check=true` input flag.

## Plan of Work

Milestones are ordered to keep steps small and verifiable.

### Milestone 1 — MCP tool stubs + local client test (no Codex exec)

Edits/additions:
- Update `src/server.ts` to register `delegate.run` and `delegate.resume` with placeholder handlers that:
  - validate inputs via Zod
  - create a run directory and write `request.json`
  - return a structured response containing `run_id` and `run_dir`
- Add `src/lib/runDirs.ts` (create run dir + write JSON safely)
- Add an integration test that spawns `src/cli.ts` via stdio and calls the tool using the SDK client (`Client` + `StdioClientTransport`).

Outcome:
- `npm test` can list/call tools successfully without Codex installed/configured.

### Milestone 2 — Skill discovery + selection

Edits/additions:
- Add `src/lib/skills/discover.ts`:
  - walk up from delegated `cwd` to find `.codex/skills` (repo-local)
  - enumerate `<skill>/**/SKILL.md` (both repo-local and global roots)
- Add `src/lib/skills/parseSkillMarkdown.ts`: parse YAML frontmatter from `SKILL.md` (at least `name`, `description`).
- Add `src/lib/skills/select.ts`: explicit vs auto selection.
- Tool handlers persist:
  - `<run_dir>/skills_index.json`
  - `<run_dir>/selected_skills.json`

Outcome:
- `delegate.run` returns `selected_skills` and artifacts exist even if the index is empty.

### Milestone 3 — `codex exec` runner for `delegate.run`

Edits/additions:
- Add `src/lib/codex/runCodexExec.ts`:
  - Build args for `codex exec`:
    - `--cd <cwd>`
    - `--sandbox <read-only|workspace-write|danger-full-access>`
    - `--json`
    - `--output-schema <run_dir>/subagent_output.schema.json` (write this file before spawning)
    - `-o <run_dir>/last_message.json`
    - optionally `--skip-git-repo-check` (opt-in)
    - optionally a config override to disable this MCP server for the child (if we can make it work)
  - Stream:
    - stdout → `<run_dir>/events.jsonl`
    - stderr → `<run_dir>/stderr.log`
  - Parse JSONL to find `thread_id` (if present) and write `<run_dir>/thread.json`.
  - Write `<run_dir>/result.json` containing: timings, exit code/signal, thread_id, and pointers to the other artifacts.
  - Respect cancellation: if MCP `extra.signal` aborts, kill the child process and mark the run as cancelled in `result.json`.
- Update `delegate.run` handler to:
  - build the sub-agent prompt:
    - include task + role
    - include selected skill names + on-disk paths
    - include recursion guard text (“do not call delegate.* tools”)
  - spawn codex exec via `runCodexExec(...)`
  - return summary + artifact paths (do not inline artifacts)

Outcome:
- With Codex configured locally, `delegate.run` produces sub-agent work and a populated run directory.

### Milestone 4 — `delegate.resume`

Edits/additions:
- Add/extend runner to support `codex exec resume <thread_id> "<follow-up>"` with the same artifacts/logging pattern.
- Prefer creating a *new* run directory for resume calls (store `parent_thread_id` in `result.json`) for auditability.

Outcome:
- `delegate.resume` continues a previous thread and writes a new run directory.

### Milestone 5 — Tests + docs + smoke tests

Edits/additions:
- Update `package.json` `test` script to run TS tests (`node --test --import tsx`).
- Add unit tests for:
  - SKILL.md parsing edge cases
  - selection rules
  - path/root discovery
- Add an optional integration test that runs real `codex exec` only when `RUN_CODEX_INTEGRATION_TESTS=1` (because it requires auth/network).
- Update `README.md` with:
  - tool schemas (inputs/outputs)
  - required Codex MCP `tool_timeout_sec` guidance
  - example run directory layout

Outcome:
- `npm run build`, `npm test` pass; README describes real usage.
- Manual smoke test passes in two separate repos.

## Concrete Steps

> All commands run from the repo root unless noted.
>
> Keep actual smoke-test transcripts under:
> `.agent/execplans/artifacts/2025-12-29_codex-specialized-subagents-mcp-server/`.

1) Implement Milestone 1:
- Edit: `src/server.ts`
- Add: `src/lib/runDirs.ts`, tests under `src/**/*.test.ts`
- Run: `npm test`
- Run: `npm run build`

2) Implement Milestone 2:
- Add: `src/lib/skills/*`
- Run: `npm test`

3) Implement Milestone 3 (requires Codex installed/configured):
- Add: `src/lib/codex/runCodexExec.ts`
- Run: `npm test`
- Run: `npm run build`
- Register MCP server globally:
  - `codex mcp add codex-specialized-subagents -- node \"$(pwd)/dist/cli.js\"`
  - `codex mcp list`
- Ensure Codex MCP timeouts are high enough in `${CODEX_HOME:-~/.codex}/config.toml` for this server (increase `tool_timeout_sec`).

4) Manual smoke test in repo A + repo B:
- In repo A, use Codex to call `delegate.run` on a short task.
- Confirm run dir contains expected artifacts (below).
- Repeat in repo B.

## Validation and Acceptance

### Automated (CI-friendly)

- Typecheck/build: `npm run build`
- Tests: `npm test`

### Manual acceptance story

1) Register server:
- `codex mcp add codex-specialized-subagents -- node \"$(pwd)/dist/cli.js\"`
- `codex mcp list` shows it enabled

2) Tool call:
- Codex calls `delegate.run` and gets a response with:
  - `run_id`, `run_dir`
  - `subagent_thread_id` (when available)
  - `selected_skills` (names)
  - `summary`, `next_actions`

3) Run directory layout:
`<run_dir>/` contains at least:
- `request.json`
- `skills_index.json`
- `selected_skills.json`
- `subagent_prompt.txt`
- `events.jsonl`
- `stderr.log`
- `last_message.json`
- `result.json`

4) Resume:
- Codex calls `delegate.resume` with `thread_id` and follow-up prompt
- A new run directory is created and populated similarly

## Idempotence and Recovery

- Safe to re-run:
  - `npm install`, `npm test`, `npm run build`, `npm run dev`
  - repeated tool calls (they create new run directories)
- Recovery:
  - Remove MCP server: `codex mcp remove codex-specialized-subagents`
  - Delete run artifacts: remove `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/`
  - If a tool call is cancelled, ensure the child `codex` process is terminated (verify via `ps`/Activity Monitor if debugging)

## Artifacts and Notes

Research/grounding (local; `.agent/execplans/artifacts/` is gitignored by default):
- `.agent/execplans/artifacts/2025-12-29_codex-specialized-subagents-mcp-server/external-research.md`
- `.agent/execplans/artifacts/2025-12-29_codex-specialized-subagents-mcp-server/repo-scan.md`

Runtime artifacts (produced by implementation):
- `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/...`

Verification transcripts (kept minimal; details via `git log` + tests):
- (2025-12-29 20:19) `RUN_CODEX_INTEGRATION_TESTS=1 npm test` passed (includes `delegate.run` calling real `codex exec` and verifying artifacts).
- (2025-12-29 20:26) `RUN_CODEX_INTEGRATION_TESTS=1 npm test` passed (includes `delegate.run` + `delegate.resume` end-to-end via `codex exec` / `codex exec resume`).

## Interfaces and Dependencies

### External dependencies

- Node.js `>=20` (repo `engines`)
- `codex` CLI on PATH (required for Milestones 3+)
- `@modelcontextprotocol/sdk` (currently `^1.25.1`)
- `zod` (currently `^4.2.1`)

### MCP tool interfaces (v1)

`delegate.run` input (Zod schema):
- `task`: string (required)
- `cwd`: string (required; absolute path recommended)
- `role`: string (optional; default `"specialist"`)
- `skills_mode`: `"auto" | "explicit" | "none"` (default `"auto"`)
- `skills`: string[] (explicit mode only)
- `max_skills`: number (auto mode; default 6)
- `include_repo_skills`: boolean (default true)
- `include_global_skills`: boolean (default true)
- `sandbox`: `"read-only" | "workspace-write" | "danger-full-access"` (default `"read-only"`)
- `skip_git_repo_check`: boolean (default false)

`delegate.resume` input:
- `thread_id`: string (required)
- `task`: string (optional follow-up prompt)
- everything else same as `delegate.run` (especially `cwd` + sandbox)

Tool output (Zod schema):
- `run_id`: string
- `run_dir`: string
- `subagent_thread_id`: string | null
- `selected_skills`: { name: string; description?: string; origin: "repo" | "global"; path: string }[]
- `summary`: string
- `deliverables`: { path: string; description: string }[]
- `open_questions`: string[]
- `next_actions`: string[]
- `artifacts`: { name: string; path: string }[]
- `timing`: { started_at: string; finished_at: string | null; duration_ms: number | null }
- `status`: `"completed" | "failed" | "cancelled"`
- `error`: string | null

### Sub-agent output (JSON, schema-enforced via `codex exec --output-schema`)

The *sub-agent’s final answer* (written to `<run_dir>/last_message.json`) must be a single JSON object:
- `summary`: string
- `deliverables`: { path: string; description: string }[]
- `open_questions`: string[]
- `next_actions`: string[]
