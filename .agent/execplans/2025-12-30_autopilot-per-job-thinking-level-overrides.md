# Autopilot per-job thinking-level (reasoning effort) overrides

**Parent macro ExecPlan:** `.agent/execplans/archive/2025-12-29_autonomous-subagent-delegation.md` (shipped `delegate_*` tools + artifact-first orchestration).

**Research artifacts (gitignored by default):**
- `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/external_research.md`
- `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/repo_scan.md`

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Today, `delegate_autopilot` can map its internal job `thinking_level` (`low | medium | high`) to a **model-name override** via env vars `CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}` (it injects `-c model=...` into each `codex exec` sub-run).

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
- [x] (2025-12-30 08:02) Pre-flight scan: confirm current per-job overrides only support `CODEX_AUTOPILOT_MODEL_*` and emit `config_overrides: ["model=<id>"]` (unquoted today).
- [x] (2025-12-30 08:05) Implement per-job `model_reasoning_effort` overrides in `src/lib/delegation/autopilot.ts`.
- [x] (2025-12-30 08:07) Update unit tests for new env vars/overrides.
- [x] (2025-12-30 08:09) Update docs (`docs/usage.md`, `README.md`, `docs/reference/tools.md`).
- [x] (2025-12-30 08:07) Verify: `npm test`.
- [x] (2025-12-30 08:09) Verify: `npm run lint`.
- [ ] (2025-12-30 07:18) Verify: `npm run build`.

## Surprises & Discoveries

- Observation: Autopilot’s current “per-job model override” is a model-name override only (`-c model=...`), not a thinking-level override.
  Evidence: `src/lib/delegation/autopilot.ts` (`CODEX_AUTOPILOT_MODEL_*` → `config_overrides: ["model=..."]`). See `repo_scan.md`.

- Observation: Existing unit tests currently lock in unquoted model overrides (e.g. `model=low-model`), so switching to TOML-quoted strings will require updating expectations.
  Evidence: `src/tests/delegation/autopilot-models.test.ts`.

- Observation: OpenAI Codex docs explicitly define `model_reasoning_effort` as a first-class config key with allowed values `minimal | low | medium | high | xhigh` (and note `xhigh` is model-dependent).
  Evidence: `external_research.md` (OpenAI “Codex configuration reference”).

- Observation: Codex environments may apply “managed config” that can supersede CLI `--config/-c` overrides for initial values.
  Implication: per-job overrides may not take effect everywhere; we should document this caveat.
  Evidence: `external_research.md` (OpenAI managed config guidance).

## Decision Log

- Decision: Introduce env vars `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` and map them to per-job `-c model_reasoning_effort="..."` overrides.
  Rationale: Task complexity should adjust reasoning effort; model name should remain a global/default config concern.
  Date/Author: 2025-12-30 / agent

- Decision: Keep `CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}` support (model-name override), but reposition it in docs as optional/advanced (not the primary “complexity scaling” mechanism).
  Rationale: Avoid breaking existing users while fixing the confusing documentation.
  Date/Author: 2025-12-30 / agent

- Decision: Emit string-valued config overrides as TOML-quoted strings (e.g., `model_reasoning_effort="high"`).
  Rationale: Matches OpenAI docs/examples and avoids relying on the CLI’s “TOML parse failed → treat as raw string” fallback.
  Date/Author: 2025-12-30 / agent

- Decision: Do not add new top-level schema fields for reasoning effort (keep using `config_overrides`).
  Rationale: `config_overrides` is already in `AutopilotJobSchema` and is the canonical mechanism for Codex-side settings; adding a dedicated field would be redundant and require broader schema/doc coordination.
  Date/Author: 2025-12-30 / agent

## Outcomes & Retrospective

To fill after implementation ships.

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
- `src/lib/delegation/autopilot.ts`: builds the autopilot `plan.jobs` and injects env-driven `config_overrides`.
- `src/lib/codex/runCodexExec.ts`: forwards each override string as `codex exec -c <key=value>`.
- `src/tests/delegation/autopilot-models.test.ts`: unit test that currently locks in the model-name override behavior.

Docs to update:
- `docs/usage.md`: currently describes per-job “model override” and implies this is how `thinking_level` is resolved.
- `README.md`: repeats the “override model per job” claim.
- `docs/reference/tools.md`: should clarify that `thinking_level` is an autopilot label and that Codex-side overrides happen via `config_overrides`.

Grounding artifacts:
- Current code pointers + existing behaviors: `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/repo_scan.md`
- External references (OpenAI + MCP SDK): `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/external_research.md`

## Plan of Work

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

## Concrete Steps

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

- External research summary: `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/external_research.md`
- Repo scan grounding notes: `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/repo_scan.md`
- (2025-12-30 08:07) Local verification: `npm test` (23 pass, 1 skipped).
- (2025-12-30 08:09) Local verification: `npm run lint`.

## Interfaces and Dependencies

New env vars (server process):
- `CODEX_AUTOPILOT_REASONING_EFFORT_LOW`
- `CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM`
- `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH`

Existing env vars (compat / optional):
- `CODEX_AUTOPILOT_MODEL_LOW`
- `CODEX_AUTOPILOT_MODEL_MEDIUM`
- `CODEX_AUTOPILOT_MODEL_HIGH`

Behavior:
- For each `delegate_autopilot` job, when the corresponding reasoning-effort env var is set, the server passes `-c model_reasoning_effort="..."` into the job’s `codex exec`.
- Model-name overrides remain possible via `CODEX_AUTOPILOT_MODEL_*` (`-c model="..."`), but they are not the primary “complexity scaling” mechanism.
