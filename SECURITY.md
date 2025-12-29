# Security policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security reports.

Preferred: use GitHub Security Advisories for this repository (the “Report a vulnerability” flow).

If you can’t use Security Advisories, open a minimal issue asking for a private reporting channel and **do not include** sensitive details.

## Sensitive data

This project writes artifact directories under `${CODEX_HOME:-~/.codex}/delegator/runs/` that can include prompts, output, and logs.

When reporting bugs:
- Share the `run_dir` path and a redacted snippet from `stderr.log`/`result.json` if needed.
- Don’t paste secrets, tokens, or private prompts/output into public issues.

## Supported versions

This project is early-stage. Security fixes are provided for the latest commit on the default branch.

