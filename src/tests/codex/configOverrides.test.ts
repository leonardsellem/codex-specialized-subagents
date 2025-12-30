import assert from "node:assert/strict";
import test from "node:test";

import { buildCodexConfigOverrides } from "../../lib/codex/configOverrides.js";

test("buildCodexConfigOverrides returns undefined when no overrides provided", () => {
  assert.equal(buildCodexConfigOverrides({}), undefined);
});

test("buildCodexConfigOverrides trims and appends reasoning_effort", () => {
  assert.deepEqual(
    buildCodexConfigOverrides({
      reasoning_effort: "  xhigh  ",
    }),
    ['model_reasoning_effort="xhigh"'],
  );
});

test("buildCodexConfigOverrides orders model < config_overrides < reasoning_effort", () => {
  assert.deepEqual(
    buildCodexConfigOverrides({
      model: "  gpt-5  ",
      config_overrides: ['model_reasoning_effort="low"', 'temperature="0.2"'],
      reasoning_effort: "high",
    }),
    ['model="gpt-5"', 'model_reasoning_effort="low"', 'temperature="0.2"', 'model_reasoning_effort="high"'],
  );
});

