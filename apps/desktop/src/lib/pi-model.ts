export const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const satisfies readonly PiThinkingLevel[];

export const PI_THINKING_LEVEL_LABELS: Record<PiThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

export function getModelId(model: PiModel | undefined) {
  return model?.id ?? model?.modelId;
}

export function getModelLabel(model: PiModel | undefined) {
  if (!model) {
    return "Unknown";
  }

  return model.name ?? getModelId(model) ?? "Unknown";
}

export function isSameModel(a: PiModel | undefined, b: PiModel | undefined) {
  if (!a || !b) {
    return false;
  }

  const aId = getModelId(a);
  const bId = getModelId(b);

  return Boolean(a.provider && b.provider && aId && bId && a.provider === b.provider && aId === bId);
}

export function modelSupportsThinking(model: PiModel | undefined) {
  return model?.reasoning === true;
}

export function normalizeThinkingLevel(level: string | undefined): PiThinkingLevel {
  if (level && PI_THINKING_LEVELS.includes(level as PiThinkingLevel)) {
    return level as PiThinkingLevel;
  }

  return "off";
}

export function getThinkingLevelLabel(level: string | undefined) {
  return PI_THINKING_LEVEL_LABELS[normalizeThinkingLevel(level)];
}

export function groupModelsByProvider(models: PiModel[]) {
  const groups: Array<{ provider: string; models: PiModel[] }> = [];

  for (const model of models) {
    const lastGroup = groups.at(-1);

    if (lastGroup?.provider === model.provider) {
      lastGroup.models.push(model);
      continue;
    }

    groups.push({ provider: model.provider, models: [model] });
  }

  return groups;
}
