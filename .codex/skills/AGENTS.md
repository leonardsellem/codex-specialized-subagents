# .codex/skills/AGENTS.md

Scope: repo-local Codex skills (`.codex/skills/**`).

## Skill layout
- Each skill is a folder containing `SKILL.md`:
  - `.codex/skills/<skill-name>/SKILL.md`
- `SKILL.md` should start with YAML frontmatter (minimum):
  - `name: <skill-name>`
  - `description: <what triggers this skill>`

## How skills are used by this repo
- Discovery: the server indexes all `**/SKILL.md` under the nearest ancestor `.codex/skills`.
- Parsing: YAML frontmatter is best-effort; if missing/invalid, the fallback skill name is the parent folder name.
- Selection:
  - `skills_mode=explicit` matches requested skill names case-insensitively
  - when names collide, repo-local skills are preferred over global skills

## Conventions
- Keep skills short and pointer-heavy (paths + commands), not long prose.
- Never include secrets/tokens/keys in skills.

## JIT search
- List all repo skills: `find .codex/skills -name SKILL.md -print`
- Find skill frontmatter: `rg -n \"^name:|^description:\" .codex/skills -S`

