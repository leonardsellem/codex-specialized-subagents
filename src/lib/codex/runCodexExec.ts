import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

import { writeJsonFile } from "../runDirs.js";
import { getSubagentOutputJsonSchema } from "./subagentOutput.js";

export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export type RunCodexExecOptions = {
  runDir: string;
  cwd: string;
  sandbox: CodexSandboxMode;
  skipGitRepoCheck: boolean;
  prompt: string;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
  configOverrides?: string[];
};

export type RunCodexExecResumeOptions = RunCodexExecOptions & {
  threadId: string;
};

export type RunCodexExecResult = {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  cancelled: boolean;
  exit_code: number | null;
  signal: string | null;
  thread_id: string | null;
  parent_thread_id?: string;
  artifacts: {
    subagent_output_schema_path: string;
    events_path: string;
    stderr_path: string;
    last_message_path: string;
    thread_path: string;
    result_path: string;
  };
  error: string | null;
};

function extractThreadId(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;

  const direct =
    (typeof record.thread_id === "string" && record.thread_id) ||
    (typeof record.threadId === "string" && record.threadId) ||
    (typeof record.session_id === "string" && record.session_id) ||
    (typeof record.sessionId === "string" && record.sessionId) ||
    (typeof record.conversation_id === "string" && record.conversation_id) ||
    (typeof record.conversationId === "string" && record.conversationId);
  if (direct) return direct;

  const data = record.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    const nested =
      (typeof dataRecord.thread_id === "string" && dataRecord.thread_id) ||
      (typeof dataRecord.threadId === "string" && dataRecord.threadId) ||
      (typeof dataRecord.session_id === "string" && dataRecord.session_id) ||
      (typeof dataRecord.sessionId === "string" && dataRecord.sessionId) ||
      (typeof dataRecord.conversation_id === "string" && dataRecord.conversation_id) ||
      (typeof dataRecord.conversationId === "string" && dataRecord.conversationId);
    if (nested) return nested;
  }

  const thread = record.thread;
  if (thread && typeof thread === "object") {
    const threadRecord = thread as Record<string, unknown>;
    const nested =
      (typeof threadRecord.id === "string" && threadRecord.id) ||
      (typeof threadRecord.thread_id === "string" && threadRecord.thread_id) ||
      (typeof threadRecord.session_id === "string" && threadRecord.session_id) ||
      (typeof threadRecord.conversation_id === "string" && threadRecord.conversation_id);
    if (nested) return nested;
  }

  return null;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function runCodexExecInternal(options: RunCodexExecOptions & {
  subcommandArgs?: string[];
  parentThreadId?: string;
}): Promise<RunCodexExecResult> {
  const startedAt = new Date();

  const subagentOutputSchemaPath = path.join(options.runDir, "subagent_output.schema.json");
  const eventsPath = path.join(options.runDir, "events.jsonl");
  const stderrPath = path.join(options.runDir, "stderr.log");
  const lastMessagePath = path.join(options.runDir, "last_message.json");
  const threadPath = path.join(options.runDir, "thread.json");
  const resultPath = path.join(options.runDir, "result.json");

  await ensureParentDir(subagentOutputSchemaPath);
  await writeJsonFile(subagentOutputSchemaPath, getSubagentOutputJsonSchema());

  await ensureParentDir(eventsPath);
  await ensureParentDir(stderrPath);

  const eventsStream = createWriteStream(eventsPath, { flags: "a" });
  const stderrStream = createWriteStream(stderrPath, { flags: "a" });

  let cancelled = false;
  let threadId: string | null = null;
  let error: string | null = null;

  const args: string[] = [
    "exec",
    "-C",
    options.cwd,
    "--sandbox",
    options.sandbox,
    "--json",
    "--output-schema",
    subagentOutputSchemaPath,
    "-o",
    lastMessagePath,
  ];

  if (options.skipGitRepoCheck) {
    args.push("--skip-git-repo-check");
  }

  for (const override of options.configOverrides ?? []) {
    args.push("-c", override);
  }

  if (options.subcommandArgs && options.subcommandArgs.length > 0) {
    args.push(...options.subcommandArgs);
  }

  // Read prompt from stdin to avoid shell escaping and arg length issues.
  args.push("-");

  const child = spawn("codex", args, {
    env: options.env ?? process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const abortHandler = (): void => {
    cancelled = true;
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }

    setTimeout(() => {
      try {
        if (child.exitCode === null) child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, 2000).unref();
  };

  if (options.abortSignal) {
    if (options.abortSignal.aborted) {
      abortHandler();
    } else {
      options.abortSignal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  let stdoutBuffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    stdoutBuffer += text;
    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) break;
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!line) continue;

      try {
        const parsed = JSON.parse(line) as unknown;
        const found = extractThreadId(parsed);
        if (found && !threadId) threadId = found;
      } catch {
        // ignore
      }
    }
  });

  child.stdout.pipe(eventsStream);
  child.stderr.pipe(stderrStream);

  if (child.stdin) {
    child.stdin.end(options.prompt, "utf8");
  }

  let exitCode: number | null = null;
  let signal: string | null = null;

  try {
    const closeArgs = await new Promise<[number | null, NodeJS.Signals | null]>(
      (resolve, reject) => {
        child.once("close", (code, closeSignal) => resolve([code, closeSignal]));
        child.once("error", reject);
      },
    );

    exitCode = closeArgs[0] ?? null;
    signal = closeArgs[1] ?? null;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    cancelled = cancelled || options.abortSignal?.aborted === true;
  } finally {
    if (!eventsStream.writableEnded) eventsStream.end();
    if (!stderrStream.writableEnded) stderrStream.end();
    if (options.abortSignal) {
      options.abortSignal.removeEventListener("abort", abortHandler);
    }
  }

  const finishedAt = new Date();

  if (threadId) {
    await writeJsonFile(threadPath, { thread_id: threadId });
  }

  const result: RunCodexExecResult = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    cancelled,
    exit_code: exitCode,
    signal,
    thread_id: threadId,
    ...(options.parentThreadId ? { parent_thread_id: options.parentThreadId } : {}),
    artifacts: {
      subagent_output_schema_path: subagentOutputSchemaPath,
      events_path: eventsPath,
      stderr_path: stderrPath,
      last_message_path: lastMessagePath,
      thread_path: threadPath,
      result_path: resultPath,
    },
    error,
  };

  await writeJsonFile(resultPath, result);
  return result;
}

export async function runCodexExec(options: RunCodexExecOptions): Promise<RunCodexExecResult> {
  return runCodexExecInternal(options);
}

export async function runCodexExecResume(
  options: RunCodexExecResumeOptions,
): Promise<RunCodexExecResult> {
  const { threadId, ...rest } = options;
  return runCodexExecInternal({
    ...rest,
    subcommandArgs: ["resume", threadId],
    parentThreadId: threadId,
  });
}
