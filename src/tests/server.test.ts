import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type DelegateToolOutput = {
  run_id: string;
  run_dir: string;
  subagent_thread_id: string | null;
};

const RUN_CODEX_INTEGRATION_TESTS = process.env.RUN_CODEX_INTEGRATION_TESTS === "1";

async function withTmpDir<T>(
  prefix: string,
  fn: (tmpDir: string) => Promise<T>,
): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function withClient<T>(
  codexHome: string | null,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const repoRoot = process.cwd();
  const env = {
    ...process.env,
    ...(codexHome ? { CODEX_HOME: codexHome } : {}),
  };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.join(repoRoot, "src/cli.ts")],
    env,
    stderr: "pipe",
  });

  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

test("mcp server registers delegate tools", async () => {
  await withTmpDir("codex-specialized-subagents-test-", async (tmpDir) => {
    const codexHome = path.join(tmpDir, "codex_home");
    await fs.mkdir(codexHome, { recursive: true });

    await withClient(codexHome, async (client) => {
      const toolList = await client.listTools();
      assert.ok(toolList.tools.some((t) => t.name === "delegate.run"));
      assert.ok(toolList.tools.some((t) => t.name === "delegate.resume"));
    });
  });
});

test(
  "delegate.run runs codex exec and writes artifacts",
  { skip: !RUN_CODEX_INTEGRATION_TESTS, timeout: 120_000 },
  async () => {
    await withClient(null, async (client) => {
      const callResult = await client.callTool({
        name: "delegate.run",
        arguments: {
          task: "Return JSON with summary='ok' and empty arrays for deliverables/open_questions/next_actions.",
          cwd: process.cwd(),
          skills_mode: "none",
        },
      });

      assert.ok(callResult.structuredContent);
      const output = callResult.structuredContent as unknown as DelegateToolOutput;
      assert.ok(output.run_id);
      assert.ok(output.run_dir);
      assert.ok(output.subagent_thread_id === null || typeof output.subagent_thread_id === "string");

      const requestJson = JSON.parse(
        await fs.readFile(path.join(output.run_dir, "request.json"), "utf8"),
      );
      assert.equal(requestJson.tool, "delegate.run");

      await fs.access(path.join(output.run_dir, "skills_index.json"));
      await fs.access(path.join(output.run_dir, "selected_skills.json"));
      await fs.access(path.join(output.run_dir, "subagent_prompt.txt"));
      await fs.access(path.join(output.run_dir, "events.jsonl"));
      await fs.access(path.join(output.run_dir, "stderr.log"));
      await fs.access(path.join(output.run_dir, "last_message.json"));
      await fs.access(path.join(output.run_dir, "result.json"));

      assert.ok(output.run_dir.includes(`${path.sep}delegator${path.sep}runs${path.sep}`));
      await fs.rm(output.run_dir, { recursive: true, force: true });
    });
  },
);

test("delegate.resume creates a run dir and request.json", async () => {
  await withTmpDir("codex-specialized-subagents-test-", async (tmpDir) => {
    const codexHome = path.join(tmpDir, "codex_home");
    await fs.mkdir(codexHome, { recursive: true });

    await withClient(codexHome, async (client) => {
      const toolList = await client.listTools();
      assert.ok(toolList.tools.some((t) => t.name === "delegate.resume"));

      const callResult = await client.callTool({
        name: "delegate.resume",
        arguments: {
          thread_id: "thread-123",
          task: "follow up",
          cwd: process.cwd(),
        },
      });

      assert.ok(callResult.structuredContent);
      const output = callResult.structuredContent as unknown as DelegateToolOutput;
      assert.ok(output.run_id);
      assert.ok(output.run_dir);
      assert.equal(output.subagent_thread_id, "thread-123");

      const requestJson = JSON.parse(
        await fs.readFile(path.join(output.run_dir, "request.json"), "utf8"),
      );
      assert.equal(requestJson.tool, "delegate.resume");
      assert.equal(requestJson.request.thread_id, "thread-123");

      await fs.access(path.join(output.run_dir, "skills_index.json"));
      await fs.access(path.join(output.run_dir, "selected_skills.json"));
    });
  });
});
