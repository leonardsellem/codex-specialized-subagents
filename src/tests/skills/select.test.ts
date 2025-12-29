import assert from "node:assert/strict";
import test from "node:test";

import { selectSkills } from "../../lib/skills/select.js";
import type { SkillIndexEntry } from "../../lib/skills/types.js";

test("selectSkills explicit mode prefers repo skill when names collide", () => {
  const index: SkillIndexEntry[] = [
    { name: "debugging", origin: "global", path: "/global/debugging/SKILL.md" },
    { name: "debugging", origin: "repo", path: "/repo/debugging/SKILL.md" },
  ];

  const result = selectSkills({
    mode: "explicit",
    skillsIndex: index,
    requested: ["debugging"],
    maxSkills: 6,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0]?.origin, "repo");
});

test("selectSkills auto mode scores name matches higher than description matches", () => {
  const index: SkillIndexEntry[] = [
    {
      name: "api-client",
      description: "Use when working with HTTP clients",
      origin: "global",
      path: "/global/api-client/SKILL.md",
    },
    {
      name: "testing-helper",
      description: "Great for api client work",
      origin: "global",
      path: "/global/testing-helper/SKILL.md",
    },
  ];

  const result = selectSkills({
    mode: "auto",
    skillsIndex: index,
    task: "build an api client",
    maxSkills: 1,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0]?.name, "api-client");
});

test("selectSkills auto mode returns empty selection with warning when no matches", () => {
  const index: SkillIndexEntry[] = [
    { name: "postgresql-expert", origin: "global", path: "/global/pg/SKILL.md" },
  ];

  const result = selectSkills({
    mode: "auto",
    skillsIndex: index,
    task: "design a CSS layout",
    maxSkills: 6,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.selected.length, 0);
  assert.ok(result.warnings.length > 0);
});
