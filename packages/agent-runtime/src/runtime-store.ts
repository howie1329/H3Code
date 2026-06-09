import type { ProviderRuntime, RuntimeBinding, RuntimeEvent, SessionId, SessionReadModel } from "@h3code/agent-protocol";

export class InMemoryRuntimeStore {
  readonly #bindings = new Map<SessionId, RuntimeBinding>();
  readonly #providerRuntimes = new Map<SessionId, ProviderRuntime>();
  readonly #readModels = new Map<SessionId, SessionReadModel>();
  readonly #events = new Map<SessionId, RuntimeEvent[]>();

  getBinding(sessionId: SessionId): RuntimeBinding | undefined {
    return this.#bindings.get(sessionId);
  }

  setBinding(binding: RuntimeBinding): void {
    this.#bindings.set(binding.sessionId, binding);
  }

  listBindings(): RuntimeBinding[] {
    return [...this.#bindings.values()];
  }

  getProviderRuntime(sessionId: SessionId): ProviderRuntime | undefined {
    return this.#providerRuntimes.get(sessionId);
  }

  setProviderRuntime(sessionId: SessionId, runtime: ProviderRuntime): void {
    this.#providerRuntimes.set(sessionId, runtime);
  }

  listProviderRuntimes(): Array<[SessionId, ProviderRuntime]> {
    return [...this.#providerRuntimes.entries()];
  }

  findBindingByProviderSessionRef(providerSessionRef: string): RuntimeBinding | undefined {
    for (const binding of this.#bindings.values()) {
      if (binding.providerSessionRef === providerSessionRef) {
        return binding;
      }
    }

    return undefined;
  }

  getReadModel(sessionId: SessionId): SessionReadModel | undefined {
    return this.#readModels.get(sessionId);
  }

  setReadModel(session: SessionReadModel): void {
    this.#readModels.set(session.id, session);
  }

  appendRuntimeEvent(event: RuntimeEvent): void {
    const events = this.#events.get(event.sessionId) ?? [];
    events.push(event);
    this.#events.set(event.sessionId, events);
  }

  deleteSession(sessionId: SessionId): void {
    this.#bindings.delete(sessionId);
    this.#providerRuntimes.delete(sessionId);
    this.#readModels.delete(sessionId);
    this.#events.delete(sessionId);
  }
}
