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

test("runAutopilot writes parent artifacts and does not spawn codex when should_delegate=false", async () => {
  await withTmpDir("codex-specialized-subagents-autopilot-", async (tmpDir) => {
    const codexHome = path.join(tmpDir, "codex_home");
    const env = { ...process.env, CODEX_HOME: codexHome };

    let codexExecCalls = 0;

    const result = await runAutopilot(
      {
        task: "What does the delegate.run tool do?",
        include_repo_skills: false,
        include_global_skills: false,
        skills_mode: "none",
      },
      {
        env,
        deps: {
          runCodexExec: async () => {
            codexExecCalls++;
            throw new Error("runCodexExec should not be called");
          },
          discoverSkills: async () => ({ roots: {}, skills: [] }),
        },
      },
    );

    assert.equal(codexExecCalls, 0);
    assert.equal(result.decision.should_delegate, false);
    assert.equal(result.jobs.length, 0);

    await fs.access(path.join(result.run_dir, "request.json"));
    await fs.access(path.join(result.run_dir, "skills_index.json"));
    await fs.access(path.join(result.run_dir, "autopilot_decision.json"));
    await fs.access(path.join(result.run_dir, "autopilot_plan.json"));
    await fs.access(path.join(result.run_dir, "autopilot_aggregate.json"));
  });
});

