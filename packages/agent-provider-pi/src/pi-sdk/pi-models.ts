import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { ProviderModel } from "./types.js";

export function listPiModels(modelRegistry: ModelRegistry): ProviderModel[] {
  return modelRegistry.getAvailable().map((model) => ({
    id: model.id,
    provider: model.provider,
    name: model.name,
    modelId: model.id,
    reasoning: model.reasoning === true,
  }));
}
