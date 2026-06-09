import type { ProviderModel } from "@h3code/agent-protocol";

export type { ProviderModel };

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

export const THINKING_LEVEL_SHORT_LABELS: Record<ThinkingLevel, string> = {
  off: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "XHi",
};

export function normalizeModel(model: unknown): ProviderModel | undefined {
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

export function getModelId(model: ProviderModel | undefined) {
  return model?.id ?? model?.modelId;
}

export function getModelLabel(model: ProviderModel | undefined) {
  if (!model) {
    return "Unknown";
  }

  return model.name ?? getModelId(model) ?? "Unknown";
}

export function isSameModel(a: ProviderModel | undefined, b: ProviderModel | undefined) {
  if (!a || !b) {
    return false;
  }

  const aId = getModelId(a);
  const bId = getModelId(b);

  return Boolean(a.provider && b.provider && aId && bId && a.provider === b.provider && aId === bId);
}

export function findCatalogModel(model: ProviderModel | undefined, catalog: ProviderModel[]) {
  if (!model) {
    return undefined;
  }

  return catalog.find((entry) => isSameModel(entry, model));
}

export function mergeModelWithCatalog(model: unknown, catalog: ProviderModel[]): ProviderModel | undefined {
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

export function modelSupportsThinking(model: ProviderModel | undefined, catalog: ProviderModel[] = []) {
  if (model?.reasoning === true) {
    return true;
  }

  return findCatalogModel(model, catalog)?.reasoning === true;
}

export function normalizeThinkingLevel(level: string | undefined): ThinkingLevel {
  if (level && THINKING_LEVELS.includes(level as ThinkingLevel)) {
    return level as ThinkingLevel;
  }

  return "off";
}

export function getThinkingLevelLabel(level: string | undefined) {
  return THINKING_LEVEL_LABELS[normalizeThinkingLevel(level)];
}

export function getThinkingLevelShortLabel(level: string | undefined) {
  return THINKING_LEVEL_SHORT_LABELS[normalizeThinkingLevel(level)];
}

export function groupModelsByProvider(models: ProviderModel[]) {
  const groups: Array<{ provider: string; models: ProviderModel[] }> = [];

  for (const model of models) {
    const provider = model.provider ?? "unknown";
    const lastGroup = groups.at(-1);

    if (lastGroup?.provider === provider) {
      lastGroup.models.push(model);
      continue;
    }

    groups.push({ provider, models: [model] });
  }

  return groups;
}
