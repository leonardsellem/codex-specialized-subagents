import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverSkills, findNearestRepoSkillsRoot } from "../../lib/skills/discover.js";

async function withTmpDir<T>(prefix: string, fn: (tmpDir: string) => Promise<T>): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

test("findNearestRepoSkillsRoot returns nearest ancestor .codex/skills", async () => {
  await withTmpDir("codex-specialized-subagents-test-", async (tmpDir) => {
    const projectRoot = path.join(tmpDir, "project");
    const skillsRoot = path.join(projectRoot, ".codex", "skills");
    const nested = path.join(projectRoot, "a", "b", "c");

    await fs.mkdir(path.join(skillsRoot, "some-skill"), { recursive: true });
    await fs.mkdir(nested, { recursive: true });

    const found = await findNearestRepoSkillsRoot(nested);
    assert.equal(found, skillsRoot);
  });
});

test("discoverSkills indexes repo + global skills with origins", async () => {
  await withTmpDir("codex-specialized-subagents-test-", async (tmpDir) => {
    const projectRoot = path.join(tmpDir, "project");
    const repoSkillsRoot = path.join(projectRoot, ".codex", "skills");
    const globalSkillsRoot = path.join(tmpDir, "global_skills");
    const cwd = path.join(projectRoot, "nested");

    await fs.mkdir(path.join(repoSkillsRoot, "repo-skill"), { recursive: true });
    await fs.mkdir(path.join(globalSkillsRoot, "global-skill"), { recursive: true });
    await fs.mkdir(cwd, { recursive: true });

    await fs.writeFile(
      path.join(repoSkillsRoot, "repo-skill", "SKILL.md"),
      `---\nname: repo-skill\ndescription: Repo description\n---\n`,
      "utf8",
    );
    await fs.writeFile(
      path.join(globalSkillsRoot, "global-skill", "SKILL.md"),
      `---\nname: global-skill\ndescription: Global description\n---\n`,
      "utf8",
    );

    const index = await discoverSkills({
      cwd,
      includeRepoSkills: true,
      includeGlobalSkills: true,
      repoSkillsRootOverride: undefined,
      globalSkillsRootOverride: globalSkillsRoot,
    });

    assert.equal(index.roots.repo, repoSkillsRoot);
    assert.equal(index.roots.global, globalSkillsRoot);
    assert.equal(index.skills.length, 2);
    const byName = Object.fromEntries(index.skills.map((s) => [s.name, s]));
    assert.equal(byName["repo-skill"].origin, "repo");
    assert.equal(byName["global-skill"].origin, "global");
  });
});

