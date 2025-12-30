export function tomlString(value: string): string {
  return JSON.stringify(value);
}

function hasExplicitModelReasoningEffortOverride(configOverrides: string[] | undefined): boolean {
  if (!configOverrides || configOverrides.length === 0) return false;
  return configOverrides.some((override) => /^model_reasoning_effort\s*=/.test(override.trimStart()));
}

export function buildCodexConfigOverrides(input: {
  model?: string;
  config_overrides?: string[];
  reasoning_effort?: string;
}): string[] | undefined {
  const overrides: string[] = [];

  const model = input.model?.trim();
  if (model) overrides.push(`model=${tomlString(model)}`);

  if (input.config_overrides && input.config_overrides.length > 0) {
    overrides.push(...input.config_overrides);
  }

  const reasoningEffort = input.reasoning_effort?.trim();
  if (reasoningEffort) overrides.push(`model_reasoning_effort=${tomlString(reasoningEffort)}`);

  return overrides.length > 0 ? overrides : undefined;
}

export function buildDelegateCodexConfigOverrides(
  input: {
    model?: string;
    config_overrides?: string[];
    reasoning_effort?: string;
  },
  env: Record<string, string | undefined>,
): string[] | undefined {
  const reasoningEffort = input.reasoning_effort?.trim();
  const defaultReasoningEffort = env.CODEX_DELEGATE_REASONING_EFFORT?.trim();

  const resolvedReasoningEffort =
    reasoningEffort ||
    (defaultReasoningEffort && !hasExplicitModelReasoningEffortOverride(input.config_overrides)
      ? defaultReasoningEffort
      : undefined);

  return buildCodexConfigOverrides({ ...input, reasoning_effort: resolvedReasoningEffort });
}
