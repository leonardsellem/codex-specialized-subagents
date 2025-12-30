import assert from "node:assert/strict";
import test from "node:test";

import { formatAutopilotToolContent, formatDelegateToolContent } from "../../lib/mcp/formatToolContent.js";
import { AutopilotToolOutputSchema } from "../../lib/delegation/types.js";

test("formatDelegateToolContent includes required headers and debug pointers", () => {
  const out = {
    run_dir: "/tmp/run",
    subagent_thread_id: "thread-123",
    summary: "Delegated run finished.",
    deliverables: [],
    open_questions: [],
    next_actions: ["Run npm test", "Run npm run build"],
    artifacts: [{ name: "last_message.json", path: "/tmp/run/last_message.json" }],
    timing: { duration_ms: 123 },
    status: "completed" as const,
    error: null,
  };

  const text = formatDelegateToolContent("delegate_run", out);

  assert.match(text, /^delegate_run\n/);
  assert.ok(text.includes("status: completed (123ms)"));
  assert.ok(text.includes("run_dir: /tmp/run"));
  assert.ok(text.includes("subagent_thread_id: thread-123"));
  assert.ok(text.includes("Debug pointers:"));
  assert.ok(text.includes("- last_message.json: /tmp/run/last_message.json"));
  assert.ok(text.includes("- Run npm test"));
  assert.ok(text.includes("- Run npm run build"));
  assert.ok(!text.includes("stderr.log:"));
  assert.ok(!text.includes("result.json:"));
});

test("formatDelegateToolContent truncates list sections deterministically", () => {
  const out = {
    run_dir: "/tmp/run",
    subagent_thread_id: null,
    summary: "ok",
    deliverables: Array.from({ length: 7 }, (_, i) => ({
      path: `deliverable-${i}.txt`,
      description: `desc-${i}`,
    })),
    open_questions: [],
    next_actions: [],
    artifacts: [{ name: "last_message.json", path: "/tmp/run/last_message.json" }],
    timing: { duration_ms: null },
    status: "completed" as const,
    error: null,
  };

  const text = formatDelegateToolContent("delegate_run", out);
  assert.ok(text.includes("deliverables (7):"));
  assert.ok(text.includes("... (+2 more)"));
  assert.ok(text.includes("- deliverable-0.txt — desc-0"));
  assert.ok(!text.includes("deliverable-6.txt"));
});

test("formatDelegateToolContent includes stderr/result pointers on failure", () => {
  const out = {
    run_dir: "/tmp/run",
    subagent_thread_id: null,
    summary: "failed",
    deliverables: [],
    open_questions: [],
    next_actions: ["Inspect run_dir artifacts"],
    artifacts: [
      { name: "last_message.json", path: "/tmp/run/last_message.json" },
      { name: "stderr.log", path: "/tmp/run/stderr.log" },
      { name: "result.json", path: "/tmp/run/result.json" },
    ],
    timing: { duration_ms: 50 },
    status: "failed" as const,
    error: "boom",
  };

  const text = formatDelegateToolContent("delegate_run", out);
  assert.ok(text.includes("status: failed (50ms)"));
  assert.ok(text.includes("- stderr.log: /tmp/run/stderr.log"));
  assert.ok(text.includes("- result.json: /tmp/run/result.json"));
});

test("formatAutopilotToolContent includes Autopilot plan + per-subrun summaries", () => {
  const out = AutopilotToolOutputSchema.parse({
    run_id: "2025-12-30_000000_abcdef",
    run_dir: "/tmp/autopilot",
    decision: { should_delegate: true, reason: "Needs multiple steps." },
    plan: {
      jobs: [
        {
          id: "scan",
          title: "Repo scan",
          thinking_level: "low",
          task: "Scan repo",
          sandbox: "read-only",
        },
      ],
    },
    jobs: [
      {
        job_id: "scan",
        title: "Repo scan",
        run_dir: "/tmp/autopilot/subruns/scan",
        subagent_thread_id: "thread-scan",
        selected_skills: [],
        summary: "ok",
        deliverables: [],
        open_questions: [],
        next_actions: [],
        artifacts: [{ name: "last_message.json", path: "/tmp/autopilot/subruns/scan/last_message.json" }],
        timing: {
          started_at: "2025-12-30T00:00:00.000Z",
          finished_at: "2025-12-30T00:00:00.010Z",
          duration_ms: 10,
        },
        status: "completed",
        error: null,
      },
    ],
    aggregate: { summary: "All done.", deliverables: [], open_questions: [], next_actions: [] },
    artifacts: [],
    timing: {
      started_at: "2025-12-30T00:00:00.000Z",
      finished_at: "2025-12-30T00:00:00.020Z",
      duration_ms: 20,
    },
    status: "completed",
    error: null,
  });

  const text = formatAutopilotToolContent(out);

  assert.ok(text.includes("Autopilot plan:"));
  assert.ok(text.includes("thinking_level=low"));
  assert.ok(text.includes("sandbox=read-only"));
  assert.ok(text.includes("skills_mode=auto"));
  assert.ok(text.includes("max_skills=6"));
  assert.ok(text.includes("Subruns:"));
  assert.ok(text.includes("last_message.json: /tmp/autopilot/subruns/scan/last_message.json"));
});
