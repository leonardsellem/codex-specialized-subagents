# Autonomous Subagent Delegation (Autopilot) Implementation Plan

> **Recommended execution:** Use `executing-plans` to implement this plan task-by-task (batch + checkpoints).

**Goal:** In Codex interactive mode, “normal” user prompts naturally trigger delegation to this MCP server when it’s beneficial, without the user needing to write explicit tool calls.

**Architecture:** Add a new MCP tool `delegate_autopilot` (minimal input schema) that can orchestrate one or more specialized sub-agent runs (parallel or sequential) and return an aggregated, artifact-first result. Add a Codex skill (installed globally) that teaches the *parent* Codex agent when/how to call `delegate_autopilot` automatically, while ensuring delegated *sub-agents* never recurse into `delegate_*`.

**Tech Stack:** Node.js >= 20, TypeScript (NodeNext ESM), `@modelcontextprotocol/sdk`, `zod/v4`, (optional) `yaml` for robust skill frontmatter parsing.

---

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Today, the MCP server works, but delegation is only used when the user (or Codex) explicitly calls `delegate.run` / `delegate.resume`. The desired UX is:

- A user can type “Implement X” in *interactive* Codex.
- Codex automatically decides whether to delegate and (if yes) calls the MCP server with sensible defaults.
- The MCP server runs specialized sub-agents (parallel/sequential) and returns an aggregated result with durable artifacts.
- If delegation is not helpful, Codex proceeds directly (no MCP calls).

We cannot *force* Codex to call tools, but we can make tool usage natural and reliable by:
1) exposing a single “do the right thing” tool (`delegate.autopilot`) with minimal required args + strong defaults, and
2) providing a global Codex skill that teaches the parent agent to use it only when beneficial.

**Note (2025-12-29):** Codex/OpenAI tool naming restrictions require `^[a-zA-Z0-9_-]+$`, so the shipped tool names are `delegate_run`, `delegate_resume`, `delegate_autopilot`. Older sections below may still reference the pre-rename `delegate.*` names.

## Progress

- [x] (2025-12-29 21:05 CET) Land plan in-repo (baseline for implementation). (`47dc4ff`)
- [x] (2025-12-29 21:05 CET) Implement `delegate_autopilot` and global skill-driven calling behavior. (see commits above)
- [x] (2025-12-29 21:08 CET) Task 1: Add autopilot schemas + tests. (`0a23795`)
- [x] (2025-12-29 21:11 CET) Task 2: Add `routeAutopilotTask(...)` heuristics + tests. (`d0cd66f`)
- [x] (2025-12-29 21:13 CET) Task 3: Add concurrency-limited `runJobs(...)` helper + tests. (`d205d4e`)
- [x] (2025-12-29 21:17 CET) Task 4: Implement + register `delegate.autopilot` tool + unit tests. (`7d4138c`)
- [x] (2025-12-29 21:20 CET) Task 5a: Support `delegator_exclude: true` skill frontmatter (exclude from delegation index). (`6250477`)
- [x] (2025-12-29 21:22 CET) Task 5b: Add repo-local `delegation-autopilot` skill (template for global install). (`9611210`)
- [x] (2025-12-29 21:24 CET) Task 5c: Update docs (`README.md`, `AGENTS.md`) for `delegate.autopilot` + global skill install. (`553e8cd`)
- [x] (2025-12-29 21:28 CET) Fix `tsc` build errors; `npm test`, `npm run build`, `npm run lint` pass. (`a7b9484`)
- [x] (2025-12-29 21:36 CET) Rename MCP tools to `delegate_*` (Codex tool name pattern compatibility) + update docs/skills. (`80e5563`, `486e3bc`, `2e6c01e`)
- [x] (2025-12-29 21:38 CET) Manual Codex verification: `codex exec` runs with this MCP enabled and can call `delegate_autopilot`. (see **Artifacts and Notes**)

## Surprises & Discoveries

- Observation: …
  Evidence: …
- Observation: `npm test` (via `tsx`) passed while `tsc` failed due to an unexported type import + inferred union widening.
  Evidence: `npm run build` failed before `a7b9484`, then passed after.
- Observation: `codex exec` failed with HTTP 400 because at least one MCP tool name didn’t match the OpenAI tool-name regex `^[a-zA-Z0-9_-]+$` (dots are rejected).
  Evidence: `codex exec` failed with this MCP enabled, and succeeded when run with `-c mcp_servers.codex-specialized-subagents.enabled=false`.

## Decision Log

- Decision: Use a single high-level tool `delegate.autopilot` (in addition to existing low-level `delegate.run`/`delegate.resume`).
  Rationale: Makes tool calling “natural” for the parent agent; reduces argument verbosity; centralizes orchestration logic.
  Date/Author: 2025-12-29 / agent

- Decision: Gate “autonomous calling” primarily through a global Codex skill installed in `${CODEX_HOME:-~/.codex}/skills`.
  Rationale: This is the only practical way to teach the parent interactive Codex agent to call `delegate_autopilot` without user-written JSON.
  Date/Author: 2025-12-29 / agent

- Decision: Rename tools from `delegate.*` to `delegate_*` (`delegate_run`, `delegate_resume`, `delegate_autopilot`) to satisfy Codex/OpenAI tool-name restrictions (no dots).
  Rationale: With dot-named tools enabled, `codex exec` fails early with HTTP 400 and cannot call any tools.
  Date/Author: 2025-12-29 / agent

## Outcomes & Retrospective

(Fill in after shipping.)

## Context and Orientation

### Current implementation (repo-relative)

- MCP server entrypoints:
  - `src/cli.ts`
  - `src/server.ts` (`delegate.run`, `delegate.resume`)
- Codex runner:
  - `src/lib/codex/runCodexExec.ts` (`codex exec` / `codex exec resume`)
  - `src/lib/codex/subagentOutput.ts` (schema for sub-agent final JSON)
- Run directories:
  - `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/`
  - `src/lib/runDirs.ts`
- Skills:
  - `src/lib/skills/*` discovers + selects skills for delegated runs
- Tests:
  - `src/tests/**/*.test.ts` (run via `src/tests.ts`)
  - `RUN_CODEX_INTEGRATION_TESTS=1 npm test` runs real `codex exec` integrations

### Important constraint: “natural” tool use is a Codex behavior

This repo can’t change Codex’s internal tool-selection policy. The best lever we control is:
- tool design (name, schema defaults, descriptions), and
- a global Codex skill that instructs the parent agent to call `delegate.autopilot` when a request is large/multi-step.

## Plan of Work

### Milestone A — Add `delegate.autopilot` tool (single-call orchestration)

Outcome:
- Codex can call `delegate.autopilot` with *just* `{ "task": "…" }` (and optionally `cwd`) and get a valid aggregated output + artifact paths.

### Milestone B — Parallel/sequential sub-agent execution inside `delegate.autopilot`

Outcome:
- `delegate.autopilot` can run N sub-agents with a concurrency limit, persist per-subrun artifacts, and aggregate results.

### Milestone C — “Natural calling” via a global Codex skill

Outcome:
- In interactive Codex, a normal prompt like “Refactor X and update tests” causes Codex to call `delegate.autopilot` *without* the user writing JSON.

### Milestone D — Tests + docs + manual UX verification

Outcome:
- `npm test`, `npm run build`, `npm run lint` pass.
- README documents the new tool and how to install the global skill.
- Manual interactive verification shows:
  - one prompt that triggers autopilot
  - one prompt that does not

## Concrete Steps (Task-by-task)

### Task 1: Add autopilot tool schemas

**Files:**
- Modify: `src/server.ts`
- Create: `src/lib/delegation/types.ts`
- Test: `src/tests/delegation/types.test.ts`

**Step 1: Write failing test**

Create `src/tests/delegation/types.test.ts` to assert the autopilot output schema accepts required fields.

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL (module not found / schema not defined).

**Step 3: Implement minimal types + schema**

Create `src/lib/delegation/types.ts` with:
- `AutopilotInput` (minimal: `task`, optional `cwd`)
- `AutopilotPlan` (list of jobs; each has `id`, `title`, `role`, `task`, `sandbox`, `skills_mode`, etc.)
- `AutopilotResult` (aggregate + per-job pointers)

**Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS.

**Step 5: Commit**

`git commit -m "feat(autopilot): add types + schemas"`

---

### Task 2: Implement a router that decides “delegate or not” + job plan (deterministic v1)

**Files:**
- Create: `src/lib/delegation/route.ts`
- Test: `src/tests/delegation/route.test.ts`

**Step 1: Write failing tests**

`src/tests/delegation/route.test.ts` should cover:
- Small/simple task → `should_delegate=false`
- Multi-part task (mentions tests + docs + multiple steps) → `should_delegate=true` and a plan with 2–4 jobs

**Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL.

**Step 3: Implement minimal router**

`routeAutopilotTask({ task, cwd, ... })` returns:
- `decision`: `should_delegate`, `reason`
- `plan`: list of jobs

Suggested v1 heuristic (cheap + deterministic):
- Delegate if:
  - task length > N chars OR
  - contains 2+ “work categories” keywords (e.g., tests/docs/refactor/perf/security) OR
  - contains 2+ verbs like “and”, “then”, “also”, “plus”
- Otherwise don’t delegate.

Job template (v1):
- `scan` (read-only): quickly map files + risks
- `solution` (workspace-write or caller-selected sandbox): propose/apply changes
- `verify` (read-only): run tests/lint/build guidance
- `docs` (read-only): update docs guidance

**Step 4: Run tests to verify pass**

Run: `npm test`

**Step 5: Commit**

`git commit -m "feat(autopilot): add routing heuristics"`

---

### Task 3: Implement parallel/sequential job runner with cancellation

**Files:**
- Create: `src/lib/delegation/runJobs.ts`
- Test: `src/tests/delegation/runJobs.test.ts`

**Step 1: Write failing tests**

Use fake async jobs to assert:
- concurrency limit is respected
- cancellation aborts remaining work

**Step 2: Run tests to verify failure**

Run: `npm test`

**Step 3: Implement runner**

Implement:
- `runJobs(jobs, { maxParallel, signal })` returning per-job results and partials if cancelled.
- Always write deterministic ordering in results (stable sort by job id).

**Step 4: Run tests to verify pass**

Run: `npm test`

**Step 5: Commit**

`git commit -m "feat(autopilot): add job runner with concurrency + abort"`

---

### Task 4: Implement `delegate.autopilot` tool handler + artifacts

**Files:**
- Modify: `src/server.ts`
- Create: `src/lib/delegation/autopilot.ts`
- Test: `src/tests/server.test.ts` (integration shape), `src/tests/delegation/autopilot.test.ts`

**Step 1: Write failing tests**

- Unit: `autopilot.test.ts` asserts:
  - creates a parent run dir
  - writes `request.json`, `autopilot_decision.json`, `autopilot_plan.json`
  - if `should_delegate=false`, does not spawn `codex exec`
- Integration (gated): update `src/tests/server.test.ts` to call `delegate.autopilot` when `RUN_CODEX_INTEGRATION_TESTS=1`.

**Step 2: Run tests to verify failure**

Run: `npm test`

**Step 3: Implement handler**

Tool signature (suggested):
- `delegate.autopilot` input:
  - `task`: string (required)
  - `cwd`: string (optional; default `process.cwd()`)
  - `sandbox`: `"read-only" | "workspace-write" | "danger-full-access"` (optional; default `"workspace-write"` for “do work”)
  - `max_agents`: number (optional; default `3`)
  - `max_parallel`: number (optional; default `2`)
  - reuse skill include flags from `delegate.run` (optional)

Artifact layout (inside parent `<run_dir>/`):
- `request.json`
- `autopilot_decision.json`
- `autopilot_plan.json`
- `subruns/<job_id>/...` (each contains the usual `events.jsonl`, `last_message.json`, etc.)
- `autopilot_aggregate.json` (aggregate of subruns)

Return:
- small `structuredContent` summary
- list of artifact paths (including `subruns/` dir)

**Step 4: Run tests to verify pass**

Run: `npm test`

**Step 5: Commit**

`git commit -m "feat(mcp): add delegate.autopilot tool"`

---

### Task 5: Add a global Codex skill that triggers autopilot naturally

**Files:**
- Create: `.codex/skills/delegation-autopilot/SKILL.md`
- Modify: `README.md` (install instructions)
- Modify (optional): `src/lib/skills/parseSkillMarkdown.ts` + tests to support `delegator_exclude` metadata

**Step 1: Decide where the skill lives**

Preferred: install to global `${CODEX_HOME:-~/.codex}/skills/delegation-autopilot/SKILL.md`.

To keep it versioned, keep a copy in this repo under `.codex/skills/delegation-autopilot/SKILL.md`, but ensure delegated sub-agents do not accidentally select/use it.

**Step 2: (Optional but recommended) Add `delegator_exclude: true` support**

- Add support for a boolean frontmatter key `delegator_exclude` in `SKILL.md`.
- Update `discoverSkills(...)` to exclude such skills from the index passed to delegated sub-agents.
- Rationale: prevents recursion/instruction pollution if the global skill is installed.

**Step 3: Write the skill**

The skill should instruct the *parent* agent:
- Before doing work, decide if the user request is multi-step / cross-cutting / research-heavy.
- If yes, call `delegate.autopilot` with minimal args.
- If no, proceed normally without delegation.
- Never paste secrets.

**Step 4: Docs**

Update `README.md` with:
- how to install the skill globally (copy/symlink)
- example interactive prompts that trigger / don’t trigger delegation

**Step 5: Commit**

`git commit -m "docs(skills): add delegation-autopilot skill + install docs"`

---

### Task 6: Manual interactive verification (acceptance)

**Step 1: Register MCP server**

From repo root:
- `npm run build`
- `codex mcp add codex-specialized-subagents -- node \"$(pwd)/dist/cli.js\"`
- `codex mcp list`

**Step 2: Install global skill**

Copy repo skill to global:
- `mkdir -p \"${CODEX_HOME:-$HOME/.codex}/skills/delegation-autopilot\"`
- `cp .codex/skills/delegation-autopilot/SKILL.md \"${CODEX_HOME:-$HOME/.codex}/skills/delegation-autopilot/SKILL.md\"`

**Step 3: Run 2 interactive prompts**

Prompt A (should delegate):
- “Refactor the MCP server to add a new `delegate.autopilot` tool and update tests + README.”

Prompt B (should not delegate):
- “What does the `delegate.run` tool do?”

Expected:
- Prompt A causes Codex to call `delegate.autopilot` (visible in tool call UI/logs) and returns `run_dir`.
- Prompt B does not call any `delegate.*` tool.

**Step 4: Record evidence**

Append run dirs + brief notes to this ExecPlan under **Artifacts and Notes**.

**Step 5: Commit**

Docs-only commit if you updated README/AGENTS based on findings.

## Validation and Acceptance

Automated:
- `npm test`
- `npm run build`
- `npm run lint`
- Optional: `RUN_CODEX_INTEGRATION_TESTS=1 npm test`

Manual:
- In interactive Codex, a complex prompt triggers `delegate.autopilot`, and a simple prompt does not.
- Run directory contains expected artifacts for parent + subruns.

## Idempotence and Recovery

- Safe to re-run: `npm test`, `npm run build`, `npm run lint`
- Safe to re-run tool calls: each creates a new run directory
- Recovery:
  - remove MCP server: `codex mcp remove codex-specialized-subagents`
  - delete run dirs under `${CODEX_HOME:-~/.codex}/delegator/runs/`

## Artifacts and Notes

- Put manual transcripts under `.agent/execplans/artifacts/2025-12-29_autonomous-subagent-delegation/` (gitignored by default).
- Manual verification (explicit tool call): `codex exec` created run dir `~/.codex/delegator/runs/2025-12-29_203731284_be3f41daf129/` (tool `delegate_autopilot`, `should_delegate=false`).

## Interfaces and Dependencies

New MCP tool (proposed):
- `delegate.autopilot` (minimal caller surface; orchestrates specialized sub-agents)

New skill (proposed):
- Global skill installed to `${CODEX_HOME:-~/.codex}/skills/delegation-autopilot/` that triggers automatic calling behavior in interactive Codex.
