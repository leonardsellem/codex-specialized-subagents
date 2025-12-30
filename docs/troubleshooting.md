# Troubleshooting

## Tool call times out (~60 seconds)

Symptom: Codex reports something like `timed out awaiting tools/call after 60s`.

Fix: increase the MCP tool timeout for this server in `$HOME/.codex/config.toml`:

```toml
[mcp_servers.codex-specialized-subagents]
tool_timeout_sec = 1200
```

## TOML parse error: “duplicate key” for `[mcp_servers.codex-specialized-subagents]`

Symptom: Codex fails to start with a TOML parse error pointing at:
- `[mcp_servers.codex-specialized-subagents]`
- and “duplicate key”

Cause: TOML does not allow declaring the same table twice. This commonly happens if you:
- ran `codex mcp add codex-specialized-subagents ...` (which writes the table), and then
- appended another `[mcp_servers.codex-specialized-subagents]` block manually.

Fix: merge into a single table. Keep only one `[mcp_servers.codex-specialized-subagents]` header and put `tool_timeout_sec = 1200` in that same block.

## Config error: “expected a string … env.tool_timeout_sec”

Symptom: Codex fails to start with an error like:
- `invalid type: integer '1200', expected a string`
- `in mcp_servers.codex-specialized-subagents.env.tool_timeout_sec`

Cause: `env` is for environment variables only, and env values must be strings. `tool_timeout_sec` is a top-level MCP server setting (number), not an env var.

Fix: in `$HOME/.codex/config.toml`, move `tool_timeout_sec = 1200` into the server section, not under `.env`:

```toml
[mcp_servers.codex-specialized-subagents]
tool_timeout_sec = 1200

[mcp_servers.codex-specialized-subagents.env]
CODEX_AUTOPILOT_REASONING_EFFORT_LOW = "low"
CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM = "medium"
CODEX_AUTOPILOT_REASONING_EFFORT_HIGH = "high"
CODEX_DELEGATE_REASONING_EFFORT = "medium"
```

## `codex` not found / `ENOENT`

This server shells out to `codex exec`. Make sure the Codex CLI is installed and available on your PATH:

```bash
codex --help
```

## `dist/cli.js` not found

Rebuild from the repo root:

```bash
npm run build
ls -la dist/cli.js
```

## `delegate_*` fails with “did not produce a valid last_message.json”

This means `codex exec` finished but did not write a final message that matches the required JSON schema.

Debug checklist:
- Open the `run_dir` returned by the tool call.
- Check `stderr.log` for errors and `result.json` for exit status.
- Inspect `last_message.json` (if present) and compare it to the required fields in `reference/tools.md`.

## No output until delegation finishes

`delegate_*` tools are normal request/response calls, so the final tool result only appears when the call completes.

While a delegated `codex exec` is running, this server also emits MCP logging notifications (best-effort) so you can see liveness/progress in clients that render server logs.

If you still see nothing until the end:
- Confirm your client shows MCP logging notifications.
- Open the run directory and inspect `events.jsonl` / `stderr.log` / `codex_exec.json` while the run is in-flight.

## Integration tests are skipped or failing

By default, `npm test` skips real Codex integration. To enable integration tests:

```bash
RUN_CODEX_INTEGRATION_TESTS=1 npm test
```

If integration tests fail, ensure you are logged in with Codex (`codex login`) and have network access.

## Cleaning up run directories

Run directories can grow large over time. They live under `${CODEX_HOME:-$HOME/.codex}/delegator/runs/`.

If you want to delete old runs, delete specific run IDs rather than the whole directory.
