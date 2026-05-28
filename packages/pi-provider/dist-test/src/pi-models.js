export function listPiModels(modelRegistry) {
    return modelRegistry.getAvailable().map((model) => ({
        id: model.id,
        provider: model.provider,
        name: model.name,
        modelId: model.id,
        reasoning: model.reasoning === true,
    }));
}
//# sourceMappingURL=pi-models.js.map