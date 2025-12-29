import assert from "node:assert/strict";
import test from "node:test";

import { AutopilotInputSchema, AutopilotToolOutputSchema } from "../../lib/delegation/types.js";

test("AutopilotInputSchema applies defaults", () => {
  const parsed = AutopilotInputSchema.parse({ task: "Do the thing" });
  assert.equal(parsed.task, "Do the thing");
  assert.equal(parsed.sandbox, "workspace-write");
  assert.equal(parsed.skills_mode, "auto");
  assert.equal(parsed.max_skills, 6);
  assert.equal(parsed.include_repo_skills, true);
  assert.equal(parsed.include_global_skills, true);
  assert.equal(parsed.max_agents, 3);
  assert.equal(parsed.max_parallel, 2);
});

test("AutopilotToolOutputSchema accepts a minimal completed payload", () => {
  const parsed = AutopilotToolOutputSchema.parse({
    run_id: "2025-12-29_000000_abcdef",
    run_dir: "/tmp/codex/delegator/runs/2025-12-29_000000_abcdef",
    decision: { should_delegate: false, reason: "Simple request" },
    plan: { jobs: [] },
    jobs: [],
    aggregate: { summary: "No delegation needed.", deliverables: [], open_questions: [], next_actions: [] },
    artifacts: [],
    timing: {
      started_at: "2025-12-29T00:00:00.000Z",
      finished_at: "2025-12-29T00:00:01.000Z",
      duration_ms: 1000,
    },
    status: "completed",
    error: null,
  });

  assert.equal(parsed.status, "completed");
  assert.equal(parsed.decision.should_delegate, false);
});

