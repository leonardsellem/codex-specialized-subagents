#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Not inside a git repository. Run 'git init' first." >&2
  exit 1
fi

cd "${ROOT}"

if [[ ! -f ".githooks/prepare-commit-msg" ]]; then
  echo "Missing .githooks/prepare-commit-msg. Did you scaffold the repo correctly?" >&2
  exit 1
fi

chmod +x ".githooks/prepare-commit-msg"

# Prefer versioned hooks (works across clones).
git config core.hooksPath .githooks

# Also copy into .git/hooks for compatibility / explicitness.
if [[ -d ".git/hooks" ]]; then
  cp ".githooks/prepare-commit-msg" ".git/hooks/prepare-commit-msg"
  chmod +x ".git/hooks/prepare-commit-msg"
fi

echo "✅ Git hooks installed."
echo "   - core.hooksPath set to .githooks"
echo "   - prepare-commit-msg enabled (AI commit messages)"
