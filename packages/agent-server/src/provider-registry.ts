import type { AgentProvider, ProviderDescriptor, ProviderId } from "@h3code/agent-core";

export class ProviderRegistry {
  readonly #providers = new Map<ProviderId, AgentProvider>();

  register(provider: AgentProvider) {
    this.#providers.set(provider.id, provider);
  }

  get(providerId: ProviderId) {
    return this.#providers.get(providerId);
  }

  descriptors(): ProviderDescriptor[] {
    return [...this.#providers.values()].map((provider) => ({
      id: provider.id,
      label: provider.id,
      capabilities: provider.capabilities,
    }));
  }
}
