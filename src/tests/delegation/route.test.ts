import assert from "node:assert/strict";
import test from "node:test";

import { routeAutopilotTask } from "../../lib/delegation/route.js";

test("routeAutopilotTask does not delegate for a simple question", () => {
  const routed = routeAutopilotTask({
    task: "What does the delegate.run tool do?",
    sandbox: "workspace-write",
    max_agents: 3,
    max_parallel: 2,
    role: "specialist",
    skills_mode: "auto",
    max_skills: 6,
    include_repo_skills: true,
    include_global_skills: true,
    skip_git_repo_check: false,
  });

  assert.equal(routed.decision.should_delegate, false);
  assert.equal(routed.plan.jobs.length, 0);
});

test("routeAutopilotTask delegates for cross-cutting implementation requests", () => {
  const routed = routeAutopilotTask({
    task: "Refactor the MCP server to add delegate.autopilot and update tests + README.",
    sandbox: "workspace-write",
    max_agents: 3,
    max_parallel: 2,
    role: "specialist",
    skills_mode: "auto",
    max_skills: 6,
    include_repo_skills: true,
    include_global_skills: true,
    skip_git_repo_check: false,
  });

  assert.equal(routed.decision.should_delegate, true);
  assert.ok(routed.decision.reason.length > 0);
  assert.ok(routed.plan.jobs.length >= 2);

  const ids = routed.plan.jobs.map((j) => j.id);
  assert.deepEqual(ids, ["scan", "implement", "verify"]);

  assert.equal(routed.plan.jobs[0]?.thinking_level, "low");
  assert.equal(routed.plan.jobs[1]?.thinking_level, "high");
  assert.equal(routed.plan.jobs[2]?.thinking_level, "low");
});
