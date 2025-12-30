# Improve stdout for `delegate_*` MCP tools

**Parent macro ExecPlan:** `.agent/execplans/archive/2025-12-29_autonomous-subagent-delegation.md` (shipped `delegate_*` tools + artifact-first run directories).

**Research artifacts (gitignored by default):**
- `.agent/execplans/artifacts/2025-12-30_improve-mcp-tool-stdout/external_research.md`
- `.agent/execplans/artifacts/2025-12-30_improve-mcp-tool-stdout/repo_scan.md`

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Today, `delegate_run`, `delegate_resume`, and `delegate_autopilot` return a `content` text payload that is mostly just `Run directory: …`, even though `structuredContent` contains status, summaries, errors, and (for autopilot) per-subrun results.

End state: after any `delegate_*` tool call finishes, users can read what happened directly in tool output without digging into `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/`—while keeping output compact and avoiding accidental prompt/secret leakage.

Additionally, keep `content` and `structuredContent` semantically aligned (MCP guidance: “same information, different presentation”). See external research notes for details.

Minimum scope (explicitly requested):
- Include an **Autopilot plan** section in `delegate_autopilot` output.
- Include a **per-subrun `last_message.json` summary** section in `delegate_autopilot` output (request said `last_messages.json`, but this repo writes `last_message.json`).

## Progress

- [x] (2025-12-30 07:01) Create ExecPlan stub + capture prior subagent run notes.
- [x] (2025-12-30 07:13) Ground plan via MCP spec/SDK research + repo scan; write artifacts under `.agent/execplans/artifacts/2025-12-30_improve-mcp-tool-stdout/`.
- [ ] (2025-12-30 07:05) Define stdout format spec (tool-by-tool) + truncation rules.
- [ ] (2025-12-30 07:05) Implement formatter helper(s) and wire into `src/server.ts`.
- [ ] (2025-12-30 07:05) Add unit tests for formatter output.
- [ ] (2025-12-30 07:05) Update docs (`docs/reference/tools.md`) with example outputs.
- [ ] (2025-12-30 07:05) Validate (`npm test`, `npm run lint`, `npm run build`) + manual MCP smoke.

## Surprises & Discoveries

- Observation: Tool `content` currently only prints `Run directory: …` on success.
  Evidence: `src/server.ts` returns `text: \`Run directory: ${...}\`` in `delegate_autopilot`, `delegate_run`, and `delegate_resume`.

- Observation: Run directory layouts (including `last_message.json`) are already documented.
  Evidence: `docs/reference/run-directories.md`.

- Observation: `delegate_autopilot` already returns `decision`, `plan.jobs`, and per-job results (including `artifacts` pointing at `last_message.json`) in `structuredContent`, but none of this is shown in `content`.
  Evidence: `src/lib/delegation/types.ts`, `src/lib/delegation/autopilot.ts`, `src/server.ts`.

- Observation: MCP guidance expects `content` and `structuredContent` to be semantically equivalent; the spec also recommends including a serialized JSON representation in `content` for backwards compatibility.
  Evidence: `.agent/execplans/artifacts/2025-12-30_improve-mcp-tool-stdout/external_research.md`.

## Decision Log

- Decision: Improve human readability by enhancing tool `content` only; keep `structuredContent` schemas unchanged.
  Rationale: MCP clients may validate `structuredContent` against schemas; stdout improvements should be schema-neutral.
  Date/Author: 2025-12-30 / agent

- Decision: Centralize formatting in a shared module with truncation helpers.
  Rationale: Consistent output across tools and easy unit testing.
  Date/Author: 2025-12-30 / agent

- Decision: Never print full prompts, full skill bodies, or raw `events.jsonl` content in tool output.
  Rationale: Keep output compact and reduce accidental sensitive text exposure (artifacts already exist on disk).
  Date/Author: 2025-12-30 / agent

- Decision: In v1, do **not** embed full `structuredContent` JSON in `content`; instead, make `content` semantically equivalent via a compact, deterministic text summary plus artifact pointers.
  Rationale: The artifact-first design already preserves full details on disk and in `structuredContent`; full JSON in `content` is often too verbose for interactive chat UIs. (If backwards-compat JSON-in-text becomes necessary, we can add an opt-in debug flag or a truncated JSON appendix later.)
  Date/Author: 2025-12-30 / agent

## Outcomes & Retrospective

To fill at completion.

## Context and Orientation

Terminology:
- “stdout” in this plan means the human-readable `content[0].text` returned from MCP tools (what users see in chat/clients).
- `structuredContent` is machine-validated JSON; it already contains the detail we want to expose more readably.

Key artifacts (per `docs/reference/run-directories.md`):
- `last_message.json`: the final structured output emitted by the subagent (must match `subagent_output.schema.json`).
- `stderr.log`, `events.jsonl`, `result.json`: primary debugging entry points when a run fails.

Primary implementation touchpoints:
- `src/server.ts`: tool handlers where `content` is constructed.
- `src/lib/delegation/types.ts`: autopilot output shape (includes `plan.jobs` and per-job results).
- `src/lib/delegation/autopilot.ts`: writes `autopilot_plan.json` and per-job `last_message.json` artifacts.

Repo grounding notes (file pointers + current behavior): `.agent/execplans/artifacts/2025-12-30_improve-mcp-tool-stdout/repo_scan.md`.

## Plan of Work

1) Confirm current tool output and decide on a stable, compact formatting convention (plain text w/ bullets).
2) Implement a formatter module that takes `structuredContent` and returns a readable `content[0].text` string.
3) Wire the formatter into `delegate_run`, `delegate_resume`, and `delegate_autopilot` handlers in `src/server.ts`.
4) Add unit tests with small fixtures to lock formatting/truncation behavior.
5) Update docs with example outputs.

Design principles:
- High-signal first: status, summary, and next actions.
- Deterministic ordering and truncation: show counts + top N items.
- On failure: show the error plus the exact artifact pointers to debug (`stderr.log`, `result.json`, `last_message.json`).

## Stdout format spec (v1)

Conventions:
- Return a single text block in `content` (`content: [{ type: "text", text: "..." }]`).
- Plain text with stable section headers (avoid fancy Markdown features; assume clients may render as raw text).
- Deterministic order, deterministic truncation.
- Never print: `subagent_prompt.txt` contents, skill bodies, `events.jsonl` contents.

Truncation defaults:
- `MAX_ITEMS_PER_SECTION = 5` for list-like sections (`deliverables`, `open_questions`, `next_actions`).
- When truncated: show `... (+N more)` on its own line.
- For long single-line text (summary/description/error): truncate to ~200 chars with `…` (and keep the full text in artifacts/structuredContent).

### `delegate_run` / `delegate_resume`

Top section (always):
- tool name (`delegate_run` or `delegate_resume`)
- `status` (+ `duration_ms` if present)
- `run_dir`
- `subagent_thread_id` (or `(none)`)

Then:
- `summary`
- `deliverables` (truncated)
- `open_questions` (truncated)
- `next_actions` (truncated)

Debug pointers:
- Always include `last_message.json` path (from `artifacts[]`).
- On failure/cancel: include `stderr.log` + `result.json` paths (from `artifacts[]`) if present.

### `delegate_autopilot`

Top section (always):
- tool name `delegate_autopilot`
- `status` (+ `duration_ms` if present)
- `run_dir`
- `decision.should_delegate` + `decision.reason`

Then:
- `Autopilot plan` section listing `plan.jobs[]`:
  - `id`, `title`, `thinking_level`, `sandbox`, `skills_mode`, `max_skills`
- `Subruns` section listing each `jobs[]` entry:
  - `job_id`, `status`, `duration_ms`, `subagent_thread_id` (if any), `summary`
  - pointer(s): job `run_dir` + `last_message.json` (and `stderr.log` / `result.json` on failure if present)
- `Aggregate` section:
  - `aggregate.summary`
  - truncated `aggregate.deliverables/open_questions/next_actions`

## Concrete Steps

Repo scan (to ground formatting targets):
- `rg -n \"Run directory:\" src/server.ts`
- `rg -n \"delegate_(autopilot|run|resume)\" src/server.ts`
- `rg -n \"AutopilotToolOutputSchema|DelegateToolOutputSchema\" -S src`

Implementation (expected edits):
- Create `src/lib/mcp/formatToolContent.ts` (new folder `src/lib/mcp/`) with:
  - `formatDelegateToolContent(toolName: \"delegate_run\" | \"delegate_resume\", out: DelegateToolOutput): string`
  - `formatAutopilotToolContent(out: AutopilotToolOutput): string` (import `AutopilotToolOutput` from `src/lib/delegation/types.ts`)
  - truncation helpers (see “Stdout format spec (v1)”)
  - note: `DelegateToolOutputSchema` currently lives in `src/server.ts`, so define a local TS type in the formatter module (or extract the schema to a shared module as part of implementation if preferred).
- Update `src/server.ts` to set `content[0].text` to formatter output for each handler (import with `.js` extension per `src/AGENTS.md`):
  - `delegate_run`
  - `delegate_resume`
  - `delegate_autopilot`

Tests:
- Create `src/tests/mcp/formatToolContent.test.ts` (pure unit tests; no Codex auth) covering:
  - section presence (headers show up)
  - truncation behavior (`... (+N more)`)
  - failure vs success debug pointers (stderr/result included on failure)

Docs:
- Update `docs/reference/tools.md` to include example `content` outputs.

Verification:
- `npm test`
- `npm run lint`
- `npm run build`

## Validation and Acceptance

Minimum acceptance criteria:
- `delegate_autopilot` `content` includes:
  - “Autopilot plan” section listing jobs (`id`, `title`, `thinking_level`, `sandbox`, `skills_mode`, `max_skills`)
  - “Subruns” section summarizing each job’s `last_message.json`-derived output:
    - `status`, `duration_ms`, `subagent_thread_id` (if present), `summary`
    - pointer to the job run dir and `last_message.json` artifact path
- `delegate_run` / `delegate_resume` `content` includes:
  - `status`, `subagent_thread_id`, and `summary`
  - truncated deliverables + next actions with counts
  - on failure, explicit pointers to `stderr.log`, `result.json`, and `last_message.json`
- No tool output prints raw prompts or other long sensitive artifacts.
- `npm test`, `npm run lint`, and `npm run build` pass in a writable environment.

## Idempotence and Recovery

Safe to re-run:
- Formatter changes and unit tests are deterministic.

If output is too verbose:
- Reduce truncation limits in `formatToolContent.ts` and update tests.

If newline formatting renders poorly in a target client:
- Switch to a single-line “key: value | …” format and update tests/docs accordingly.

## Artifacts and Notes

### Research artifacts (created during plan grounding)

- External research (MCP spec + SDK patterns): `.agent/execplans/artifacts/2025-12-30_improve-mcp-tool-stdout/external_research.md`
- Repo scan (current code + file pointers): `.agent/execplans/artifacts/2025-12-30_improve-mcp-tool-stdout/repo_scan.md`

### Prior delegation run (evidence + grounding)

This work was previously explored via delegator run `2025-12-30_053403733_d27ce1e83fa1`. The key takeaways below are copied from the subruns’ `last_message.json` outputs (and `autopilot_plan.json`) so this ExecPlan remains self-contained.

#### Autopilot plan (`autopilot_plan.json`)

- `scan` — “Repo scan + approach” (`thinking_level=low`, `sandbox=read-only`, `skills_mode=auto`, `max_skills=6`)
- `implement` — “Implement requested change” (`thinking_level=high`, `sandbox=read-only`, `skills_mode=auto`, `max_skills=6`)
- `verify` — “Verify via tests/lint/build” (`thinking_level=low`, `sandbox=read-only`, `skills_mode=none`, `max_skills=6`)

#### Subrun `last_message.json` summaries

- `scan`:
  - Summary: Repo is Node.js (ESM) + TypeScript MCP server; main entry points are `src/server.ts`, `src/lib/delegation/*`, `src/lib/codex/runCodexExec.ts`, `src/lib/skills/*`.
  - Key note: output schemas must be respected; `last_message.json` is singular.
- `implement`:
  - Summary: Drafted an ExecPlan to improve tool `content` (status/summary/next actions; autopilot plan + per-subrun summaries), but could not write it due to read-only sandbox.
  - Key open questions: `last_messages.json` vs `last_message.json` naming; Markdown vs plain text; whether to list selected skills or only counts.
- `verify`:
  - Summary: `npm run lint` passed; `npm test` and `npm run build` failed in read-only sandbox due to filesystem write restrictions (`mkdtemp` and `dist/` writes).
  - Implication: verification must run in a writable environment.

### Suggested “golden” example output (to include in docs once implemented)

For `delegate_autopilot`, stdout should show:
- decision (should_delegate + reason)
- “Autopilot plan” job list (ids + settings)
- “Subruns” summaries (status + summary + artifact pointers)

## Interfaces and Dependencies

- MCP SDK: tool handlers return `{ content, structuredContent }` (`@modelcontextprotocol/sdk`).
- Schemas:
  - `delegate_run` / `delegate_resume`: `DelegateToolOutputSchema` in `src/server.ts`
  - `delegate_autopilot`: `AutopilotToolOutputSchema` in `src/lib/delegation/types.ts`
- Run directory layout and file naming: `docs/reference/run-directories.md` (notably `last_message.json`).
