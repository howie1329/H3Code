export const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"];
export const PI_THINKING_LEVEL_LABELS = {
    off: "Off",
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra high",
};
export const PI_THINKING_LEVEL_SHORT_LABELS = {
    off: "Off",
    minimal: "Min",
    low: "Low",
    medium: "Med",
    high: "High",
    xhigh: "XHi",
};
export function normalizeModel(model) {
    if (!model || typeof model !== "object") {
        return undefined;
    }
    const record = model;
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
export function getModelId(model) {
    return model?.id ?? model?.modelId;
}
export function getModelLabel(model) {
    if (!model) {
        return "Unknown";
    }
    return model.name ?? getModelId(model) ?? "Unknown";
}
export function isSameModel(a, b) {
    if (!a || !b) {
        return false;
    }
    const aId = getModelId(a);
    const bId = getModelId(b);
    return Boolean(a.provider && b.provider && aId && bId && a.provider === b.provider && aId === bId);
}
export function findCatalogModel(model, catalog) {
    if (!model) {
        return undefined;
    }
    return catalog.find((entry) => isSameModel(entry, model));
}
/** Session model payloads from setModel may omit `reasoning`; fall back to the model catalog. */
export function mergeModelWithCatalog(model, catalog) {
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
export function modelSupportsThinking(model, catalog = []) {
    if (model?.reasoning === true) {
        return true;
    }
    return findCatalogModel(model, catalog)?.reasoning === true;
}
export function normalizeThinkingLevel(level) {
    if (level && PI_THINKING_LEVELS.includes(level)) {
        return level;
    }
    return "off";
}
export function getThinkingLevelLabel(level) {
    return PI_THINKING_LEVEL_LABELS[normalizeThinkingLevel(level)];
}
export function getThinkingLevelShortLabel(level) {
    return PI_THINKING_LEVEL_SHORT_LABELS[normalizeThinkingLevel(level)];
}
export function groupModelsByProvider(models) {
    const groups = [];
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
//# sourceMappingURL=pi-model.js.map