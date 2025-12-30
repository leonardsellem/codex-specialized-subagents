# Autopilot per-job thinking level overrides

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Clarify and correct the “per-job model override” behavior in `delegate_autopilot`:

- In Codex, a “model” is effectively **(model name + thinking level / reasoning effort)**.
- Autopilot already assigns each job a coarse `thinking_level` of `low | medium | high` (meaning: relative task complexity).
- The per-job override that should vary with task complexity is the **thinking level / reasoning effort**, not the model name.

After this change, operators can set server-process env vars to map autopilot job `thinking_level` → Codex thinking level by passing `-c model_reasoning_effort=<EFFORT>` into each `codex exec` sub-run. Documentation is updated to make this explicit and remove ambiguity.

## Progress

- [x] (2025-12-30 07:18) Scan current env-var override behavior + docs.
- [ ] (2025-12-30 07:18) Implement per-job reasoning-effort overrides via env vars.
- [ ] (2025-12-30 07:18) Update tests for new env vars/overrides.
- [ ] (2025-12-30 07:18) Update README + docs to reflect thinking-level overrides.
- [ ] (2025-12-30 07:18) Run `npm test`, `npm run lint`, `npm run build`.

## Surprises & Discoveries

- Observation: Current autopilot env vars are named `CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}` and are used to pass `-c model=<MODEL_ID>` (model name) into `codex exec`.
  Evidence: `src/lib/delegation/autopilot.ts` (plan builder) + `docs/usage.md`.
- Observation: Codex CLI config separates model name (`model`) from thinking level (`model_reasoning_effort`), and `-c` supports overriding arbitrary config keys.
  Evidence: `codex exec --help` documents `-c/--config`, and local `~/.codex/config.toml` commonly includes `model_reasoning_effort`.

## Decision Log

- Decision: Introduce env vars `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` and map them to per-job `-c model_reasoning_effort=<EFFORT>` overrides.
  Rationale: Task complexity should adjust thinking/reasoning depth; model name should remain a global/default configuration concern.
  Date/Author: 2025-12-30 (agent)
- Decision: Keep `CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}` support as an optional, separate feature (model-name override), but reframe docs to emphasize reasoning-effort overrides as the primary “complexity tuning” mechanism.
  Rationale: Avoid breaking existing users while removing the documentation ambiguity.
  Date/Author: 2025-12-30 (agent)

## Outcomes & Retrospective

TBD after implementation.

## Context and Orientation

Key concepts:

- **Autopilot job `thinking_level`**: a coarse, relative complexity label (`low | medium | high`) produced by the router at `src/lib/delegation/route.ts`. This is *not* the Codex “thinking level” string like `xhigh`; it’s an internal label used to decide defaults per job.
- **Codex model name**: configured via Codex CLI (`--model/-m` or `-c model=<MODEL_ID>`).
- **Codex thinking level / reasoning effort**: configured via Codex CLI config key `model_reasoning_effort` (example values seen in practice: `none`, `low`, `medium`, `high`, `xhigh`). This is the knob that should scale with task complexity.

Where the current behavior lives:

- `src/lib/delegation/route.ts`: assigns autopilot jobs and their `thinking_level`.
- `src/lib/delegation/autopilot.ts`: converts `thinking_level` → env-var lookup → `config_overrides` passed into `src/lib/codex/runCodexExec.ts`.
- `src/lib/codex/runCodexExec.ts`: forwards `configOverrides` as `codex exec -c <key=value>` flags.

Docs to update:

- `docs/usage.md`: currently describes per-job “model override” via `CODEX_AUTOPILOT_MODEL_*`.
- `README.md`: mentions the same env vars.
- `docs/reference/tools.md`: should clarify what autopilot `thinking_level` means and point readers to `config_overrides` / env vars for Codex-side settings.

## Plan of Work

1) Add new env vars for per-job reasoning effort and wire them into autopilot planning:
   - `CODEX_AUTOPILOT_REASONING_EFFORT_LOW`
   - `CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM`
   - `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH`

2) In `runAutopilot(...)`, when building `plan.jobs`:
   - Keep existing optional model-name override via `CODEX_AUTOPILOT_MODEL_*` (generating `-c model=<MODEL_ID>`).
   - Add optional reasoning-effort override via the new env vars (generating `-c model_reasoning_effort=<EFFORT>`).
   - If either override is present, ensure `config_overrides` is set (array), preserving stable ordering.

3) Update unit tests to assert the new behavior and ensure `configOverrides` are passed to `runCodexExec` correctly.

4) Update docs (README + `docs/usage.md`) to:
   - Explain that “model” is (name + thinking level).
   - Document the new env vars as the primary tuning mechanism.
   - Optionally document the old `CODEX_AUTOPILOT_MODEL_*` env vars as a separate model-name override.

5) Update `docs/reference/tools.md` to clarify that autopilot `thinking_level` is a coarse complexity label and that Codex-side overrides are expressed via `config_overrides`.

## Concrete Steps

### 0) Reconfirm current behavior (for reviewers / future debugging)

From repo root:

```bash
rg -n "CODEX_AUTOPILOT_MODEL_" -S src docs README.md
rg -n "config_overrides|configOverrides" -S src
codex exec --help | sed -n '1,80p'
```

### 1) Implement reasoning-effort overrides

Edit `src/lib/delegation/autopilot.ts`:

- Add env var mapping for `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` based on job `thinking_level`.
- Append `model_reasoning_effort=<EFFORT>` to `config_overrides` when set.
- Keep `model=<MODEL_ID>` override behavior intact (if set).
- Ensure empty/whitespace-only env var values are treated as “unset”.

### 2) Update/extend tests

Update `src/tests/delegation/autopilot-models.test.ts` (and optionally rename it) to cover:

- When only reasoning-effort env vars are set, each job receives the expected `config_overrides` and `runCodexExec` sees those overrides.
- (If keeping model-name env vars) when both model-name and reasoning-effort env vars are set, `config_overrides` contains both entries in a stable order.

### 3) Update documentation

Update `docs/usage.md`:

- Rename the section to emphasize thinking level / reasoning effort, not model name.
- Document `CODEX_AUTOPILOT_REASONING_EFFORT_{LOW,MEDIUM,HIGH}` and the fact that it maps job complexity to `-c model_reasoning_effort=<EFFORT>`.
- Add a short note about model name configuration (`--model/-m` or `-c model=...`) and mention `CODEX_AUTOPILOT_MODEL_*` only as an optional advanced override.

Update `README.md`:

- Replace the current “override the Codex model per job” line with the new reasoning-effort env vars, and optionally link to `docs/usage.md` for the full explanation.

Update `docs/reference/tools.md`:

- In the `delegate_autopilot` output description, add a short clarification that:
  - `thinking_level` is an autopilot complexity label (`low | medium | high`), not the Codex thinking level (`xhigh`, etc).
  - Codex configuration overrides are expressed via `config_overrides` (which may be set indirectly via the env vars documented in `docs/usage.md`).

### 4) Verify

From repo root:

```bash
npm test
npm run lint
npm run build
```

## Validation and Acceptance

Acceptance criteria:

- With `CODEX_AUTOPILOT_REASONING_EFFORT_LOW=low` set on the server process, autopilot jobs with `thinking_level: "low"` include `config_overrides: ["model_reasoning_effort=low", ...]` and `runCodexExec` receives the same override list.
- With `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH=xhigh`, the `implement` job (typically `thinking_level: "high"`) receives the corresponding override.
- If a reasoning-effort env var is unset or empty/whitespace, no `model_reasoning_effort=...` override is included for that job.
- Docs no longer claim that task complexity should override the model name; they explicitly describe thinking level / reasoning effort as the knob.
- `npm test`, `npm run lint`, and `npm run build` succeed.

## Idempotence and Recovery

Idempotence:

- Code changes are purely additive/config-driven; re-running tests/build is safe.
- Env var changes are runtime-only; no persisted state changes.

Recovery:

- If the new env vars cause unexpected behavior in downstream environments, unset `CODEX_AUTOPILOT_REASONING_EFFORT_*` to revert to the Codex default thinking level immediately (no deploy rollback required beyond config).
- If needed, revert the commit(s) that introduce the new env vars and docs.

## Artifacts and Notes

Store any command transcripts (test output, lint/build output) under:

- `.agent/execplans/artifacts/2025-12-30_autopilot-per-job-thinking-level-overrides/`

## Interfaces and Dependencies

New env vars (server process):

- `CODEX_AUTOPILOT_REASONING_EFFORT_LOW`
- `CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM`
- `CODEX_AUTOPILOT_REASONING_EFFORT_HIGH`

Behavior:

- For each `delegate_autopilot` job, when the corresponding env var is set, the server passes the override into `codex exec` via `-c model_reasoning_effort=<EFFORT>`.
- Existing `CODEX_AUTOPILOT_MODEL_{LOW,MEDIUM,HIGH}` remains supported to pass `-c model=<MODEL_ID>` (model-name override), but it is not the primary “complexity scaling” mechanism.
