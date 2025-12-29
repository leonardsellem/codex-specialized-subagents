# src/AGENTS.md

Scope: the TypeScript MCP server implementation (`src/**`).

## Commands (from repo root)
- Dev (stdio MCP server): `npm run dev`
- Test: `npm test`
- Integration tests (requires `codex` CLI + auth): `RUN_CODEX_INTEGRATION_TESTS=1 npm test`
- Build: `npm run build`
- Lint/typecheck: `npm run lint`

## Conventions
- ESM + NodeNext: local TS imports use `.js` extensions (example: `import { startServer } from "./server.js"`).
- Zod: use `zod/v4` entry point for schemas.
- MCP tools:
  - register via `McpServer.registerTool(...)`
  - if a tool has an output schema, always return `structuredContent` (the MCP client validates it)
- Artifact-first: delegated runs write to `${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/` via `src/lib/runDirs.ts`.
- `codex exec` runner lives in `src/lib/codex/runCodexExec.ts` and pipes prompts via stdin (`codex exec -`) to avoid quoting issues.
- Tests live under `src/tests/**/*.test.ts`; `src/tests.ts` imports them for `node --test`.

## Key entry points
- `src/cli.ts` → CLI entrypoint for stdio server
- `src/server.ts` → MCP server + tool handlers
- `src/lib/codex/*` → `codex exec` spawn + output schema
- `src/lib/skills/*` → skill discovery + selection

## JIT search
- Tools: `rg -n \"registerTool\\(\\\"delegate\" src/server.ts`
- Codex runner: `rg -n \"runCodexExec|runCodexExecResume\" src/lib/codex -S`
- Skill selection: `rg -n \"discoverSkills|selectSkills\" src/lib/skills -S`

