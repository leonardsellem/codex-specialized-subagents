# Troubleshooting

## Tool call times out (~60 seconds)

Symptom: Codex reports something like `timed out awaiting tools/call after 60s`.

Fix: increase the MCP tool timeout for this server in `${CODEX_HOME:-~/.codex}/config.toml`:

```toml
[mcp_servers.codex-specialized-subagents]
tool_timeout_sec = 600
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

## Integration tests are skipped or failing

By default, `npm test` skips real Codex integration. To enable integration tests:

```bash
RUN_CODEX_INTEGRATION_TESTS=1 npm test
```

If integration tests fail, ensure you are logged in with Codex (`codex login`) and have network access.

## Cleaning up run directories

Run directories can grow large over time. They live under `${CODEX_HOME:-~/.codex}/delegator/runs/`.

If you want to delete old runs, delete specific run IDs rather than the whole directory.

