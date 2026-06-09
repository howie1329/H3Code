import type { ProviderAdapter, ProviderDescriptor, ProviderId } from "@h3code/agent-protocol";
import { runtimeErrors } from "./errors.js";

export class ProviderRegistry {
  readonly #providers = new Map<ProviderId, ProviderAdapter>();

  constructor(providers: ProviderAdapter[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: ProviderAdapter): void {
    const id = provider.descriptor.id;
    if (this.#providers.has(id)) throw runtimeErrors.duplicateProvider(id);
    this.#providers.set(id, provider);
  }

  get(providerId: ProviderId): ProviderAdapter {
    const provider = this.#providers.get(providerId);
    if (!provider) throw runtimeErrors.providerNotFound(providerId);
    return provider;
  }

  descriptors(): ProviderDescriptor[] {
    return [...this.#providers.values()].map((provider) => provider.descriptor);
  }
}
