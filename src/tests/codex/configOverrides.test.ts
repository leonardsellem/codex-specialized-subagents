import assert from "node:assert/strict";
import test from "node:test";

import { buildCodexConfigOverrides, buildDelegateCodexConfigOverrides } from "../../lib/codex/configOverrides.js";

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

test("buildDelegateCodexConfigOverrides applies CODEX_DELEGATE_REASONING_EFFORT default", () => {
  assert.deepEqual(
    buildDelegateCodexConfigOverrides(
      {
        model: "gpt-5",
      },
      { CODEX_DELEGATE_REASONING_EFFORT: "high" },
    ),
    ['model="gpt-5"', 'model_reasoning_effort="high"'],
  );
});

test("buildDelegateCodexConfigOverrides does not override explicit reasoning_effort", () => {
  assert.deepEqual(
    buildDelegateCodexConfigOverrides(
      {
        reasoning_effort: "low",
      },
      { CODEX_DELEGATE_REASONING_EFFORT: "high" },
    ),
    ['model_reasoning_effort="low"'],
  );
});

test("buildDelegateCodexConfigOverrides does not override explicit model_reasoning_effort in config_overrides", () => {
  assert.deepEqual(
    buildDelegateCodexConfigOverrides(
      {
        config_overrides: ['model_reasoning_effort="xhigh"'],
      },
      { CODEX_DELEGATE_REASONING_EFFORT: "high" },
    ),
    ['model_reasoning_effort="xhigh"'],
  );
});
