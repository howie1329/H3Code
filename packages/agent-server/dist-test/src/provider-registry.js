export class ProviderRegistry {
    #providers = new Map();
    register(provider) {
        this.#providers.set(provider.id, provider);
    }
    get(providerId) {
        return this.#providers.get(providerId);
    }
    descriptors() {
        return [...this.#providers.values()].map((provider) => ({
            id: provider.id,
            label: provider.id,
            capabilities: provider.capabilities,
        }));
    }
}
//# sourceMappingURL=provider-registry.js.map