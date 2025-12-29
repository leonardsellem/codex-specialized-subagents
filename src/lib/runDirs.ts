import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type RunDirInfo = {
  runId: string;
  runDir: string;
  runsRoot: string;
};

function formatTimestampForId(date: Date): string {
  return date
    .toISOString()
    .replace("T", "_")
    .replace("Z", "")
    .replace(/[:.]/g, "");
}

export function generateRunId(date = new Date()): string {
  const timestamp = formatTimestampForId(date);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${timestamp}_${rand}`;
}

export function getCodexHome(env = process.env): string {
  const configured = env.CODEX_HOME?.trim();
  if (configured) return configured;
  return path.join(os.homedir(), ".codex");
}

export function getRunsRoot(env = process.env): string {
  return path.join(getCodexHome(env), "delegator", "runs");
}

export async function createRunDir(options?: {
  env?: NodeJS.ProcessEnv;
  runId?: string;
}): Promise<RunDirInfo> {
  const env = options?.env ?? process.env;
  const runsRoot = getRunsRoot(env);
  const runId = options?.runId ?? generateRunId();
  const runDir = path.join(runsRoot, runId);

  await fs.mkdir(runDir, { recursive: true });
  return { runId, runDir, runsRoot };
}

async function writeFileAtomic(filePath: string, data: string | Buffer): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = path.join(dir, `${path.basename(filePath)}.tmp-${crypto.randomUUID()}`);
  await fs.writeFile(tmpPath, data);
  await fs.rename(tmpPath, filePath);
}

export async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await writeFileAtomic(filePath, JSON.stringify(payload, null, 2) + "\n");
}

export async function writeTextFile(filePath: string, text: string): Promise<void> {
  await writeFileAtomic(filePath, text);
}

