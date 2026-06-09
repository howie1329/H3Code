export class AgentRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}

export const runtimeErrors = {
  providerNotFound: (providerId: string) => new AgentRuntimeError("provider_not_found", `Provider not found: ${providerId}`),
  duplicateProvider: (providerId: string) => new AgentRuntimeError("duplicate_provider", `Provider already registered: ${providerId}`),
  sessionNotFound: (sessionId: string) => new AgentRuntimeError("session_not_found", `Session not found: ${sessionId}`),
  invalidRuntimeEvent: (type: string, sessionId: string) => new AgentRuntimeError("invalid_runtime_event", `Runtime event ${type} cannot be applied before session start: ${sessionId}`),
  unsupportedCommand: (type: string) => new AgentRuntimeError("unsupported_command", `Unsupported command: ${type}`),
};
