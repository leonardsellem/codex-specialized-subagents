# Fix delegate_autopilot MCP timeouts

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Fix (and prevent recurrence of) Codex CLI interactive tool-call timeouts when using this MCP server’s long-running tool `delegate_autopilot`.

End state:
- Users can run `delegate_autopilot` on multi-minute tasks without getting a ~60s “deadline has elapsed” failure.
- If a timeout/cancellation does happen, run directories still contain enough state to debug and resume.
- Docs + the global “delegation-autopilot” skill explicitly call out required MCP timeout configuration.

## Progress

- [ ] (2025-12-29 22:20) Capture repro + evidence (error text, config state, run dir state).
- [ ] (2025-12-29 22:20) Implement docs/skill remediation (timeouts + common error + fix).
- [ ] (2025-12-29 22:20) Add a safe “doctor” script to check/print required MCP timeout config.
- [ ] (2025-12-29 22:20) Improve cancellation robustness: persist partial autopilot state early + incrementally.
- [ ] (2025-12-29 22:20) Validate: unit tests, build, lint; manual interactive delegation run.

## Surprises & Discoveries

- Observation: Codex CLI tool calls default to a ~60s deadline; `delegate_autopilot` frequently takes minutes (it can run 2–3 sub-agent `codex exec` runs).
  Evidence: user error: `timed out awaiting tools/call after 60s` and README note “Delegated runs can take minutes”.

- Observation: The local Codex config had the MCP server registered but did not set `tool_timeout_sec` for this server.
  Evidence (local): `${CODEX_HOME:-~/.codex}/config.toml` contained `[mcp_servers.codex-specialized-subagents]` with only `command`/`args` (no `tool_timeout_sec`).

- Observation: A timed-out call still created a run directory, but it was incomplete (no `autopilot_aggregate.json`, and the scan subrun had `events.jsonl` but no `result.json`/`last_message.json`).
  Evidence (local): `${CODEX_HOME:-~/.codex}/delegator/runs/2025-12-29_210034370_939737596dcb/`.

## Decision Log

- Decision: Treat this as primarily a “client timeout configuration” issue, and remediate via stronger docs + a “doctor” helper, plus better partial-state persistence on cancellations.
  Rationale: The server cannot control Codex’s MCP client deadline; the best durable fixes are (a) making the required config unmissable and (b) making partial runs debuggable/resumable.
  Date/Author: 2025-12-29 / agent

- Decision: Do not auto-edit `~/.codex/config.toml` as part of normal server operation.
  Rationale: It’s user-owned config and may include other MCP servers and secrets; we should guide users and provide a safe checker instead.
  Date/Author: 2025-12-29 / agent

## Outcomes & Retrospective

Target outcomes (what “done” looks like):
- README + `.codex/skills/delegation-autopilot/SKILL.md` explicitly call out:
  - default ~60s tool deadline,
  - required `tool_timeout_sec` config snippet,
  - common timeout error message and what to do next.
- `python3 scripts/check_mcp_timeouts.py` (new) reports missing/low timeout for this server and prints a minimal safe TOML snippet to apply.
- `delegate_autopilot` writes partial state early and updates it per-phase so a killed run is still inspectable.

## Context and Orientation

### What is failing

In Codex interactive mode, calling this MCP server’s tool:
- `codex-specialized-subagents.delegate_autopilot({...})`

can fail with:
- `timed out awaiting tools/call after 60s`

This is a **client-side timeout**: Codex stops waiting for the MCP tool response after the deadline.

### Why it fails

`delegate_autopilot` orchestrates one or more **sub-agent** runs by spawning `codex exec` processes (see `src/lib/delegation/autopilot.ts` and `src/lib/codex/runCodexExec.ts`). For non-trivial tasks (like documentation audits), the combined run time commonly exceeds 60 seconds.

Codex supports per-server MCP timeout configuration via `${CODEX_HOME:-~/.codex}/config.toml`. If `tool_timeout_sec` is not set for this server, Codex uses its default (observed: ~60s).

### Key files (repo-relative)

- `README.md` — user docs; currently contains a “Codex MCP config (timeouts)” section.
- `.codex/skills/delegation-autopilot/SKILL.md` — global-skill template that triggers `delegate_autopilot` in interactive mode.
- `src/server.ts` — registers `delegate_autopilot` tool.
- `src/lib/delegation/autopilot.ts` — orchestrates jobs + writes run artifacts (`autopilot_*`).
- `src/lib/codex/runCodexExec.ts` — spawns `codex exec` and writes per-run artifacts (`events.jsonl`, `result.json`, `last_message.json`, ...).
- `scripts/` — add a safe checker script here.

### Definitions

- **tool deadline / tool timeout**: how long Codex waits for an MCP tool response before failing the tool call.
- **Run directory**: `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/` (artifact-first outputs).

## Plan of Work

### Milestone 1 — Make timeout remediation unmissable (docs + skill)

Edits:
- `README.md`: move/expand timeout guidance nearer to setup/quickstart and include the exact error string users will see.
- `.codex/skills/delegation-autopilot/SKILL.md`: add a prerequisite note:
  - If tool calls fail at ~60s, set `tool_timeout_sec` in config for this server.
  - Recommend `sandbox="workspace-write"` when the user expects edits, not just analysis.
- `src/server.ts` (optional): update tool description to mention it can take minutes and requires higher `tool_timeout_sec`.

Outcome:
- A user who installs the global skill is very likely to see/configure timeouts before first delegation.

### Milestone 2 — Add a safe config “doctor” script

Add:
- `scripts/check_mcp_timeouts.py`:
  - Reads `${CODEX_HOME:-~/.codex}/config.toml`.
  - Checks `[mcp_servers.codex-specialized-subagents].tool_timeout_sec`.
  - Never prints other server configs/args/env.
  - If missing/too low: prints a minimal TOML snippet to add and exits non-zero.
  - If OK: prints current value and exits 0.

Outcome:
- Users can run one command to verify they won’t hit the ~60s timeout.

### Milestone 3 — Persist partial state early for post-mortem debugging

Improve:
- `src/lib/delegation/autopilot.ts`:
  - Write an initial `autopilot_aggregate.json` stub immediately after `autopilot_plan.json`.
  - After each job/phase, update `autopilot_aggregate.json` (and optionally a new `autopilot_status.json`) so partial progress is visible even if the client times out or the process is killed.
  - Ensure cancellations (`AbortSignal`) are reflected in the written status.

Outcome:
- If Codex cancels/kills the tool call, the run directory still contains a clear “what happened” trail.

## Concrete Steps

### Repro / evidence collection (one-time)

1) Confirm missing timeout config (safe extraction):

```bash
python3 - <<'PY'
import os, tomllib
path = os.path.join(os.environ.get('CODEX_HOME', os.path.expanduser('~/.codex')), 'config.toml')
data = tomllib.load(open(path,'rb'))
server = (data.get('mcp_servers', {}) or {}).get('codex-specialized-subagents', {}) or {}
print('has_server_section=', bool(server))
print('tool_timeout_sec=', server.get('tool_timeout_sec'))
PY
```

2) Inspect a timed-out run directory (example):

```bash
ls -la "${CODEX_HOME:-$HOME/.codex}/delegator/runs/2025-12-29_210034370_939737596dcb"
find "${CODEX_HOME:-$HOME/.codex}/delegator/runs/2025-12-29_210034370_939737596dcb" -maxdepth 3 -type f -print
```

### Implementation work

3) Edit docs + skill + (optional) tool description (Milestone 1).
4) Add `scripts/check_mcp_timeouts.py` + document it (Milestone 2).
5) Update autopilot to write partial state early + incrementally; add/update unit tests as needed (Milestone 3).

### Local verification

```bash
npm test
npm run build
npm run lint
```

### Manual verification (interactive)

1) Add to `${CODEX_HOME:-~/.codex}/config.toml`:

```toml
[mcp_servers.codex-specialized-subagents]
tool_timeout_sec = 600
```

2) In Codex interactive, run a known-long `delegate_autopilot` request and confirm it completes (or at least runs >60s without timing out).
3) Confirm the run directory contains:
- `autopilot_aggregate.json`
- `subruns/<job_id>/result.json`
- `subruns/<job_id>/last_message.json` (when the subagent completes normally)

## Validation and Acceptance

Acceptance criteria:
- Docs: `README.md` and `.codex/skills/delegation-autopilot/SKILL.md` clearly describe timeouts and include the minimal config snippet.
- Script: `python3 scripts/check_mcp_timeouts.py`:
  - exits `0` when `tool_timeout_sec` is set sufficiently,
  - exits non-zero and prints a safe snippet when missing/too low.
- Robustness: killing/cancelling an autopilot run still leaves updated `autopilot_aggregate.json` (and/or `autopilot_status.json`) showing partial progress and which job was running.
- Verification: `npm test`, `npm run build`, `npm run lint` pass.

## Idempotence and Recovery

Idempotence:
- The doctor script is read-only and safe to run repeatedly.
- Autopilot partial-state writes should be safe to overwrite (atomic writes).

Recovery:
- If a run is left incomplete, inspect `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/` and re-run with a higher `tool_timeout_sec`.
- If a subagent got stuck, confirm no lingering `codex` processes remain before retrying.

## Artifacts and Notes

Local example of the failure:
- Run dir: `${CODEX_HOME:-~/.codex}/delegator/runs/2025-12-29_210034370_939737596dcb/`
  - Contains: `request.json`, `autopilot_decision.json`, `autopilot_plan.json`, `skills_index.json`
  - Missing due to timeout: `autopilot_aggregate.json`, `subruns/scan/result.json`, `subruns/scan/last_message.json`

## Interfaces and Dependencies

- Codex CLI (`codex`) provides MCP client behavior and enforces tool-call deadlines.
- This repo’s MCP server is stdio-based and built on `@modelcontextprotocol/sdk` + `zod/v4`.
