import path from "node:path";
import { AuthStorage, getAgentDir, ModelRegistry, type AuthStorage as PiAuthStorage } from "@earendil-works/pi-coding-agent";
import type { ProviderModel } from "./types.js";

type PiSdkModel = {
  id: string;
  provider?: string;
  name?: string;
  reasoning?: boolean;
};

export type PiModelRegistryLike = {
  getAvailable(): PiSdkModel[] | Promise<PiSdkModel[]>;
  refresh?(): void | Promise<void>;
};

export async function listPiModels(modelRegistry: PiModelRegistryLike): Promise<ProviderModel[]> {
  const models = await modelRegistry.getAvailable();

  return models.map((model) => ({
    id: model.id,
    provider: model.provider,
    name: model.name,
    modelId: model.id,
    reasoning: model.reasoning === true,
  }));
}

export async function discoverPiModels(options: {
  agentDir?: string;
  authStorage?: PiAuthStorage;
  modelRegistry?: PiModelRegistryLike;
} = {}): Promise<ProviderModel[]> {
  const agentDir = options.agentDir || getAgentDir();
  const authStorage = options.authStorage ?? AuthStorage.create(path.join(agentDir, "auth.json"));
  const modelRegistry = options.modelRegistry ?? ModelRegistry.create(authStorage, path.join(agentDir, "models.json"));

  await modelRegistry.refresh?.();
  return listPiModels(modelRegistry);
}
