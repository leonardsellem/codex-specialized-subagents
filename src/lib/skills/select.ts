import { SkillIndexEntry } from "./types.js";

export type SkillsMode = "auto" | "explicit" | "none";

export type SelectSkillsResult = {
  selected: SkillIndexEntry[];
  warnings: string[];
  errors: string[];
};

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function scoreSkill(taskTokens: Set<string>, skill: SkillIndexEntry): number {
  const nameTokens = tokenize(skill.name);
  const descTokens = skill.description ? tokenize(skill.description) : [];

  let score = 0;
  for (const token of nameTokens) {
    if (taskTokens.has(token)) score += 3;
  }
  for (const token of descTokens) {
    if (taskTokens.has(token)) score += 1;
  }
  return score;
}

function preferRepoThenGlobal(a: SkillIndexEntry, b: SkillIndexEntry): number {
  if (a.origin === b.origin) return 0;
  if (a.origin === "repo") return -1;
  return 1;
}

function stableSkillSort(a: SkillIndexEntry, b: SkillIndexEntry): number {
  const origin = preferRepoThenGlobal(a, b);
  if (origin !== 0) return origin;
  return a.name.localeCompare(b.name) || a.path.localeCompare(b.path);
}

export function selectSkills(options: {
  mode: SkillsMode;
  skillsIndex: SkillIndexEntry[];
  task?: string;
  requested?: string[];
  maxSkills: number;
}): SelectSkillsResult {
  const mode = options.mode;
  if (mode === "none") return { selected: [], warnings: [], errors: [] };

  const skillsIndex = [...options.skillsIndex].sort(stableSkillSort);

  if (mode === "explicit") {
    const requested = (options.requested ?? []).map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) {
      return { selected: [], warnings: [], errors: ["skills_mode=explicit requires skills[]"] };
    }

    const byName = new Map<string, SkillIndexEntry[]>();
    for (const skill of skillsIndex) {
      const key = normalizeSkillName(skill.name);
      const list = byName.get(key);
      if (list) list.push(skill);
      else byName.set(key, [skill]);
    }

    const selected: SkillIndexEntry[] = [];
    const missing: string[] = [];
    const warnings: string[] = [];

    for (const req of requested) {
      const matches = byName.get(normalizeSkillName(req)) ?? [];
      if (matches.length === 0) {
        missing.push(req);
        continue;
      }

      matches.sort((a, b) => preferRepoThenGlobal(a, b) || stableSkillSort(a, b));
      const chosen = matches[0]!;
      if (matches.length > 1) {
        warnings.push(
          `Multiple skills matched "${req}", selected ${chosen.origin}:${chosen.name} (${chosen.path})`,
        );
      }

      selected.push(chosen);
    }

    if (missing.length > 0) {
      return {
        selected,
        warnings,
        errors: [`Missing requested skills: ${missing.join(", ")}`],
      };
    }

    return { selected, warnings, errors: [] };
  }

  const task = options.task?.trim() ?? "";
  if (!task) {
    return { selected: [], warnings: [], errors: ["skills_mode=auto requires non-empty task"] };
  }

  const taskTokens = new Set(tokenize(task));
  const scored = skillsIndex
    .map((skill) => ({ skill, score: scoreSkill(taskTokens, skill) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      const score = b.score - a.score;
      if (score !== 0) return score;
      return stableSkillSort(a.skill, b.skill);
    });

  if (scored.length === 0) {
    return {
      selected: [],
      warnings: [
        "No skills matched task keywords; selected_skills is empty (use skills_mode=explicit to force selection).",
      ],
      errors: [],
    };
  }

  const selected = scored.slice(0, options.maxSkills).map(({ skill }) => skill);
  return { selected, warnings: [], errors: [] };
}

