import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

import { getCodexHome } from "../runDirs.js";
import { parseSkillMarkdownFile } from "./parseSkillMarkdown.js";
import { SkillIndex, SkillIndexEntry, SkillOrigin } from "./types.js";

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function normalizeStartDir(cwd: string): Promise<string> {
  const resolved = path.resolve(cwd);
  try {
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) return resolved;
    return path.dirname(resolved);
  } catch {
    return resolved;
  }
}

export async function findNearestRepoSkillsRoot(cwd: string): Promise<string | null> {
  let current = await normalizeStartDir(cwd);

  while (true) {
    const candidate = path.join(current, ".codex", "skills");
    if (await isDirectory(candidate)) return candidate;

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

export function getGlobalSkillsRoot(env = process.env): string {
  return path.join(getCodexHome(env), "skills");
}

async function listSkillMarkdownFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [root];

  while (queue.length > 0) {
    const dir = queue.pop();
    if (!dir) continue;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(entryPath);
      }
    }
  }

  return results.sort();
}

function fallbackSkillName(skillMarkdownPath: string): string {
  return path.basename(path.dirname(skillMarkdownPath));
}

async function indexSkills(root: string, origin: SkillOrigin): Promise<SkillIndexEntry[]> {
  if (!(await isDirectory(root))) return [];

  const files = await listSkillMarkdownFiles(root);
  const entries: SkillIndexEntry[] = [];

  for (const filePath of files) {
    try {
      const frontmatter = await parseSkillMarkdownFile(filePath);
      if (frontmatter.delegator_exclude === true) continue;
      const name = frontmatter.name?.trim() || fallbackSkillName(filePath);
      const description = frontmatter.description?.trim() || undefined;

      entries.push({
        name,
        description,
        origin,
        path: filePath,
      });
    } catch {
      entries.push({
        name: fallbackSkillName(filePath),
        origin,
        path: filePath,
      });
    }
  }

  return entries;
}

export async function discoverSkills(options: {
  cwd: string;
  includeRepoSkills: boolean;
  includeGlobalSkills: boolean;
  env?: NodeJS.ProcessEnv;
  repoSkillsRootOverride?: string | null;
  globalSkillsRootOverride?: string | null;
}): Promise<SkillIndex> {
  const env = options.env ?? process.env;

  const repoRoot =
    options.includeRepoSkills
      ? options.repoSkillsRootOverride === undefined
        ? await findNearestRepoSkillsRoot(options.cwd)
        : options.repoSkillsRootOverride
      : null;

  const globalRoot =
    options.includeGlobalSkills
      ? options.globalSkillsRootOverride === undefined
        ? getGlobalSkillsRoot(env)
        : options.globalSkillsRootOverride
      : null;

  const [repoSkills, globalSkills] = await Promise.all([
    repoRoot ? indexSkills(repoRoot, "repo") : Promise.resolve([]),
    globalRoot ? indexSkills(globalRoot, "global") : Promise.resolve([]),
  ]);

  return {
    roots: {
      ...(repoRoot ? { repo: repoRoot } : {}),
      ...(globalRoot ? { global: globalRoot } : {}),
    },
    skills: [...repoSkills, ...globalSkills],
  };
}
