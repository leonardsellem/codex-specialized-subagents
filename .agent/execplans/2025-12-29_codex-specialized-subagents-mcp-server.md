# Codex specialized subagents MCP server

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Build a local MCP server (stdio) that gives Codex a **first-class delegation tool**:

- Codex calls `delegate.run` / `delegate.resume`
- The MCP server spawns a **separate `codex exec` sub-agent process** (a “specialist”)
- The server **selects relevant Codex skills** from:
  - repo-local `.codex/skills` (nearest ancestor of the requested `cwd`)
  - global `${CODEX_HOME:-~/.codex}/skills`
- The server writes full sub-agent logs + outputs to disk (run directory), and returns only a **small structured summary** + artifact paths to keep the main chat context light.

How you can see it working:
- Register the MCP server in Codex (`codex mcp add …`)
- In any repo, ask Codex to delegate a task (Codex should call `delegate.run`)
- Verify a new run folder exists with `events.jsonl`, `last_message.json`, `result.json`, `skills_index.json`, `selected_skills.json`.

## Progress

- [x] (2025-12-29 19:18) Scaffolded repo with `lp-project-scaffold` and created this ExecPlan.
- [x] (2025-12-29 19:25) Chose stack + added minimal Node/TS project skeleton (no delegation logic yet).
- [x] (2025-12-29 19:26) Updated `README.md` + `AGENTS.md` to be repo-specific and point to this ExecPlan.
- [x] (2025-12-29 19:27) Verified local commands: `npm install`, `npm run build`, `npm test`.
- [ ] Implement skill discovery (repo + global) + selection (explicit/auto).
- [ ] Implement `codex exec` runner (spawn + artifacts + thread_id extraction).
- [ ] Implement MCP tools: `delegate.run`, `delegate.resume` (v1); consider `delegate.batch` later.
- [ ] Add tests (unit + optional integration behind env flag).
- [ ] Expand docs with tool API + examples (post-implementation).
- [ ] Manual end-to-end smoke test in 2 repos.

## Surprises & Discoveries

- Observation: `@modelcontextprotocol/sdk` expects `zod/v4` imports, which requires Zod v4.
  Evidence: `npm view zod version` shows v4 exists; older Zod versions don’t export `zod/v4`.
- Observation: `codex exec --json` emits JSONL events with a `thread.started` event that includes `thread_id`.
  Evidence: run `codex exec --skip-git-repo-check --json "Say ok"` and inspect stdout.

## Decision Log

- Decision: Implement the MCP server in Node.js + TypeScript using `@modelcontextprotocol/sdk` and `zod`.
  Rationale: Local stdio MCP is straightforward; TypeScript SDK provides tool schemas and output validation.
  Date/Author: 2025-12-29 / agent

- Decision: Skills are “selected” by the MCP server and **named explicitly** in the sub-agent prompt, but not inlined.
  Rationale: Keeps token usage low; source-of-truth stays in `.codex/skills/**/SKILL.md` and `${CODEX_HOME}/skills/**/SKILL.md`.
  Date/Author: 2025-12-29 / agent

- Decision: Default run artifacts directory is `${CODEX_HOME:-~/.codex}/delegator/runs/<run-id>/`.
  Rationale: Avoids polluting arbitrary repos; works across projects.
  Date/Author: 2025-12-29 / agent

- Decision: Prevent recursion by default: sub-agent runs with `-c 'mcp.servers=[]'`.
  Rationale: Avoids “delegate calls delegate” loops; keeps behavior predictable.
  Date/Author: 2025-12-29 / agent

## Outcomes & Retrospective

(Fill in after shipping v1.)

## Context and Orientation

### Key concepts

- **Codex CLI**: `codex` binary that can run interactively or non-interactively (`codex exec`).
- **Sub-agent**: a separate `codex exec` process spawned by this MCP server to do a focused task.
- **Skill**: a directory containing `SKILL.md` with YAML frontmatter `name` + `description`.
- **Repo-local skills**: nearest `.codex/skills` directory when walking upward from a target `cwd`.
- **Global skills**: `${CODEX_HOME:-~/.codex}/skills`.
- **Run directory**: where we store request, event log, output, and selected skills for a single delegation run.

### What “skill sourcing universal” means (constraints)

- Do not hardcode any user-specific absolute paths in code or docs.
- Use `os.homedir()` + `CODEX_HOME` env var conventions.
- Resolve repo-local `.codex/skills` by walking up from the provided `cwd`.

## Plan of Work

1) Add a minimal Node/TS project skeleton (build/test/dev commands exist and work).
2) Implement skill discovery:
   - parse `SKILL.md` frontmatter (`name`, `description`) from repo + global skill roots
   - persist a `skills_index.json` in the run directory for traceability/debugging
3) Implement skill selection:
   - `skills_mode=explicit`: validate requested skill names exist
   - `skills_mode=auto`: pick top `max_skills` by keyword overlap on `name` + `description`
   - persist `selected_skills.json`
4) Implement sub-agent runner:
   - spawn `codex exec` with `--json`, `--output-schema`, and `-o <last_message.json>`
   - write stdout to `events.jsonl`
   - extract `thread_id` from the JSONL stream (`thread.started`)
5) Implement MCP server tools:
   - `delegate.run`: create run dir, discover/select skills, spawn sub-agent, validate output, return structured summary
   - `delegate.resume`: same, but uses `codex exec resume <thread_id>`
6) Write tests and run a local smoke test.
7) Update docs (`README.md`, `AGENTS.md`) to match reality.

## Concrete Steps

> All commands run from the repo root unless noted.

1) Create Node/TS skeleton:
   - `npm init -y`
   - Add deps: `npm install @modelcontextprotocol/sdk zod`
   - Add dev deps: `npm install -D typescript tsx`
   - Create `tsconfig.json` (NodeNext)
   - Create `src/cli.ts` + `src/server.ts` (server skeleton only)
   - Run: `npm run build`

2) Add skill discovery utilities:
   - Create `src/lib/skills.ts`
   - Add unit tests under `src/lib/*.test.ts`
   - Run: `npm test`

3) Add selection utilities:
   - Create `src/lib/skillSelect.ts`
   - Run: `npm test`

4) Add codex exec runner:
   - Create `src/lib/codexExec.ts`
   - Run: `npm test`

5) Add MCP tool implementations:
   - Modify `src/server.ts` to register `delegate.run` / `delegate.resume`
   - Run: `npm run build`

6) Manual smoke test:
   - Register: `codex mcp add codex-specialized-subagents -- node \"$(pwd)/dist/cli.js\"`
   - In any repo: start `codex` and ask it to delegate a short research task.

## Validation and Acceptance

### Automated

- Unit tests pass: `npm test`
- Typecheck/build passes: `npm run build`

### Manual acceptance story

1) `codex mcp list` shows `codex-specialized-subagents` enabled.
2) In repo A: Codex calls `delegate.run` and returns:
   - `run_id`, `run_dir`, `subagent_thread_id`, `selected_skills`, `summary`, `next_actions`
3) In repo B: same success.
4) `run_dir` contains:
   - `request.json`
   - `events.jsonl`
   - `last_message.json`
   - `result.json`
   - `skills_index.json`
   - `selected_skills.json`

## Idempotence and Recovery

- Safe to re-run:
  - `npm install`, `npm test`, `npm run build`
  - `codex mcp add …` (if the name already exists, remove/re-add)
- Recovery:
  - Remove a bad MCP config: `codex mcp remove codex-specialized-subagents`
  - Delete old run artifacts: remove `${CODEX_HOME:-~/.codex}/delegator/runs/<run-id>/` directories

## Artifacts and Notes

- Run artifacts live outside the repo by default: `${CODEX_HOME:-~/.codex}/delegator/runs/…`
- Keep any smoke-test transcripts under:
  - `.agent/execplans/artifacts/2025-12-29_codex-specialized-subagents-mcp-server/`

## Interfaces and Dependencies

### External dependencies

- `codex` CLI available on PATH
- Node.js (>= 20)
- `@modelcontextprotocol/sdk` (TypeScript SDK)
- `zod` v4 (for `zod/v4` import compatibility)

### MCP tools (v1)

- `delegate.run` input (draft):
  - `task` (string), `role` (string), `cwd` (string)
  - `skills_mode`: `auto|explicit`
  - `skills`: string[] (when explicit)
  - `max_skills`: number (auto)
  - `include_repo_skills`: boolean
  - `include_global_skills`: boolean
  - `sandbox`: `read-only|workspace-write|danger-full-access`

- `delegate.resume` input (draft):
  - `thread_id` (string) + same fields as `delegate.run`

### Sub-agent output (JSON, schema-enforced)

- `summary` (string)
- `deliverables` ({ path, description }[])
- `open_questions` (string[])
- `next_actions` (string[])
