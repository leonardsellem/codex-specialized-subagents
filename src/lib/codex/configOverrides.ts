export function tomlString(value: string): string {
  return JSON.stringify(value);
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

