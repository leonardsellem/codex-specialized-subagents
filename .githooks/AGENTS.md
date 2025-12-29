# .githooks/AGENTS.md

Scope: optional git hooks under `.githooks/`.

## Install
- Hooks are opt-in and installed via: `bash scripts/install-git-hooks.sh`

## Conventions
- Hooks must be non-blocking by default (fail open) and fast.
- Avoid network calls and avoid printing secrets (git commit output is often pasted into chats).

## JIT search
- Inspect hooks: `ls -la .githooks`
- Find hook installer logic: `rg -n \"githooks\" scripts/install-git-hooks.sh -S`

