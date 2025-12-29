import assert from "node:assert/strict";
import test from "node:test";

import { runJobs } from "../../lib/delegation/runJobs.js";

test("runJobs respects maxParallel", async () => {
  const jobs = Array.from({ length: 6 }, (_, i) => ({ id: i }));
  let active = 0;
  let maxActive = 0;

  const result = await runJobs(jobs, {
    maxParallel: 2,
    runJob: async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return "ok";
    },
  });

  assert.equal(maxActive, 2);
  assert.equal(result.results.length, jobs.length);
  assert.ok(result.results.every((r) => r.status === "completed"));
});

test("runJobs stops starting new jobs after abort", async () => {
  const controller = new AbortController();
  const jobs = Array.from({ length: 5 }, (_, i) => ({ id: i }));
  let started = 0;

  const result = await runJobs(jobs, {
    maxParallel: 1,
    signal: controller.signal,
    runJob: async () => {
      started++;
      controller.abort();
      await new Promise((r) => setTimeout(r, 10));
      return "ok";
    },
  });

  assert.equal(started, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.results.length, jobs.length);
  assert.equal(result.results[0]?.status, "completed");
  assert.ok(result.results.slice(1).every((r) => r.status === "skipped"));
});

