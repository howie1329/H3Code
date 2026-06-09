import type { SessionId, UiSessionEvent } from "@h3code/agent-protocol";

export type RuntimeEventListener = (event: UiSessionEvent) => void;

export class RuntimeEventBus {
  readonly #listeners = new Map<SessionId, Set<RuntimeEventListener>>();

  subscribe(sessionId: SessionId, listener: RuntimeEventListener): () => void {
    const listeners = this.#listeners.get(sessionId) ?? new Set<RuntimeEventListener>();
    listeners.add(listener);
    this.#listeners.set(sessionId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(sessionId);
    };
  }

  emit(sessionId: SessionId, event: UiSessionEvent): void {
    for (const listener of this.#listeners.get(sessionId) ?? []) {
      try {
        listener(event);
      } catch {
        // Subscribers should not be able to break runtime event ingestion.
      }
    }
  }
}
