import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runAutopilot } from "../../lib/delegation/autopilot.js";

async function withTmpDir<T>(prefix: string, fn: (tmpDir: string) => Promise<T>): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

test("runAutopilot resolves per-job model overrides from env", async () => {
  await withTmpDir("codex-specialized-subagents-autopilot-models-", async (tmpDir) => {
    const codexHome = path.join(tmpDir, "codex_home");
    const env = {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_AUTOPILOT_MODEL_LOW: "low-model",
      CODEX_AUTOPILOT_MODEL_HIGH: "high-model",
    };

    const codexExecCalls: Array<{ runDir: string; configOverrides: string[]; codexHome: string | undefined }> = [];

    const result = await runAutopilot(
      {
        task: "Refactor the MCP server to add delegate_autopilot and update tests + README.",
        include_repo_skills: false,
        include_global_skills: false,
        skills_mode: "none",
        max_agents: 3,
        max_parallel: 2,
        sandbox: "read-only",
      },
      {
        env,
        deps: {
          discoverSkills: async () => ({ roots: {}, skills: [] }),
          runCodexExec: async (options) => {
            codexExecCalls.push({
              runDir: options.runDir,
              configOverrides: options.configOverrides ?? [],
              codexHome: options.env?.CODEX_HOME,
            });

            const now = new Date();
            const lastMessagePath = path.join(options.runDir, "last_message.json");
            await fs.mkdir(options.runDir, { recursive: true });
            await fs.writeFile(
              lastMessagePath,
              JSON.stringify(
                { summary: "ok", deliverables: [], open_questions: [], next_actions: [] },
                null,
                2,
              ) + "\n",
            );

            return {
              started_at: now.toISOString(),
              finished_at: now.toISOString(),
              duration_ms: 0,
              cancelled: false,
              exit_code: 0,
              signal: null,
              thread_id: null,
              artifacts: {
                subagent_output_schema_path: path.join(options.runDir, "subagent_output.schema.json"),
                events_path: path.join(options.runDir, "events.jsonl"),
                stderr_path: path.join(options.runDir, "stderr.log"),
                last_message_path: lastMessagePath,
                thread_path: path.join(options.runDir, "thread.json"),
                result_path: path.join(options.runDir, "result.json"),
              },
              error: null,
            };
          },
        },
      },
    );

    assert.equal(result.decision.should_delegate, true);

    assert.equal(result.plan.jobs.length, 3);
    const scan = result.plan.jobs.find((j) => j.id === "scan");
    const implement = result.plan.jobs.find((j) => j.id === "implement");
    const verify = result.plan.jobs.find((j) => j.id === "verify");

    assert.equal(scan?.thinking_level, "low");
    assert.equal(scan?.model, "low-model");
    assert.deepEqual(scan?.config_overrides, ["model=low-model"]);

    assert.equal(implement?.thinking_level, "high");
    assert.equal(implement?.model, "high-model");
    assert.deepEqual(implement?.config_overrides, ["model=high-model"]);

    assert.equal(verify?.thinking_level, "low");
    assert.equal(verify?.model, "low-model");
    assert.deepEqual(verify?.config_overrides, ["model=low-model"]);

    assert.equal(codexExecCalls.length, 3);
    for (const call of codexExecCalls) {
      assert.equal(call.codexHome, codexHome);
    }

    const scanCall = codexExecCalls.find((c) => c.runDir.endsWith(`${path.sep}subruns${path.sep}scan`));
    const implementCall = codexExecCalls.find((c) =>
      c.runDir.endsWith(`${path.sep}subruns${path.sep}implement`),
    );
    const verifyCall = codexExecCalls.find((c) => c.runDir.endsWith(`${path.sep}subruns${path.sep}verify`));

    assert.deepEqual(scanCall?.configOverrides, ["model=low-model"]);
    assert.deepEqual(implementCall?.configOverrides, ["model=high-model"]);
    assert.deepEqual(verifyCall?.configOverrides, ["model=low-model"]);

    const scanRequest = JSON.parse(
      await fs.readFile(path.join(result.run_dir, "subruns", "scan", "request.json"), "utf8"),
    ) as { job?: Record<string, unknown> };
    assert.equal(scanRequest.job?.thinking_level, "low");
    assert.equal(scanRequest.job?.model, "low-model");
    assert.deepEqual(scanRequest.job?.config_overrides, ["model=low-model"]);
  });
});

