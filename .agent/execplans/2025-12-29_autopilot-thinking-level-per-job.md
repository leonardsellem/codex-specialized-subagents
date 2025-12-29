# Autopilot thinking-level per job Implementation Plan

> **Recommended execution:** Use `executing-plans` to implement this plan task-by-task (batch + checkpoints).

**Parent macro ExecPlan:** `.agent/execplans/archive/2025-12-29_autonomous-subagent-delegation.md` (shipped `delegate_*` tools + `delegate_autopilot` routing/orchestration).

**Goal:** When `delegate_autopilot` decides to delegate, it assigns a deterministic `thinking_level` to each autopilot job (`scan` / `implement` / `verify`). At runtime, `thinking_level` may be resolved into per-job Codex CLI config overrides (primarily model selection) and passed into each `codex exec` sub-run.

**Architecture:** Keep routing pure and deterministic (job type + task text heuristics), but resolve provider-specific configuration (model IDs / Codex config overrides) from environment variables at runtime so default behavior is unchanged unless configured. Persist the decision in `autopilot_plan.json` and in each job’s `request.json` (written under `subruns/<job_id>/request.json`), and pass the resolved overrides into `runCodexExec` (which already supports `-c/--config`).

**Tech Stack:** Node.js >= 20 (ESM/NodeNext) + TypeScript + `@modelcontextprotocol/sdk` + `zod/v4` + `node:test`.

---

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Today, `delegate_autopilot` spawns multiple sub-agents (jobs like “scan”, “implement”, “verify”) but they all inherit the same Codex model configuration. This wastes time/cost on “cheap” phases (scan/verify) and can undershoot quality on “hard” phases (implementation).

After this change:
- The autopilot plan explicitly includes a `thinking_level` for each job (e.g., `low` for scan, `high` for implement).
- The server resolves each job’s `thinking_level` into a model override (when configured) and passes it to `codex exec` so jobs can run different models.
- The decision is visible in artifacts (`autopilot_plan.json`, job `request.json`) to reduce debugging friction.

## Progress

- [x] (2025-12-29 23:23) Ground this ExecPlan with external research + repo scan (Codex CLI flags, existing autopilot/runCodexExec wiring, current job IDs).
- [x] (2025-12-29 23:30) Confirm the exact `codex` CLI flags we will rely on (`--config/-c`, `--model/-m`) and how they behave in our local setup. (see **Artifacts and Notes**)
- [ ] (2025-12-29 23:23) Add `thinking_level` + (optional) per-job Codex override fields to autopilot job schema (`src/lib/delegation/types.ts`).
- [ ] (2025-12-29 23:23) Assign deterministic `thinking_level` in `routeAutopilotTask` for each job (`src/lib/delegation/route.ts`) and cover it with unit tests.
- [ ] (2025-12-29 23:23) Resolve per-job model/config overrides from env in `runAutopilot`, persist the enriched plan, and pass overrides into `runCodexExec` (`src/lib/delegation/autopilot.ts`).
- [ ] (2025-12-29 23:23) Add unit tests (TDD) for env mapping + `runCodexExec({ configOverrides })` wiring.
- [ ] (2025-12-29 23:23) Update docs (`docs/reference/tools.md`, `docs/usage.md`, `README.md`) and verify `npm test`, `npm run lint`, `npm run build` (optionally `RUN_CODEX_INTEGRATION_TESTS=1 npm test`).

## Surprises & Discoveries

- Observation: Codex CLI supports global `--config/-c key=value` overrides and `--model/-m <model>`; in our local Codex CLI, `--config/-c` values are parsed as TOML and fall back to a raw literal string when TOML parsing fails.
  Evidence: `codex exec --help` (local) and `https://developers.openai.com/codex/cli-reference` (external)
- Observation: Codex config includes `model_reasoning_effort` with values `minimal | low | medium | high | xhigh` (useful future extension for mapping `thinking_level` to reasoning depth).
  Evidence: `https://developers.openai.com/codex/config-reference`
- Observation: This repo already has the correct hook point for per-run Codex config: `runCodexExec({ configOverrides?: string[] })` passes each entry as `codex exec -c <override> ...` (no shell quoting; args are passed as an array).
  Evidence: `src/lib/codex/runCodexExec.ts`
- Observation: Autopilot job IDs are already standardized and phase-split is hard-coded by ID (`scan` → pre, `implement` → work, `verify` → post); this plan must keep those IDs stable.
  Evidence: `src/lib/delegation/route.ts`, `src/lib/delegation/autopilot.ts`
- Observation: In Zod v4, `.default(...)` provides a value when input is `undefined` (and `.extend(...)` is the standard way to add fields to existing object schemas); use this deliberately when adding new fields so the inferred TS types match what we actually construct/emit.
  Evidence: Context7 (`/colinhacks/zod/v4.0.1`) docs for `.default()` and `.extend()`

## Decision Log

- Decision: Represent “thinking level” as `low | medium | high` on each autopilot job as `thinking_level` (snake_case), and always emit it in `plan.jobs[]`.
  Rationale: Deterministic, provider-agnostic label; aligns with existing job fields (`skills_mode`, `skip_git_repo_check`, …) and makes the plan debuggable without inspecting prompts.
  Date/Author: 2025-12-29 / agent

- Decision: Use existing `runCodexExec({ configOverrides })` and pass Codex CLI `--config/-c` overrides (including `model=<id>`), instead of introducing a new `runCodexExec({ model })` parameter in v1.
  Rationale: `src/lib/codex/runCodexExec.ts` already supports repeated `-c` flags and avoids shell quoting issues by piping prompts via stdin.
  Date/Author: 2025-12-29 / agent

- Decision: Resolve per-level model IDs from environment variables so default behavior remains unchanged unless configured.
  Rationale: Avoid hard-coding model IDs (provider-specific/unstable) while still enabling per-job model selection.
  Date/Author: 2025-12-29 / agent

- Decision: Keep routing pure: `routeAutopilotTask` assigns `thinking_level` deterministically (job id + task text heuristics), while `runAutopilot` resolves environment-dependent overrides and persists the enriched plan.
  Rationale: Preserves the “pure router” architecture from the parent macro ExecPlan while still making runtime decisions visible in artifacts.
  Date/Author: 2025-12-29 / agent

## Outcomes & Retrospective

(fill in after milestone completion)

## Context and Orientation

Key files:
- `src/lib/delegation/types.ts`: Zod schemas/types for autopilot input/output and job shapes.
- `src/lib/delegation/route.ts`: Heuristic routing that decides whether to delegate and constructs the `plan.jobs`.
- `src/lib/delegation/autopilot.ts`: Writes parent artifacts (`autopilot_*.json`) and executes jobs by calling `runCodexExec` (phased by job id: `scan`, `implement`, `verify`).
- `src/lib/codex/runCodexExec.ts`: Spawns `codex exec` and already supports `configOverrides` (passed as repeated `-c/--config key=value` flags).

Relevant tests:
- `src/tests/delegation/route.test.ts`
- `src/tests/delegation/autopilot.test.ts`
- `src/tests/delegation/types.test.ts`

Docs that should be updated after implementation:
- `docs/reference/tools.md`
- `docs/usage.md`
- `README.md`

Terminology:
- **Thinking level:** a coarse classification (`low|medium|high`) chosen by the server per autopilot job.
- **Config override:** a Codex CLI `--config/-c key=value` override passed to `codex exec` (this plan uses it primarily for `model=<id>`).

External references used for grounding (Phase A):
- Codex CLI flags and `--config` semantics: `https://developers.openai.com/codex/cli-reference`
- Codex basic config and `model_reasoning_effort` overview: `https://developers.openai.com/codex/config-basic`
- Codex config reference (`model_reasoning_effort` allowed values): `https://developers.openai.com/codex/config-reference`
- Codex MCP server registration (`codex mcp add ... -e KEY=VALUE -- <cmd>`): `https://developers.openai.com/codex/mcp`

Configuration (proposed):
- `CODEX_AUTOPILOT_MODEL_LOW`: model ID to use for `thinking_level=low`
- `CODEX_AUTOPILOT_MODEL_MEDIUM`: model ID to use for `thinking_level=medium`
- `CODEX_AUTOPILOT_MODEL_HIGH`: model ID to use for `thinking_level=high`

If a given env var is unset/empty, the server should **not** override the model for that job (inherit default Codex config).

## Plan of Work

1) Confirm the exact Codex CLI flags we will rely on and how to express model overrides (`--config/-c model=<id>` vs `--model/-m`).
2) Extend autopilot job schema to include `thinking_level`, plus optional transparency fields for per-job Codex overrides (`model`, `config_overrides`).
3) Update routing to assign `thinking_level` deterministically per job:
   - `scan`: `low`
   - `verify`: `low`
   - `implement`: `medium` by default; `high` for security/research-heavy or very large/cross-cutting tasks (deterministic heuristic).
4) In `runAutopilot`, resolve each job’s `thinking_level` into a model override from env, enrich `plan.jobs[]` with:
   - `model` (optional, resolved from env)
   - `config_overrides` (optional list of `-c/--config` overrides, e.g. `model=<id>`)
   Persist the enriched plan to `autopilot_plan.json` and run jobs using the enriched job objects.
5) Pass `job.config_overrides` into `runCodexExec({ configOverrides })` for each autopilot job.
6) Add/adjust unit tests (TDD) to assert:
   - deterministic `thinking_level` assignment in routing
   - env mapping → `configOverrides` wiring in autopilot orchestration (without requiring real `codex` calls)
7) Update docs to explain configuration and document the new plan fields.

## Concrete Steps

### Task 0: Confirm `codex exec` model override behavior (spike)

**Goal:** Verify the CLI mechanism we’re about to rely on is real/stable.

Run:
- `codex --help | rg -n -- "--config|--model"`
- `codex exec --help | rg -n -- "--config|--model"`

Optional runtime check (requires Codex auth/network):
- Run a tiny command twice with different overrides and inspect the `--json` stream for a model identifier.
  - `echo 'Return JSON {\"summary\":\"ok\",\"deliverables\":[],\"open_questions\":[],\"next_actions\":[]}' | codex exec --json -c model=<SOME_MODEL> -`
  - `echo 'Return JSON {\"summary\":\"ok\",\"deliverables\":[],\"open_questions\":[],\"next_actions\":[]}' | codex exec --json -c model=<ANOTHER_MODEL> -`
  - Search output for fields like `model` / `model_id`.

Expected:
- CLI accepts `-c model=<...>` without error (even if the model ID is invalid, error messaging should be clear).

### Task 1: Add thinking-level + model override fields to autopilot job schema

**Files:**
- Modify: `src/lib/delegation/types.ts`
- Test: `src/tests/delegation/types.test.ts` (only if needed)

**Step 1: Define schemas/types**

Add near the top (keep names consistent with existing style):

```ts
export const ThinkingLevelSchema = z.enum(["low", "medium", "high"]);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;
```

Extend `AutopilotJobSchema` with new fields:

```ts
thinking_level: ThinkingLevelSchema,
model: z.string().optional(),
config_overrides: z.array(z.string()).optional(),
```

Notes:
- `model` is the resolved Codex model ID (resolved from env; omit when not overriding).
- `config_overrides` is the list passed to `runCodexExec({ configOverrides })`; each entry must be in Codex CLI `--config/-c key=value` form (example: `model=<MODEL_ID>`).

**Step 2: Run typecheck**

Run: `npm run lint`
Expected: PASS

### Task 2: Decide thinking level in routing (pure, deterministic)

**Files:**
- Modify: `src/lib/delegation/route.ts`
- Modify: `src/tests/delegation/route.test.ts`

**Step 1: Write failing test**

Update `src/tests/delegation/route.test.ts` to assert thinking levels exist:

```ts
const jobs = routed.plan.jobs;
assert.equal(jobs[0]!.id, "scan");
assert.equal(jobs[0]!.thinking_level, "low");
assert.equal(jobs[1]!.id, "implement");
assert.ok(["medium", "high"].includes(jobs[1]!.thinking_level));
assert.equal(jobs[2]!.id, "verify");
assert.equal(jobs[2]!.thinking_level, "low");
```

Run: `npm test`
Expected: FAIL (until implementation exists).

**Step 2: Implement routing logic**

In `buildJobs(...)`, add `thinking_level` when constructing each job (this keeps routing deterministic and colocated with the existing job construction):
- `scan`: `"low"`
- `verify`: `"low"`
- `implement`: compute from task text using the existing helpers in this file (`countWorkCategories`, `countClauses`), so there’s no duplicate keyword logic.

Suggested minimal heuristic for `implement`:
- `high` if any of:
  - categories include `security` or `research`
  - categories.size >= 3
  - clauseCount >= 4
  - task length >= 400
- otherwise `medium`

Keep this heuristic in a small helper (to avoid repeating magic numbers).

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

### Task 3: Resolve model overrides from environment and enrich the plan

**Files:**
- Modify: `src/lib/delegation/autopilot.ts`
- (Optional) Create: `src/lib/delegation/thinkingModels.ts` (pure helper: `thinking_level` + env → `{ model?, config_overrides? }`)
- Add test: `src/tests/delegation/autopilot-models.test.ts` (new)

**Step 1: Write failing test (recommended)**

Create `src/tests/delegation/autopilot-models.test.ts` to verify:
- plan contains `thinking_level`
- plan contains `model` (when env vars are set)
- `runCodexExec` is called with `configOverrides` including `model=<...>`

Test approach:
- Use `runAutopilot(..., { env, deps: { discoverSkills, runCodexExec } })`.
- Provide env vars:
  - `CODEX_AUTOPILOT_MODEL_LOW=low-model`
  - `CODEX_AUTOPILOT_MODEL_HIGH=high-model`
- Stub `runCodexExec` to:
  - record `options.runDir` and `options.configOverrides`
  - write a valid `last_message.json` into `options.runDir` so the job completes
  - return `exit_code: 0`, `error: null`, and plausible artifact paths

Run: `npm test`
Expected: FAIL (until wiring exists).

**Step 2: Implement env resolution**

Implement a small resolver (inline or new file):

```ts
function resolveModelForThinkingLevel(level: "low" | "medium" | "high", env: NodeJS.ProcessEnv): string | null {
  const key =
    level === "low"
      ? "CODEX_AUTOPILOT_MODEL_LOW"
      : level === "medium"
        ? "CODEX_AUTOPILOT_MODEL_MEDIUM"
        : "CODEX_AUTOPILOT_MODEL_HIGH";
  const value = env[key]?.trim();
  return value ? value : null;
}
```

Then, in `runAutopilot(...)`, after `const routed = routeAutopilotTask(...)` and **before** writing `autopilot_plan.json`:
- compute `const env = options.env ?? process.env`
- map `routed.plan.jobs` into `jobsWithOverrides`:
  - `model`: resolved model (or omit)
  - `config_overrides`: if model exists, `["model=<model>"]` (no shell quoting needed; args are passed as an array)
- write the enriched plan to `planPath` (so artifacts reflect what actually ran)
- use the enriched plan for job execution and for returning `structuredContent.plan`

**Step 3: Pass overrides into `runCodexExec`**

In `runAutopilotJob(...)`, pass:

```ts
configOverrides: options.job.config_overrides,
```

to `options.deps.runCodexExec(...)`.

Also pass the same `env` used for `createRunDir`/`discoverSkills` into `runCodexExec` for consistency (thread `env` through `runAutopilot` → `runAutopilotJob` → `runCodexExec`, so `CODEX_HOME` and related env are coherent in tests and integrations):

```ts
env: options.env,
```

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

### Task 4: Docs update (user-facing)

**Files:**
- Modify: `docs/reference/tools.md`
- Modify: `docs/usage.md`
- Modify: `README.md`

**Step 1: Document new plan fields**

In `docs/reference/tools.md`, update the `delegate_autopilot` section:
- Document that each `plan.jobs[]` entry includes:
  - `thinking_level`: `"low" | "medium" | "high"`
  and may include:
  - `model`: string (optional; resolved model override)
  - `config_overrides`: string[] (optional; `-c/--config` overrides passed to `codex exec`)

**Step 2: Document configuration**

In `docs/usage.md`, add a section “Per-job model selection (autopilot)”:
- Mention env vars `CODEX_AUTOPILOT_MODEL_LOW|MEDIUM|HIGH`.
- Show how to set them when registering the MCP server:

```bash
codex mcp add codex-specialized-subagents \
  --env CODEX_AUTOPILOT_MODEL_LOW=low-model \
  --env CODEX_AUTOPILOT_MODEL_HIGH=high-model \
  -- node "$(pwd)/dist/cli.js"
```

Also document shell-based usage for `npm run dev`:
- `export CODEX_AUTOPILOT_MODEL_LOW=...` etc.

**Step 3: README mention**

In `README.md`, add a short note under “Usage” or “Development” pointing to `docs/usage.md` and mention that autopilot supports per-job thinking levels / model overrides via env vars.

### Task 5: Verification

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Optional (requires Codex auth/network):
- `RUN_CODEX_INTEGRATION_TESTS=1 npm test`

Manual smoke test (best-effort):
1) Register server with env vars set (`CODEX_AUTOPILOT_MODEL_LOW/HIGH`).
2) Trigger `delegate_autopilot` with a cross-cutting task so jobs include scan/implement/verify.
3) Inspect `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/autopilot_plan.json` and each `subruns/<job_id>/request.json` to confirm:
   - `thinking_level` is present per job
   - `config_overrides` includes `model=<...>` for jobs where an env mapping exists

## Validation and Acceptance

Acceptance criteria:
1) `delegate_autopilot` output plan includes a `thinking_level` for each job it plans to run.
2) If `CODEX_AUTOPILOT_MODEL_*` env vars are set, the plan includes `model` and/or `config_overrides` reflecting the resolved model per job.
3) Autopilot job execution passes the model override into `codex exec` (via `configOverrides`), and this decision is visible in artifacts (`autopilot_plan.json` and job `request.json`).
4) Unit test coverage demonstrates:
   - thinking-level assignment is deterministic
   - model override wiring is applied (without requiring real Codex calls)
5) `npm test`, `npm run lint`, `npm run build` all pass.

## Idempotence and Recovery

Idempotent:
- All `npm` scripts and tests are safe to re-run.
- Autopilot writes new run directories per invocation; reruns won’t overwrite prior artifacts.

Rollback:
- Revert the commits that add `thinking_level` and model override wiring.
- If the new env vars cause failures (invalid model IDs), unset them to return to default behavior.

## Artifacts and Notes

Store any spikes/transcripts under:
- `.agent/execplans/artifacts/2025-12-29_autopilot-thinking-level-per-job/`

Suggested artifacts:
- Output of `codex exec --help` snippet showing `--config/-c` + `--model/-m` support
- Sample `autopilot_plan.json` and `subruns/*/request.json` (redacted if needed)

Local CLI evidence (2025-12-29):
- `codex exec --help` includes:
  - `-c, --config <key=value>` (parsed as TOML; fall back to raw literal string)
  - `-m, --model <MODEL>`
- `codex mcp add --help` includes:
  - `--env <KEY=VALUE>` (for stdio servers)

## Interfaces and Dependencies

Public-ish interface changes:
- `delegate_autopilot` tool output (`structuredContent.plan.jobs[]`) gains:
  - `thinking_level` (always present on each planned job)
  - `model` (optional)
  - `config_overrides` (optional)

Execution dependency:
- Codex CLI must accept `-c/--config model=...` overrides (documented in `codex exec --help`).

Environment variables (server process):
- `CODEX_AUTOPILOT_MODEL_LOW`
- `CODEX_AUTOPILOT_MODEL_MEDIUM`
- `CODEX_AUTOPILOT_MODEL_HIGH`
