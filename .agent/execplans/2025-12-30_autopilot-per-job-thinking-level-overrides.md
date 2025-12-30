# Autopilot per-job thinking-level (reasoning effort) overrides

> **Status:** Shipped (2025-12-30). Optional follow-ups remain (see “2025-12-30 RCA addendum”).
>
> **Reopened:** 2025-12-30 to implement RCA remediation items (2) and (3) from this document.

**Parent macro ExecPlan:** `.agent/execplans/archive/2025-12-29_autonomous-subagent-delegation.md` (shipped `delegate_*` tools + artifact-first orchestration).

**Tech Stack:** Node.js >= 20, TypeScript (NodeNext ESM), `@modelcontextprotocol/sdk`, `zod/v4`, `node:test`.

**Research artifacts (gitignored by default):**
- `.agent/execplans/archive/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/external_research.md`
- `.agent/execplans/archive/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/repo_scan.md`
- `.agent/execplans/archive/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/codex-headless-model-override-guide.md`

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Before 2025-12-30, `delegate_autopilot` could map its internal job `thinking_level` (`low | medium | high`) to a **model-name override** via env vars `CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}` (it injected `-c model=...` into each `codex exec` sub-run).

In Codex, the practical “model” used for a run is a combination of:
- **model name** (`model`)
- **thinking level / reasoning effort** (`model_reasoning_effort`)

For task complexity, the knob we should vary per job is **thinking level / reasoning effort**, not model name.

End state:
- Operators can set server-process env vars to map autopilot job `thinking_level` → Codex `model_reasoning_effort` by injecting `-c model_reasoning_effort="..."` into each `codex exec` job.
- Documentation becomes unambiguous about:
  - what autopilot `thinking_level` means (internal label), and
  - how Codex is configured (model name vs reasoning effort), and
  - what env vars this MCP server actually supports.

Compatibility goal:
- Keep existing `CODEX_AUTOPILOT_MODEL_*` behavior working (model-name override) but document it as optional/advanced.
- Introduce new `CODEX_AUTOPILOT_REASONING_EFFORT_*` env vars as the primary per-job complexity control.

## Progress

- [x] (2025-12-30 07:18) Repo scan of current env-var overrides + docs; capture pointers in `repo_scan.md`.
- [x] (2025-12-30 07:18) External research (OpenAI Codex config + MCP SDK patterns); capture notes in `external_research.md`.
- [x] (2025-12-30 07:18) Rewrite this ExecPlan to be fully grounded + aligned with parent macro ExecPlan.
- [x] (2025-12-30 08:02) Pre-flight scan (pre-change): confirm per-job overrides only support `CODEX_AUTOPILOT_MODEL_*` and emit unquoted `config_overrides: ["model=<id>"]`.
- [x] (2025-12-30 08:05) Implement per-job `model_reasoning_effort` overrides in `src/lib/delegation/autopilot.ts`.
- [x] (2025-12-30 08:07) Update unit tests for new env vars/overrides.
- [x] (2025-12-30 08:09) Update docs (`docs/usage.md`, `README.md`, `docs/reference/tools.md`, `docs/troubleshooting.md`).
- [x] (2025-12-30 08:07) Verify: `npm test`.
- [x] (2025-12-30 08:09) Verify: `npm run lint`.
- [x] (2025-12-30 08:10) Verify: `npm run build`.
- [x] (2025-12-30 08:14) Archive ExecPlan + artifacts to `.agent/execplans/archive/`.
- [x] (2025-12-30 10:08) RCA addendum: investigate “reasoning effort overrides not applied” reports from recent delegated runs; capture root cause + remediation plan.
- [x] (2025-12-30 10:26) Grounding refresh: update `external_research.md` + `repo_scan.md` with post-ship state and confirm archive paths are correct.
- [x] (2025-12-30 10:49) Re-verify on current HEAD: `npm test`, `npm run lint`, `npm run build` (fresh evidence for this execution pass).
- [ ] (2025-12-30 10:49) Re-archive this ExecPlan + artifacts to `.agent/execplans/archive/` (do this after RCA follow-ups are implemented).
- [x] (2025-12-30 10:54) Implement RCA remediation #2 (code + unit tests): server-side default reasoning effort for `delegate_run` / `delegate_resume` via `CODEX_DELEGATE_REASONING_EFFORT`.
- [x] (2025-12-30 10:57) Implement RCA remediation #2 (docs): document `CODEX_DELEGATE_REASONING_EFFORT` in `README.md` + `docs/usage.md` + `docs/reference/tools.md` (+ troubleshooting as needed).
- [x] (2025-12-30 11:00) Verify (post-change): `npm test` (30 pass, 1 skipped), `npm run lint`, `npm run build`.
- [x] (2025-12-30 10:59) Implement RCA remediation #3: tighten parent-agent (`delegation-autopilot`) guidance re: when to use `delegate_autopilot` vs `delegate_run`.

## Surprises & Discoveries

- Observation (pre-2025-12-30): Autopilot’s per-job override mechanism only affected model name (`-c model=...`), not reasoning effort.
  Evidence: `repo_scan.md` (pre-change behavior), `src/lib/delegation/autopilot.ts` (current code path).

- Observation: Codex CLI `-c/--config key=value` parses the `value` as TOML; for string overrides, use a quoted string literal (example: `model_reasoning_effort="high"`).
  Implementation note: this repo standardizes on `tomlString(value)` (currently `JSON.stringify(value)`) when emitting string overrides.
  Evidence: `external_research.md`, `src/lib/codex/configOverrides.ts`.

- Observation (pre-2025-12-30): Unit tests expected unquoted model overrides (e.g. `model=low-model`). We updated them to assert quoted string literals (e.g. `model="low-model"`).
  Evidence: `src/tests/delegation/autopilot-models.test.ts`.

- Observation: OpenAI Codex docs explicitly define `model_reasoning_effort` as a first-class config key with allowed values `minimal | low | medium | high | xhigh` (and note `xhigh` is model-dependent).
  Evidence: `external_research.md` (OpenAI “Codex configuration reference”).

- Observation: Codex environments may apply “managed config” that can supersede CLI `--config/-c` overrides for initial values.
  Implication: per-job overrides may not take effect everywhere; we should document this caveat.
  Evidence: `external_research.md` (OpenAI managed config guidance).

- Observation: A “missing reasoning effort override” report was for a `delegate_run` invocation, not `delegate_autopilot`, so autopilot env mapping was not in play.
  Evidence: In the relevant run directory, `<run_dir>/request.json` has `"tool": "delegate_run"`.

- Observation: `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` only affects `delegate_autopilot`’s internal plan builder; it is not consulted by `delegate_run` / `delegate_resume`.
  Impact: if the parent agent calls `delegate_run` directly (instead of `delegate_autopilot`), autopilot per-job thinking-level mapping cannot apply and `codex exec` runs with no `model_reasoning_effort` override unless explicitly requested.
  Evidence: In the relevant run directory, `<run_dir>/codex_exec.json` shows `"config_overrides": []`.

- Observation: For `delegate_autopilot`, the parent run `<run_dir>/request.json` captures the *MCP tool input* only, but each subrun `<run_dir>/subruns/<job_id>/request.json` includes the resolved `job` object (including `config_overrides`).
  Debug tip: verify effective overrides via:
  - `delegate_autopilot`: `<run_dir>/autopilot_plan.json`, `<run_dir>/subruns/<job_id>/request.json`, and each subrun’s `<run_dir>/subruns/<job_id>/codex_exec.json`
  - `delegate_run`/`delegate_resume`: `<run_dir>/codex_exec.json`

- Observation (2025-12-30): This ExecPlan is marked shipped and references archive artifact paths, but currently lives under `.agent/execplans/` and its artifacts live under `.agent/execplans/artifacts/`.
  Implication: restore the “completed plans live in archive/” invariant by re-archiving the plan and artifacts via `scripts/archive_execplan.py`.
  Evidence: `ls -1 .agent/execplans` and `ls -1 .agent/execplans/artifacts`.

## Decision Log

- Decision: Introduce env vars `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` and map them to per-job `-c model_reasoning_effort="..."` overrides.
  Rationale: Task complexity should adjust reasoning effort; model name should remain a global/default config concern.
  Date/Author: 2025-12-30 / agent

- Decision: Keep `CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}` support (model-name override), but reposition it in docs as optional/advanced (not the primary “complexity scaling” mechanism).
  Rationale: Avoid breaking existing users while fixing the confusing documentation.
  Date/Author: 2025-12-30 / agent

- Decision: Emit string-valued config overrides as quoted string literals via `tomlString(...)` (currently `JSON.stringify(...)`), e.g. `model_reasoning_effort="high"`.
  Rationale: Matches Codex CLI behavior (`-c/--config` values are parsed as TOML) and avoids relying on the raw-literal fallback for unquoted strings.
  Date/Author: 2025-12-30 / agent

- Decision: Do not add new top-level schema fields for reasoning effort (keep using `config_overrides`).
  Rationale: `config_overrides` is already in `AutopilotJobSchema` and is the canonical mechanism for Codex-side settings; adding a dedicated field would be redundant and require broader schema/doc coordination.
  Date/Author: 2025-12-30 / agent

- Decision: Add a remediation plan to address “expectation mismatch” between `delegate_autopilot` (env-mapped per-job overrides) vs `delegate_run` (explicit overrides only), and improve observability so failures are diagnosable from artifacts alone.
  Rationale: Recent failures were due to tool selection (bypassing autopilot), not a bug in the autopilot plan builder.
  Date/Author: 2025-12-30 / agent

- Decision (2025-12-30): Keep this shipped ExecPlan archived (not active) and keep any remaining follow-ups in a separate ExecPlan if/when we decide to pursue them.
  Rationale: Keeps “active” plans actionable and prevents stale shipped plans from drifting out of sync with their referenced artifact paths.
  Date/Author: 2025-12-30 / agent

- Decision (2025-12-30): This ExecPlan was intentionally reopened to execute the RCA remediation items; keep it active until those follow-ups are complete, then re-archive it.
  Rationale: Preserves the original “shipped” record while allowing the follow-up work to be tracked and executed in a single place (per user request).
  Date/Author: 2025-12-30 / agent

## Outcomes & Retrospective

- Shipped per-job reasoning-effort overrides for `delegate_autopilot` via `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` → `config_overrides: ['model_reasoning_effort="..."']`.
- Kept compatibility with existing per-job model-name overrides (`CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}`), now emitted as quoted string literals (`model="..."`).
- Updated unit tests + docs to make “thinking_level” vs Codex config unambiguous.
- Verified locally: `npm test`, `npm run lint`, `npm run build`.

### 2025-12-30 RCA addendum (post-archive)

Reported symptom:
- “Recent delegated runs still didn’t apply thinking effort overrides; request.json doesn’t mention reasoning effort.”

Root cause:
- The referenced run was `delegate_run`, not `delegate_autopilot`, so autopilot per-job env mapping was never in play.
- The server did not receive any explicit `reasoning_effort` / `config_overrides` input for that `delegate_run`, so it correctly produced a `codex exec` command with no `-c model_reasoning_effort="..."` override.

Remediation plan (follow-up work):

1) Documentation + debugging guidance (done)
   - Scope:
     - Autopilot env vars apply to `delegate_autopilot` jobs only.
     - `delegate_run`/`delegate_resume` require explicit `reasoning_effort` / `config_overrides` (unless we add a server default).
   - Debugging:
     - `delegate_autopilot`: inspect `autopilot_plan.json`, subrun `request.json`, and subrun `codex_exec.json`.
     - `delegate_run`/`delegate_resume`: inspect `codex_exec.json`.
   - Evidence: `docs/usage.md`, `docs/reference/tools.md`, `docs/troubleshooting.md`, `README.md`.

2) Optional: add server-side defaults for `delegate_run` / `delegate_resume`
   - Introduce a new env var for the MCP server process, e.g. `CODEX_DELEGATE_REASONING_EFFORT` (single value like `low|medium|high|xhigh`).
   - Behavior: if a `delegate_run`/`delegate_resume` request does **not** specify `reasoning_effort` and does **not** include an explicit `model_reasoning_effort=...` in `config_overrides`, inject `-c model_reasoning_effort="..."` from the env default.
   - Add unit tests that assert `codex exec` argv includes `-c model_reasoning_effort="..."` when defaults apply.

3) Optional: tighten the parent-agent (skill) behavior
   - Update the `delegation-autopilot` skill guidance to recommend `delegate_autopilot` for research-only multi-step tasks too (not only code+tests+docs) when you want consistent per-job thinking-level behavior.
   - Alternatively, have the parent pass `reasoning_effort` explicitly when it chooses `delegate_run` for “research” tasks.

## Context and Orientation

Key concepts:

- **Autopilot job `thinking_level`**: an internal, coarse complexity label (`low | medium | high`) produced by `src/lib/delegation/route.ts`. It is *not* the Codex reasoning effort string.
- **Codex model name**: configured via Codex CLI (`--model/-m` or `-c model="..."`).
- **Codex thinking level / reasoning effort**: configured via Codex CLI config key `model_reasoning_effort` (documented values: `minimal | low | medium | high | xhigh`).

Important nuance:
- Autopilot `thinking_level` and Codex `model_reasoning_effort` are different namespaces, even though they share the words “low/medium/high”.
- We will map between them **only when env vars are set**, so the default remains “use whatever the user’s Codex config already specifies”.

Repo implementation touchpoints (current behavior):
- `src/lib/delegation/route.ts`: assigns job `thinking_level`.
- `src/lib/delegation/types.ts`: schemas for `thinking_level`, `model`, `config_overrides`.
- `src/lib/delegation/autopilot.ts`: builds the autopilot `plan.jobs` and injects env-driven `config_overrides`.
- `src/lib/codex/configOverrides.ts`: shared helpers for emitting quoted string overrides (`tomlString`) and building overrides (`buildCodexConfigOverrides`) for `delegate_run`/`delegate_resume`.
- `src/lib/codex/runCodexExec.ts`: forwards each override string as `codex exec -c <key=value>`.
- `src/server.ts`: `delegate_run`/`delegate_resume` parse `reasoning_effort`/`config_overrides` and pass merged overrides into `runCodexExec`.
- `src/tests/delegation/autopilot-models.test.ts`: unit tests for per-job model + reasoning-effort env mapping.
- `src/tests/codex/configOverrides.test.ts`: unit tests for override building/ordering.

Docs updated:
- `docs/usage.md`: explains `thinking_level` and documents `CODEX_AUTOPILOT_REASONING_EFFORT_*` and manual `reasoning_effort` inputs.
- `README.md`: uses `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` as the recommended per-job control, and notes legacy `CODEX_AUTOPILOT_MODEL_*`.
- `docs/reference/tools.md`: clarifies `thinking_level` vs Codex config, and documents `reasoning_effort` and `config_overrides` plumbing.
- `docs/troubleshooting.md`: includes example config/env + timeout guidance.

Grounding artifacts:
- Current code pointers + existing behaviors: `.agent/execplans/archive/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/repo_scan.md`
- External references (OpenAI + MCP SDK): `.agent/execplans/archive/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/external_research.md`

## Plan of Work (Completed)

This feature is shipped. The “remaining work” items are optional follow-ups listed in the **2025-12-30 RCA addendum** above.

### Milestone A — Add per-job reasoning-effort override support

Outcome:
- Setting `CODEX_AUTOPILOT_REASONING_EFFORT_<LEVEL>` on the MCP server process causes the corresponding autopilot jobs to include `config_overrides` entries like `model_reasoning_effort="high"`, and the sub-run `codex exec` receives them.

### Milestone B — Update unit tests

Outcome:
- Unit tests cover reasoning-effort overrides (and still cover model-name overrides for compatibility).

### Milestone C — Update docs to remove ambiguity

Outcome:
- `docs/usage.md` and `README.md` clearly explain that job complexity should map to `model_reasoning_effort`, not model name, and document the env vars correctly.

### Milestone D — Validate

Outcome:
- `npm test`, `npm run lint`, `npm run build` pass.

## Concrete Steps (Completed)

### 0) Pre-flight repo scan (quick sanity)

From repo root:

```bash
rg -n "CODEX_AUTOPILOT_MODEL_" -S src docs README.md
rg -n "config_overrides|configOverrides" -S src
rg -n "thinking_level" -S src/lib/delegation
```

### 1) Implement reasoning-effort overrides in autopilot plan builder

File: `src/lib/delegation/autopilot.ts`

Current code (to extend): the `plan = { jobs: routed.plan.jobs.map(...) }` mapping that resolves `CODEX_AUTOPILOT_MODEL_*`.

Implementation details:

1) Add env-var key mapping for reasoning effort:
   - `CODEX_AUTOPILOT_REASONING_EFFORT_LOW`
   - `CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM`
   - `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH`

2) For each job in `routed.plan.jobs.map(...)`:
   - Start with `const config_overrides: string[] = [];`
   - If `CODEX_AUTOPILOT_MODEL_<LEVEL>` is set (non-empty after `trim()`):
     - set `model` on the job (current behavior)
     - append `model="<MODEL_ID>"` to `config_overrides`
   - If `CODEX_AUTOPILOT_REASONING_EFFORT_<LEVEL>` is set (non-empty after `trim()`):
     - append `model_reasoning_effort="<EFFORT>"` to `config_overrides`
     - (Do not add any new schema field; rely on `config_overrides`.)

3) TOML quoting:
   - Implement a small helper that produces a TOML basic string literal (double-quoted).
   - Pragmatic approach: `JSON.stringify(value)` yields a quoted/escaped string that should be TOML-compatible for simple values.

4) Keep override ordering stable:
   - If both overrides are present, keep the array order deterministic (e.g., `model="..."` then `model_reasoning_effort="..."`).

5) If `config_overrides.length === 0`, leave `config_overrides` undefined on the job (preserves today’s behavior).

### 2) Update/extend unit tests

File: `src/tests/delegation/autopilot-models.test.ts`

Approach:

- Add a new test case:
  - Set `CODEX_AUTOPILOT_REASONING_EFFORT_LOW=low` and `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=xhigh` in the provided `env`.
  - Assert:
    - `scan` and `verify` jobs include `config_overrides: ['model_reasoning_effort="low"']`
    - `implement` includes `config_overrides: ['model_reasoning_effort="xhigh"']`
    - The mocked `runCodexExec` receives matching `configOverrides` for each job.

- Update the existing model-name test expectations if the implementation changes quoting (e.g., `model="low-model"` instead of `model=low-model`).

Keep test style consistent with repo conventions:
- `node:test` + `assert/strict`
- `withTmpDir(...)` helper pattern

### 3) Update documentation (remove ambiguity)

Files:
- `docs/usage.md`
- `README.md`
- `docs/reference/tools.md`

Edits:

1) `docs/usage.md`:
   - Rename the section from “Per-job model selection (autopilot)” to something like:
     - “Per-job thinking level (reasoning effort) overrides (autopilot)”
   - Explain clearly:
     - Autopilot job `thinking_level` (`low|medium|high`) is an internal label.
     - Codex reasoning effort is `model_reasoning_effort` with values `minimal|low|medium|high|xhigh` (per OpenAI docs).
     - This server maps `thinking_level` → `model_reasoning_effort` **only when** env vars are set.
   - Document env vars (server process):
     - `CODEX_AUTOPILOT_REASONING_EFFORT_LOW`
     - `CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM`
     - `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH`
   - Provide examples for:
     - `codex mcp add ... --env CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=xhigh ...`
     - local dev `export CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=xhigh`
   - Optional/advanced: document existing model-name overrides:
     - `CODEX_AUTOPILOT_MODEL_LOW|MEDIUM|HIGH`
     - clarify that these override model *name*, not thinking level
   - Add a short caveat about managed config possibly superseding CLI `-c` overrides in some environments (link/reference `external_research.md`).

2) `README.md`:
   - Replace the single-line mention of `CODEX_AUTOPILOT_MODEL_LOW|MEDIUM|HIGH` with the reasoning-effort env vars.
   - Keep a pointer to `docs/usage.md` for full details; optionally mention the legacy model-name override exists.

3) `docs/reference/tools.md`:
   - In the `delegate_autopilot` output section, clarify:
     - `thinking_level` is autopilot’s internal label (`low|medium|high`).
     - Codex-side settings are passed via `config_overrides` (strings forwarded to `codex exec -c`).
     - Mention `model_reasoning_effort="..."` as the canonical way to control thinking level per job.

### 4) Verify

From repo root:

```bash
npm test
npm run lint
npm run build
```

## Validation and Acceptance

Acceptance criteria:

- With `CODEX_AUTOPILOT_REASONING_EFFORT_LOW=low` set on the MCP server process, jobs with `thinking_level: "low"` include `config_overrides` containing `model_reasoning_effort="low"`, and `runCodexExec` receives that override.
- With `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=xhigh`, the `implement` job (when routed to `thinking_level: "high"`) includes `model_reasoning_effort="xhigh"`.
- Whitespace/empty env var values are treated as unset (no override emitted).
- Docs clearly state that task complexity should scale via `model_reasoning_effort`, not model name, and document the env vars accurately.
- `npm test`, `npm run lint`, and `npm run build` succeed.

## Idempotence and Recovery

Idempotence:
- Code changes are config-driven; re-running tests/build is safe.
- Env var changes are runtime-only.

Recovery:
- Unset `CODEX_AUTOPILOT_REASONING_EFFORT_*` to revert to whatever `model_reasoning_effort` is configured in the user’s Codex config.
- If needed, revert the commit(s) that introduce the new env vars and docs.

## Artifacts and Notes

- External research summary: `.agent/execplans/archive/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/external_research.md`
- Repo scan grounding notes: `.agent/execplans/archive/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/repo_scan.md`
- (2025-12-30 08:07) Local verification: `npm test` (23 pass, 1 skipped).
- (2025-12-30 08:09) Local verification: `npm run lint`.
- (2025-12-30 08:10) Local verification: `npm run build`.
- (2025-12-30 08:12) Added unit test for blank/whitespace overrides; re-verified: `npm test` (24 pass, 1 skipped), `npm run lint`, `npm run build`.
- (2025-12-30 10:49) Fresh verification logs (this execution pass):
  - `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/verification_2025-12-30_1049_npm-test.log`
  - `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/verification_2025-12-30_1049_npm-run-lint.log`
  - `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/verification_2025-12-30_1049_npm-run-build.log`
- (2025-12-30 11:00) Post-change verification logs (after RCA remediation #2/#3):
  - `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/verification_2025-12-30_1100_npm-test.log`
  - `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/verification_2025-12-30_1100_npm-run-lint.log`
  - `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/verification_2025-12-30_1100_npm-run-build.log`

## Interfaces and Dependencies

New env vars (server process):
- `CODEX_AUTOPILOT_REASONING_EFFORT_LOW`
- `CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM`
- `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH`
- `CODEX_DELEGATE_REASONING_EFFORT` (default reasoning effort for `delegate_run` / `delegate_resume`)

Existing env vars (compat / optional):
- `CODEX_AUTOPILOT_MODEL_LOW`
- `CODEX_AUTOPILOT_MODEL_MEDIUM`
- `CODEX_AUTOPILOT_MODEL_HIGH`

Behavior:
- For each `delegate_autopilot` job, when the corresponding reasoning-effort env var is set, the server passes `-c model_reasoning_effort="..."` into the job’s `codex exec`.
- Model-name overrides remain possible via `CODEX_AUTOPILOT_MODEL_*` (`-c model="..."`), but they are not the primary “complexity scaling” mechanism.
