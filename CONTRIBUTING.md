# Contributing

Thanks for your interest in contributing!

This project is a Node.js (ESM) + TypeScript MCP server that shells out to `codex exec` to run isolated sub-agents and writes artifact-first run directories under `${CODEX_HOME:-~/.codex}/delegator/runs/`.

## Development setup

Requirements:
- Node.js `>=20` (see `package.json#engines`)
- `npm`
- The `codex` CLI is only required for integration tests and real delegation runs

Install:

```bash
npm install
```

Common commands:

```bash
npm run dev
npm run build
npm run lint
npm test
```

## Tests

- Unit tests (default): `npm test`
- Integration tests (requires `codex` CLI + auth): `RUN_CODEX_INTEGRATION_TESTS=1 npm test`

If you run integration tests, make sure you’re logged in (`codex login`) and have network access.

## Project conventions (high signal)

- ESM + NodeNext: local TS imports use `.js` extensions (example: `import { x } from "./x.js"`).
- Zod: use the `zod/v4` entry point.
- MCP tools: when a tool has an `outputSchema`, return `structuredContent` (clients validate it).
- Artifact-first: treat `${CODEX_HOME:-~/.codex}/delegator/runs/` as sensitive (it can contain prompts/output).
- Skills:
  - Repo-local skills live under `.codex/skills/**`.
  - The `delegation-autopilot` skill in this repo is parent-only (`delegator_exclude: true`) to prevent recursion.

## Docs

Human-facing docs live in:
- `README.md`
- `docs/**`

AI-agent workflow docs live in:
- `AGENTS.md`
- `.agent/**`

If your change affects commands, tool schemas, entry points, or environment variables, update the relevant docs in the same PR.

## Optional: install git hooks (AI commit messages)

Hooks are opt-in:

```bash
bash scripts/install-git-hooks.sh
```

If you enable the AI commit message hook, use `.env.example` as a template and keep secrets in `.env` (gitignored).

## Submitting a PR

Please include:
- A clear summary of the change and why it’s needed
- How you validated it (commands + expected behavior)
- Any new/updated docs for user-facing changes

