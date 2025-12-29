import { promises as fs } from "node:fs";

export type SkillFrontmatter = {
  name?: string;
  description?: string;
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseYamlFrontmatterBlock(frontmatter: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = frontmatter.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const key = match[1];
    let value = (match[2] ?? "").trim();

    if (value === "|" || value === ">") {
      const mode = value;
      const blockLines: string[] = [];
      i++;
      while (i < lines.length) {
        const nextRaw = lines[i] ?? "";
        if (!nextRaw.trim()) {
          blockLines.push("");
          i++;
          continue;
        }

        if (!/^\s+/.test(nextRaw)) {
          i--;
          break;
        }

        blockLines.push(nextRaw.replace(/^\s+/, "").trimEnd());
        i++;
      }

      const block =
        mode === ">"
          ? blockLines
              .map((l) => l.trim())
              .filter((l) => l.length > 0)
              .join(" ")
          : blockLines.join("\n").trimEnd();
      result[key] = block;
      continue;
    }

    result[key] = unquote(value);
  }

  return result;
}

export function parseSkillMarkdown(markdown: string): SkillFrontmatter {
  const lines = markdown.split(/\r?\n/);
  if ((lines[0] ?? "").trim() !== "---") return {};

  const endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (endIndex === -1) return {};

  const frontmatter = lines.slice(1, endIndex).join("\n");
  const parsed = parseYamlFrontmatterBlock(frontmatter);

  const name = parsed.name?.trim();
  const description = parsed.description?.trim();

  return {
    name: name || undefined,
    description: description || undefined,
  };
}

export async function parseSkillMarkdownFile(skillMarkdownPath: string): Promise<SkillFrontmatter> {
  const content = await fs.readFile(skillMarkdownPath, "utf8");
  return parseSkillMarkdown(content);
}

