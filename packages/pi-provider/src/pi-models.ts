import type { ProviderModel } from "@h3code/agent-core";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

export function listPiModels(modelRegistry: ModelRegistry): ProviderModel[] {
  return modelRegistry.getAvailable().map((model) => ({
    id: model.id,
    provider: model.provider,
    name: model.name,
    modelId: model.id,
    reasoning: model.reasoning === true,
  }));
}
