export const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const satisfies readonly PiThinkingLevel[];

export const PI_THINKING_LEVEL_LABELS: Record<PiThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

export const PI_THINKING_LEVEL_SHORT_LABELS: Record<PiThinkingLevel, string> = {
  off: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "XHi",
};

export function normalizeModel(model: unknown): PiModel | undefined {
  if (!model || typeof model !== "object") {
    return undefined;
  }

  const record = model as Record<string, unknown>;
  const provider = typeof record.provider === "string" ? record.provider : "";
  const id = typeof record.id === "string" ? record.id : typeof record.modelId === "string" ? record.modelId : "";

  if (!provider || !id) {
    return undefined;
  }

  return {
    id,
    provider,
    modelId: typeof record.modelId === "string" ? record.modelId : id,
    name: typeof record.name === "string" ? record.name : undefined,
    reasoning: record.reasoning === true,
  };
}

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

export function findCatalogModel(model: PiModel | undefined, catalog: PiModel[]) {
  if (!model) {
    return undefined;
  }

  return catalog.find((entry) => isSameModel(entry, model));
}

/** Session model payloads from setModel may omit `reasoning`; fall back to the model catalog. */
export function mergeModelWithCatalog(model: unknown, catalog: PiModel[]): PiModel | undefined {
  const normalized = normalizeModel(model);

  if (!normalized) {
    return undefined;
  }

  const catalogEntry = findCatalogModel(normalized, catalog);

  if (!catalogEntry) {
    return normalized;
  }

  return {
    ...normalized,
    name: normalized.name ?? catalogEntry.name,
    reasoning: normalized.reasoning === true || catalogEntry.reasoning === true,
  };
}

export function modelSupportsThinking(model: PiModel | undefined, catalog: PiModel[] = []) {
  if (model?.reasoning === true) {
    return true;
  }

  return findCatalogModel(model, catalog)?.reasoning === true;
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

export function getThinkingLevelShortLabel(level: string | undefined) {
  return PI_THINKING_LEVEL_SHORT_LABELS[normalizeThinkingLevel(level)];
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
