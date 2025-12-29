---
name: delegation-autopilot
description: In Codex interactive mode, call delegate_autopilot automatically for multi-step or cross-cutting requests (tests + docs + code), otherwise work normally.
delegator_exclude: true
---

# Delegation autopilot (parent-agent only)

This skill is meant for the **parent** Codex agent in interactive mode.

## When to call `delegate_autopilot`
- The user request is **multi-step** ("and", "then", "also", "plus") or touches **multiple areas** (code + tests + docs).
- The change is **cross-cutting** (multiple files/modules) or likely needs **specialist** attention (security/perf/research).
- The user explicitly asks to delegate / use subagents.

## When not to call
- The user is asking a **simple question** or wants a short explanation.
- The change is **tiny and local** (single file, trivial edit) and you can do it directly.

## How to call (minimal)
Call MCP tool `delegate_autopilot` with:
- `task`: the user request (verbatim)
- `cwd`: current workspace directory (optional; defaults are OK)

Optional knobs:
- `sandbox`: use `"workspace-write"` when you want subagents to edit files; `"read-only"` for analysis-only delegation.
- `max_agents`: default `3` (use `1` when you want a single subagent run).
- `skills_mode`: default `"auto"` (use `"none"` to disable skill selection).

## After calling
- If `structuredContent.decision.should_delegate` is `false`: continue normally without delegation.
- Otherwise: use `structuredContent.aggregate` as the consolidated result, and inspect `structuredContent.run_dir` for artifacts.

## Safety
- Never paste secrets from `${CODEX_HOME:-~/.codex}` or any local config.
- Do not recurse: delegated subagents must not call any `delegate_*` tools.
