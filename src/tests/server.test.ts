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

type AutopilotToolOutput = {
  run_id: string;
  run_dir: string;
  decision: { should_delegate: boolean };
  jobs: Array<{ job_id: string; run_dir: string; subagent_thread_id: string | null }>;
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
      assert.ok(toolList.tools.some((t) => t.name === "delegate.autopilot"));
    });
  });
});

test(
  "delegate.run + delegate.resume run codex exec and write artifacts",
  { skip: !RUN_CODEX_INTEGRATION_TESTS, timeout: 240_000 },
  async () => {
    await withClient(null, async (client) => {
      const runResult = await client.callTool({
        name: "delegate.run",
        arguments: {
          task: "Return JSON with summary='ok' and empty arrays for deliverables/open_questions/next_actions.",
          cwd: process.cwd(),
          skills_mode: "none",
        },
      });

      assert.ok(runResult.structuredContent);
      const runOutput = runResult.structuredContent as unknown as DelegateToolOutput;
      assert.ok(runOutput.run_id);
      assert.ok(runOutput.run_dir);
      assert.ok(typeof runOutput.subagent_thread_id === "string" && runOutput.subagent_thread_id.length > 0);

      const requestJson = JSON.parse(
        await fs.readFile(path.join(runOutput.run_dir, "request.json"), "utf8"),
      );
      assert.equal(requestJson.tool, "delegate.run");

      await fs.access(path.join(runOutput.run_dir, "skills_index.json"));
      await fs.access(path.join(runOutput.run_dir, "selected_skills.json"));
      await fs.access(path.join(runOutput.run_dir, "subagent_prompt.txt"));
      await fs.access(path.join(runOutput.run_dir, "events.jsonl"));
      await fs.access(path.join(runOutput.run_dir, "stderr.log"));
      await fs.access(path.join(runOutput.run_dir, "last_message.json"));
      await fs.access(path.join(runOutput.run_dir, "result.json"));

      const resumeResult = await client.callTool({
        name: "delegate.resume",
        arguments: {
          thread_id: runOutput.subagent_thread_id,
          task: "Return JSON with summary='ok-resume' and empty arrays for deliverables/open_questions/next_actions.",
          cwd: process.cwd(),
          skills_mode: "none",
        },
      });

      assert.ok(resumeResult.structuredContent);
      const resumeOutput = resumeResult.structuredContent as unknown as DelegateToolOutput;
      assert.ok(resumeOutput.run_id);
      assert.ok(resumeOutput.run_dir);

      await fs.access(path.join(resumeOutput.run_dir, "request.json"));
      await fs.access(path.join(resumeOutput.run_dir, "skills_index.json"));
      await fs.access(path.join(resumeOutput.run_dir, "selected_skills.json"));
      await fs.access(path.join(resumeOutput.run_dir, "subagent_prompt.txt"));
      await fs.access(path.join(resumeOutput.run_dir, "events.jsonl"));
      await fs.access(path.join(resumeOutput.run_dir, "stderr.log"));
      await fs.access(path.join(resumeOutput.run_dir, "last_message.json"));
      await fs.access(path.join(resumeOutput.run_dir, "result.json"));

      assert.ok(runOutput.run_dir.includes(`${path.sep}delegator${path.sep}runs${path.sep}`));
      assert.ok(resumeOutput.run_dir.includes(`${path.sep}delegator${path.sep}runs${path.sep}`));
      await fs.rm(runOutput.run_dir, { recursive: true, force: true });
      await fs.rm(resumeOutput.run_dir, { recursive: true, force: true });

      const autopilotResult = await client.callTool({
        name: "delegate.autopilot",
        arguments: {
          task: "This is a cross-cutting request involving tests and README. Do not change files. Return JSON with summary='ok-autopilot' and empty arrays for deliverables/open_questions/next_actions.",
          cwd: process.cwd(),
          sandbox: "read-only",
          skills_mode: "none",
          include_repo_skills: false,
          include_global_skills: false,
          max_agents: 1,
          max_parallel: 1,
        },
      });

      assert.ok(autopilotResult.structuredContent);
      const autopilotOutput = autopilotResult.structuredContent as unknown as AutopilotToolOutput;
      assert.ok(autopilotOutput.run_id);
      assert.ok(autopilotOutput.run_dir);
      assert.equal(autopilotOutput.decision.should_delegate, true);
      assert.equal(autopilotOutput.jobs.length, 1);

      await fs.access(path.join(autopilotOutput.run_dir, "request.json"));
      await fs.access(path.join(autopilotOutput.run_dir, "skills_index.json"));
      await fs.access(path.join(autopilotOutput.run_dir, "autopilot_decision.json"));
      await fs.access(path.join(autopilotOutput.run_dir, "autopilot_plan.json"));
      await fs.access(path.join(autopilotOutput.run_dir, "autopilot_aggregate.json"));

      const job = autopilotOutput.jobs[0]!;
      await fs.access(path.join(job.run_dir, "request.json"));
      await fs.access(path.join(job.run_dir, "selected_skills.json"));
      await fs.access(path.join(job.run_dir, "subagent_prompt.txt"));
      await fs.access(path.join(job.run_dir, "events.jsonl"));
      await fs.access(path.join(job.run_dir, "stderr.log"));
      await fs.access(path.join(job.run_dir, "last_message.json"));
      await fs.access(path.join(job.run_dir, "result.json"));

      await fs.rm(autopilotOutput.run_dir, { recursive: true, force: true });
    });
  },
);
