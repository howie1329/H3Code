import type { ProviderUiRequest, ProviderUiResponse } from "./provider-ui.js";
import type { SessionDomainEvent } from "./events.js";
import type { ConnectionId, ProviderId, RequestId, RunRef, SessionRef } from "./ids.js";
import type { DesktopSettings, PreferencesSnapshot } from "./metadata.js";
import type { ProviderDescriptor } from "./providers.js";
import type { ConnectionState, MessageMode, NewSessionOptions, SessionSnapshot, SessionSummary } from "./sessions.js";
import type { WorkspaceDiffSummary } from "./workspace.js";

export const AGENT_CORE_PROTOCOL_VERSION = 1;

export type ClientToServerMessage =
  | {
      type: "workspace.connect";
      id: RequestId;
      providerId: ProviderId;
      repoPath: string;
      sessionRef?: SessionRef;
    }
  | { type: "workspace.disconnect"; id: RequestId; connectionId: ConnectionId }
  | {
      type: "session.list";
      id: RequestId;
      providerId?: ProviderId;
      repoPath?: string;
      markRecent?: boolean;
    }
  | { type: "preferences.get"; id: RequestId }
  | { type: "preferences.updateDesktopSettings"; id: RequestId; settings: Partial<DesktopSettings> }
  | { type: "preferences.setPiExecutablePath"; id: RequestId; path: string }
  | { type: "preferences.removeRepo"; id: RequestId; repoPath: string }
  | { type: "preferences.clearIndexed"; id: RequestId }
  | { type: "session.create"; id: RequestId; connectionId: ConnectionId; options?: NewSessionOptions }
  | { type: "session.switch"; id: RequestId; connectionId: ConnectionId; sessionRef: SessionRef }
  | { type: "session.snapshot"; id: RequestId; connectionId: ConnectionId }
  | {
      type: "message.send";
      id: RequestId;
      connectionId: ConnectionId;
      text: string;
      mode: MessageMode;
    }
  | { type: "run.abort"; id: RequestId; connectionId: ConnectionId; runRef?: RunRef }
  | { type: "provider.model.set"; id: RequestId; connectionId: ConnectionId; model: unknown }
  | { type: "provider.thinking.set"; id: RequestId; connectionId: ConnectionId; level: string }
  | { type: "provider.ui.respond"; id: RequestId; connectionId: ConnectionId; response: ProviderUiResponse };

export type ServerToClientMessage =
  | { type: "server.ready"; protocolVersion: typeof AGENT_CORE_PROTOCOL_VERSION; providers: ProviderDescriptor[] }
  | { type: "connection.status"; connectionId: ConnectionId; state: ConnectionState; message?: string }
  | { type: "session.snapshot"; connectionId: ConnectionId; snapshot: SessionSnapshot }
  | { type: "session.event"; connectionId: ConnectionId; event: SessionDomainEvent }
  | { type: "provider.ui.request"; connectionId: ConnectionId; request: ProviderUiRequest }
  | { type: "workspace.diff"; connectionId: ConnectionId; diff: WorkspaceDiffSummary }
  | { type: "session.list"; id: RequestId; sessions: SessionSummary[] }
  | { type: "preferences.snapshot"; id: RequestId; preferences: PreferencesSnapshot }
  | { type: "error"; id?: RequestId; code: string; message: string };
