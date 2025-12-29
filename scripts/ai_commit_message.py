#!/usr/bin/env python3
"""
AI commit message generator.

- Reads the staged diff (`git diff --cached`)
- Calls the OpenAI Responses API
- Writes a Conventional Commit message into the commit message file

Designed to be safe-by-default:
- If no API key is available, it prints a warning and exits 0 (non-blocking) unless AI_COMMIT_STRICT=1.
- It truncates large diffs before sending.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple


@dataclass(frozen=True)
class Config:
    enabled: bool
    strict: bool
    api_key: Optional[str]
    base_url: str
    model: str
    reasoning_effort: str
    verbosity: str
    max_diff_chars: int


def _parse_bool(val: str, default: bool = False) -> bool:
    if val is None:
        return default
    val = val.strip().lower()
    return val in ("1", "true", "yes", "y", "on")


def _read_dotenv(repo_root: Path) -> Dict[str, str]:
    """
    Parse .env without executing it.
    Very small parser: KEY=VALUE lines, ignores comments and blanks.
    """
    dotenv_path = repo_root / ".env"
    if not dotenv_path.exists():
        return {}

    out: Dict[str, str] = {}
    for line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k:
            out[k] = v
    return out


def _git(repo_root: Path, *args: str) -> Tuple[int, str, str]:
    p = subprocess.run(
        ["git", *args],
        cwd=str(repo_root),
        text=True,
        capture_output=True,
    )
    return p.returncode, p.stdout, p.stderr


def _repo_root() -> Optional[Path]:
    code, out, _ = _git(Path.cwd(), "rev-parse", "--show-toplevel")
    if code != 0:
        return None
    return Path(out.strip())


def _load_config(repo_root: Path) -> Config:
    dotenv = _read_dotenv(repo_root)

    # Environment variables override .env
    def get(name: str, default: Optional[str] = None) -> Optional[str]:
        return os.environ.get(name) or dotenv.get(name) or default

    enabled = _parse_bool(get("AI_COMMIT_ENABLED", "1"), default=True)
    strict = _parse_bool(get("AI_COMMIT_STRICT", "0"), default=False)

    api_key = get("OPENAI_API_KEY") or get("CODEX_API_KEY")

    base_url = get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = get("AI_COMMIT_MODEL", "gpt-5.2")
    reasoning_effort = get("AI_COMMIT_REASONING_EFFORT", "none")
    verbosity = get("AI_COMMIT_VERBOSITY", "low")

    try:
        max_diff_chars = int(get("AI_COMMIT_MAX_DIFF_CHARS", "20000") or "20000")
    except ValueError:
        max_diff_chars = 20000

    return Config(
        enabled=enabled,
        strict=strict,
        api_key=api_key,
        base_url=base_url,
        model=model,
        reasoning_effort=reasoning_effort,
        verbosity=verbosity,
        max_diff_chars=max_diff_chars,
    )


def _extract_output_text(resp: dict) -> str:
    chunks = []
    for item in resp.get("output", []):
        if item.get("type") != "message":
            continue
        for c in item.get("content", []):
            if c.get("type") == "output_text":
                chunks.append(c.get("text", ""))
    return "".join(chunks).strip()


def _sanitize_commit_message(msg: str) -> str:
    msg = msg.strip()

    # Remove common wrappers
    msg = re.sub(r"^\s*```[a-zA-Z]*\s*", "", msg)
    msg = re.sub(r"\s*```\s*$", "", msg)

    # Trim surrounding quotes if the model added them
    if (msg.startswith('"') and msg.endswith('"')) or (msg.startswith("'") and msg.endswith("'")):
        msg = msg[1:-1].strip()

    # Normalize newlines
    msg = msg.replace("\r\n", "\n").replace("\r", "\n").strip()

    # Ensure trailing newline when writing to a file
    return msg


def _build_prompt(repo_root: Path, max_diff_chars: int) -> str:
    _, branch, _ = _git(repo_root, "rev-parse", "--abbrev-ref", "HEAD")
    branch = branch.strip()

    _, status, _ = _git(repo_root, "diff", "--cached", "--name-status")
    status = status.strip()

    _, stat, _ = _git(repo_root, "diff", "--cached", "--stat")
    stat = stat.strip()

    _, diff, _ = _git(repo_root, "diff", "--cached", "--no-color")
    diff = diff.strip()

    truncated = False
    if len(diff) > max_diff_chars:
        diff = diff[:max_diff_chars]
        truncated = True

    trunc_note = " (TRUNCATED)" if truncated else ""

    prompt = f"""You write excellent git commit messages.

Write ONE commit message for the staged changes below.

Rules:
- Use Conventional Commits format.
- First line: <type>(<optional-scope>): <imperative summary>
- Keep the first line <= 72 characters.
- If helpful, add a blank line and then 1-6 bullet points describing key changes.
- If there is a breaking change, add a footer like: BREAKING CHANGE: <what/why>.
- Output ONLY the commit message text. No backticks, no extra commentary.

Context:
- Repo: {repo_root.name}
- Branch: {branch}
- Staged files (name-status):
{status or "(none)"}

Diffstat:
{stat or "(none)"}

Staged diff{trunc_note}:
{diff or "(empty diff)"}
"""
    return prompt


def _call_openai(cfg: Config, prompt: str) -> str:
    url = f"{cfg.base_url}/responses"

    payload = {
        "model": cfg.model,
        "input": prompt,
        "reasoning": {"effort": cfg.reasoning_effort},
        "text": {"verbosity": cfg.verbosity},
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cfg.api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        data = json.loads(body)
        out = _extract_output_text(data)
        if not out:
            raise RuntimeError("No output text in API response.")
        return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", dest="write_path", help="Path to commit message file to write.")
    args = ap.parse_args()

    repo_root = _repo_root()
    if repo_root is None:
        print("ai_commit_message.py: not inside a git repo; skipping.", file=sys.stderr)
        return 0

    cfg = _load_config(repo_root)

    if not cfg.enabled:
        return 0

    if not cfg.api_key:
        msg = "ai_commit_message.py: no OPENAI_API_KEY/CODEX_API_KEY found; skipping."
        if cfg.strict:
            print(msg, file=sys.stderr)
            return 1
        print(msg, file=sys.stderr)
        return 0

    prompt = _build_prompt(repo_root, cfg.max_diff_chars)

    try:
        commit_msg = _call_openai(cfg, prompt)
        commit_msg = _sanitize_commit_message(commit_msg)
    except Exception as e:
        msg = f"ai_commit_message.py: failed to generate message: {e}"
        if cfg.strict:
            print(msg, file=sys.stderr)
            return 1
        print(msg, file=sys.stderr)
        return 0

    if args.write_path:
        p = Path(args.write_path)
        p.write_text(commit_msg.rstrip() + "\n", encoding="utf-8")
    else:
        print(commit_msg)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
