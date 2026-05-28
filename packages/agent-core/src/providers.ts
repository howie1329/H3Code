import type { ProviderCapabilities } from "./capabilities.js";
import type { SessionDomainEvent } from "./events.js";
import type { ProviderId, RunRef, SessionRef } from "./ids.js";
import type { ProviderUiResponse } from "./provider-ui.js";
import type { MessageInput, NewSessionOptions, SessionSnapshot, SessionSummary } from "./sessions.js";

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  capabilities: ProviderCapabilities;
}

export interface ConnectContext {
  repoPath: string;
  sessionRef?: SessionRef;
}

export interface ProviderConnection {
  providerId: ProviderId;
  sessionRef?: SessionRef;
}

export interface AgentProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  connect(ctx: ConnectContext): Promise<ProviderConnection>;
  disconnect(connection: ProviderConnection): Promise<void>;

  sendMessage(connection: ProviderConnection, input: MessageInput): Promise<void>;
  abort(connection: ProviderConnection, runRef?: RunRef): Promise<void>;
  setModel?(connection: ProviderConnection, model: unknown): Promise<void>;
  setThinkingLevel?(connection: ProviderConnection, level: string): Promise<void>;
  respondToUiRequest?(connection: ProviderConnection, response: ProviderUiResponse): Promise<void>;

  listSessions?(connection: ProviderConnection): Promise<SessionSummary[]>;
  switchSession?(connection: ProviderConnection, sessionRef: SessionRef): Promise<SessionSnapshot>;
  createSession?(connection: ProviderConnection, options?: NewSessionOptions): Promise<SessionSnapshot>;
  forkSession?(connection: ProviderConnection, entryId: string, position?: "before" | "at"): Promise<SessionSnapshot>;
  importSession?(connection: ProviderConnection, inputPath: string, cwdOverride?: string): Promise<SessionSnapshot>;
  getSnapshot?(connection: ProviderConnection): Promise<SessionSnapshot>;

  subscribe(connection: ProviderConnection, onEvent: (event: SessionDomainEvent) => void): () => void;
}
