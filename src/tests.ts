import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function listTestFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const testFiles: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      testFiles.push(...(await listTestFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      testFiles.push(entryPath);
    }
  }

  return testFiles;
}

const srcRoot = path.dirname(fileURLToPath(import.meta.url));
const testFiles = (await listTestFiles(srcRoot)).sort();

for (const testFile of testFiles) {
  await import(pathToFileURL(testFile).href);
}

