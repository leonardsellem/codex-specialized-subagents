#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

fail() {
  echo "toolchain-check: ERROR: $*" >&2
  exit 1
}

warn() {
  echo "toolchain-check: WARN: $*" >&2
}

info() {
  echo "toolchain-check: $*" >&2
}

strict="${TOOLCHAIN_CHECK_STRICT:-0}"

has_file() {
  [[ -f "$1" ]]
}

has_node_lockfile() {
  has_file pnpm-lock.yaml || has_file package-lock.json || has_file yarn.lock
}

node_present=0
python_present=0

if has_file package.json; then
  node_present=1
fi

if has_file pyproject.toml || has_file requirements.txt || has_file requirements-dev.txt || has_file setup.py; then
  python_present=1
fi

if [[ "$node_present" == "1" ]]; then
  if ! grep -Eq '"packageManager"[[:space:]]*:' package.json; then
    fail "Node detected but package.json is missing a packageManager pin (e.g., \"pnpm@9.12.0\")."
  fi

  if ! has_node_lockfile; then
    fail "Node detected but no lockfile found (pnpm-lock.yaml | package-lock.json | yarn.lock)."
  fi
fi

if [[ "$python_present" == "1" ]]; then
  if ! has_file uv.lock; then
    fail "Python detected but uv.lock is missing. Run a locked workflow (uv lock / uv sync) and commit uv.lock."
  fi
fi

if has_file mise.lock && ! has_file mise.toml; then
  warn "mise.lock exists but mise.toml is missing. (This is unusual; consider adding mise.toml or removing mise.lock.)"
fi

# “Global install smell” scan (warn by default).
targets=()
has_file README.md && targets+=(README.md)
[[ -d docs ]] && targets+=(docs)
[[ -d .github ]] && targets+=(.github)

if [[ "${#targets[@]}" -gt 0 ]]; then
  patterns=(
    "npm install -g"
    "npm i -g"
    "pnpm add -g"
    "yarn global add"
  )

  for pattern in "${patterns[@]}"; do
    if grep -R -n -F --exclude-dir .git --exclude-dir node_modules -- "$pattern" "${targets[@]}" >/dev/null 2>&1; then
      msg="Found \"$pattern\" in repo docs. Prefer repo-local installs; update docs or document an exception."
      if [[ "$strict" == "1" ]]; then
        fail "$msg"
      else
        warn "$msg"
      fi
    fi
  done
fi

info "OK"
