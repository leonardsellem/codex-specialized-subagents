# Development

## Requirements

- Node.js `>=20`
- `npm`

## Install

```bash
npm install
```

## Common commands

- Dev server (stdio transport): `npm run dev`
- Build (emit `dist/`): `npm run build`
- Typecheck/lint: `npm run lint`
- Tests: `npm test`

## Test matrix

- Default unit tests: `npm test`
- Integration tests (requires `codex` CLI + auth): `RUN_CODEX_INTEGRATION_TESTS=1 npm test`

## Local docs and agent workflow

- Human-facing docs: `README.md` and `docs/**`
- AI-agent workflow docs: `AGENTS.md`, `.agent/PLANS.md`, and `.agent/execplans/**`
- Repo-scoped skills: `.codex/skills/**`

## Repo structure (high level)

- `src/server.ts` — MCP server + tool handlers
- `src/lib/codex/*` — `codex exec` runner + output parsing
- `src/lib/delegation/*` — autopilot routing/orchestration (`delegate_autopilot`)
- `src/lib/skills/*` — skill discovery + selection
- `src/tests/**` — unit tests (integration tests gated by env var)

