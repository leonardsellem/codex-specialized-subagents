# Autopilot thinking-level per job Implementation Plan

> **Recommended execution:** Use `executing-plans` to implement this plan task-by-task (batch + checkpoints).

**Goal:** When `delegate_autopilot` decides to delegate, it assigns a “thinking level” to each sub-agent job (scan/implement/verify) and uses that level to run different Codex models per job (via `codex exec` parameters).

**Architecture:** Keep routing pure and deterministic (based on job type + task complexity), but resolve actual model IDs from environment variables at runtime so the server is safe by default and configurable per user. Persist the decision in `autopilot_plan.json` and in each job’s `request.json`, and pass the resolved model into the `codex exec` invocation.

**Tech Stack:** Node.js (ESM) + TypeScript + `@modelcontextprotocol/sdk` + `zod/v4` + `node:test`.

---

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Today, `delegate_autopilot` spawns multiple sub-agents (jobs like “scan”, “implement”, “verify”) but they all inherit the same Codex model configuration. This wastes time/cost on “cheap” phases (scan/verify) and can undershoot quality on “hard” phases (implementation).

After this change:
- The autopilot plan explicitly includes a `thinking_level` for each job (e.g., `low` for scan, `high` for implement).
- The server resolves each job’s `thinking_level` into a model override (when configured) and passes it to `codex exec` so jobs can run different models.
- The decision is visible in artifacts (`autopilot_plan.json`, job `request.json`) to reduce debugging friction.

## Progress

- [ ] (2025-12-29 00:00) Confirm how to override model per `codex exec`.
- [ ] (2025-12-29 00:00) Add “thinking level” + model override fields to autopilot job types.
- [ ] (2025-12-29 00:00) Implement deterministic thinking-level routing in `routeAutopilotTask`.
- [ ] (2025-12-29 00:00) Resolve models from env and pass overrides into `runCodexExec` for autopilot jobs.
- [ ] (2025-12-29 00:00) Add unit tests (TDD) and update docs.
- [ ] (2025-12-29 00:00) Verify `npm test`, `npm run lint`, `npm run build`; optionally run integration tests.

## Surprises & Discoveries

- Observation: (none yet)

## Decision Log

- Decision: Represent “thinking level” as `low | medium | high` on each autopilot job and keep it **optional** for backwards compatibility.
  Rationale: Easy to reason about, stable across providers, and won’t break consumers of existing artifacts.
  Date/Author: 2025-12-29 / agent

- Decision: Use `codex exec` config overrides (`-c model="..."`) rather than adding a new `runCodexExec` API surface immediately.
  Rationale: `src/lib/codex/runCodexExec.ts` already supports `configOverrides`, and Codex CLI explicitly documents `-c model="..."`.
  Date/Author: 2025-12-29 / agent

- Decision: Resolve model IDs from environment variables so default behavior remains unchanged unless configured.
  Rationale: Avoid hard-coding model IDs (provider-specific and unstable) while still enabling per-job model selection.
  Date/Author: 2025-12-29 / agent

## Outcomes & Retrospective

(fill in after milestone completion)

## Context and Orientation

Key files:
- `src/lib/delegation/types.ts`: Zod schemas/types for autopilot input/output and job shapes.
- `src/lib/delegation/route.ts`: Heuristic routing that decides whether to delegate and constructs the `plan.jobs`.
- `src/lib/delegation/autopilot.ts`: Writes parent artifacts (`autopilot_*.json`) and executes jobs by calling `runCodexExec`.
- `src/lib/codex/runCodexExec.ts`: Spawns `codex exec` and supports `configOverrides` (passed as `-c key=value`).

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
- **Model override:** a concrete Codex model identifier (string) passed to `codex exec` to influence reasoning/latency/cost.

Configuration (proposed):
- `CODEX_AUTOPILOT_MODEL_LOW`: model ID to use for `thinking_level=low`
- `CODEX_AUTOPILOT_MODEL_MEDIUM`: model ID to use for `thinking_level=medium`
- `CODEX_AUTOPILOT_MODEL_HIGH`: model ID to use for `thinking_level=high`

If a given env var is unset/empty, the server should **not** override the model for that job (inherit default Codex config).

## Plan of Work

1) Confirm the correct mechanism to force a model for `codex exec` (baseline: `-c model="..."`).
2) Extend autopilot job schema to include `thinking_level`, and (optionally) `model` + `config_overrides` for transparency.
3) Update routing to assign `thinking_level` deterministically per job:
   - `scan`: `low`
   - `verify`: `low`
   - `implement`: based on task complexity (`high` for cross-cutting/security/research; otherwise `medium`)
4) In `runAutopilot`, resolve each job’s `thinking_level` into a model override from env and:
   - write the enriched plan to `autopilot_plan.json` (so the plan “delivered” includes thinking levels)
   - pass `config_overrides` into `runCodexExec` when running each job
5) Add/adjust tests using dependency injection (`runAutopilot(..., { deps: { runCodexExec } })`) to assert the chosen overrides are applied.
6) Update docs to explain configuration and to document the new plan fields.

## Concrete Steps

### Task 0: Confirm `codex exec` model override behavior (spike)

**Goal:** Verify the CLI mechanism we’re about to rely on is real/stable.

Run:
- `codex exec --help | rg -n \"--model|model=\\\"\"`

Optional runtime check (requires Codex auth/network):
- Run a tiny command twice with different overrides and inspect the `--json` stream for a model identifier.
  - `echo 'Return JSON {\"summary\":\"ok\",\"deliverables\":[],\"open_questions\":[],\"next_actions\":[]}' | codex exec --json -c model=\"<SOME_MODEL>\" -`
  - `echo 'Return JSON {\"summary\":\"ok\",\"deliverables\":[],\"open_questions\":[],\"next_actions\":[]}' | codex exec --json -c model=\"<ANOTHER_MODEL>\" -`
  - Search output for fields like `model` / `model_id`.

Expected:
- CLI accepts `-c model="..."` without error (even if the model ID is invalid, error messaging should be clear).

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

Extend `AutopilotJobSchema` with new optional fields:

```ts
thinking_level: ThinkingLevelSchema.optional().default("medium"),
model: z.string().optional(),
config_overrides: z.array(z.string()).optional(),
```

Notes:
- Keep everything **optional** so old artifacts/clients don’t break.
- `config_overrides` should be a list of Codex CLI `-c` overrides (e.g., `model="o3"`).

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

In `buildJobs(...)`, add `thinking_level` when constructing each job:
- `scan`: `"low"`
- `verify`: `"low"`
- `implement`: compute from the same signals already available (task length, clause count, categories).

Suggested minimal heuristic for `implement`:
- `high` if any of:
  - category includes `security` or `research`
  - task length >= 300
  - categories.size >= 3
- otherwise `medium`

Keep this heuristic in a small helper (to avoid repeating magic numbers).

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

### Task 3: Resolve model overrides from environment and enrich the plan

**Files:**
- Modify: `src/lib/delegation/autopilot.ts`
- (Optional) Create: `src/lib/delegation/thinkingModels.ts`
- Add test: `src/tests/delegation/autopilot-models.test.ts` (new)

**Step 1: Write failing test (recommended)**

Create `src/tests/delegation/autopilot-models.test.ts` to verify:
- plan contains `thinking_level`
- plan contains `model` (when env vars are set)
- `runCodexExec` is called with `configOverrides` including `model="..."`

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
- map `routed.plan.jobs` into `jobsWithModels`:
  - `model`: resolved model (or omit)
  - `config_overrides`: if model exists, `['model="<model>"']` (ensure TOML quoting)
- write the enriched plan to `planPath`
- use the enriched plan for job execution and for returning `structuredContent.plan`

**Step 3: Pass overrides into `runCodexExec`**

In `runAutopilotJob(...)`, pass:

```ts
configOverrides: options.job.config_overrides,
```

to `options.deps.runCodexExec(...)`.

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
- Document that each `plan.jobs[]` entry may include:
  - `thinking_level`: `"low" | "medium" | "high"`
  - `model`: string (optional)
  - `config_overrides`: string[] (optional)

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
   - `config_overrides` includes `model="..."` for jobs where an env mapping exists

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
- Output of `codex exec --help` snippet showing `-c model="..."` support
- Sample `autopilot_plan.json` and `subruns/*/request.json` (redacted if needed)

## Interfaces and Dependencies

Public-ish interface changes:
- `delegate_autopilot` tool output (`structuredContent.plan.jobs[]`) gains optional fields:
  - `thinking_level`
  - `model`
  - `config_overrides`

Execution dependency:
- Codex CLI must accept `-c model="..."` overrides (documented in `codex exec --help`).

Environment variables (server process):
- `CODEX_AUTOPILOT_MODEL_LOW`
- `CODEX_AUTOPILOT_MODEL_MEDIUM`
- `CODEX_AUTOPILOT_MODEL_HIGH`

