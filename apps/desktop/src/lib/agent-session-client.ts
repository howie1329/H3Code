import type {
  ClientToServerMessage,
  ConnectionId,
  ConnectionState,
  DesktopSettings,
  PreferencesSnapshot,
  ProviderCapabilities,
  ProviderCommand,
  ProviderId,
  ProviderModel,
  ProviderQueueMode,
  ProviderUiRequest,
  ProviderUiResponse,
  RequestId,
  ServerToClientMessage,
  SessionDomainEvent,
  SessionMessageCacheEntry,
  SessionMessageCacheUpsert,
  SessionRef,
  SessionSnapshot,
  SessionSummary,
  WorkspaceDiffSummary,
} from "@h3code/agent-core";

import type { SessionDomainEvent as ProjectorSessionDomainEvent } from "$lib/pi-session/domain-events.js";

type PendingRequest = {
  resolve: (message: ServerToClientMessage) => void;
  reject: (error: Error) => void;
};

export type ActiveProviderUiRequest = ProviderUiRequest & {
  connectionId: ConnectionId;
};

export type ConnectRepoResult = {
  repoPath: string;
  connectionId: ConnectionId;
  sessions: SessionSummary[];
  selectedSessionRef?: SessionRef;
  snapshot: SessionSnapshot;
};

export type AgentSessionClientListeners = {
  onSessionEvent?: (connectionId: ConnectionId, event: ProjectorSessionDomainEvent) => void;
  onConnectionStatus?: (status: {
    connectionId: ConnectionId;
    state: ConnectionState;
    repoPath?: string;
    message?: string;
  }) => void;
  onProviderUiRequest?: (request: ActiveProviderUiRequest) => void;
  onWorkspaceDiff?: (connectionId: ConnectionId, diff: WorkspaceDiffSummary) => void;
  onError?: (error: Error) => void;
};

export class AgentSessionClient {
  private socket: WebSocket | undefined;
  private nextRequestId = 0;
  private readonly pending = new Map<RequestId, PendingRequest>();
  private readonly snapshotWaiters = new Map<ConnectionId, Array<(snapshot: SessionSnapshot) => void>>();
  private readonly connectionWaiters: Array<{
    resolve: (connectionId: ConnectionId) => void;
    reject: (error: Error) => void;
  }> = [];
  private listeners: AgentSessionClientListeners = {};
  private connectPromise: Promise<void> | undefined;
  private serverUrl: string | undefined;
  private readonly providerCapabilities = new Map<ProviderId, ProviderCapabilities>();
  private connectionId: ConnectionId | undefined;
  private repoPath: string | undefined;

  constructor(private readonly resolveServerUrl: () => Promise<string>) {}

  setListeners(listeners: AgentSessionClientListeners) {
    this.listeners = listeners;
  }

  get activeConnectionId(): ConnectionId | undefined {
    return this.connectionId;
  }

  get activeRepoPath(): string | undefined {
    return this.repoPath;
  }

  getProviderCapabilities(providerId: ProviderId = "pi"): ProviderCapabilities | undefined {
    return this.providerCapabilities.get(providerId);
  }

  async ensureConnected(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.openSocket();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  async getPreferences(): Promise<PreferencesSnapshot> {
    const response = await this.request({ type: "preferences.get", id: this.createRequestId() });

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for preferences.get: ${response.type}`);
    }

    return response.preferences;
  }

  async updateDesktopSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings> {
    const preferences = await this.updatePreferences({
      type: "preferences.updateDesktopSettings",
      id: this.createRequestId(),
      settings,
    });

    return preferences.desktopSettings;
  }

  async setPiExecutablePath(path: string): Promise<PreferencesSnapshot> {
    return this.updatePreferences({
      type: "preferences.setPiExecutablePath",
      id: this.createRequestId(),
      path,
    });
  }

  async removeIndexedRepo(repoPath: string): Promise<PreferencesSnapshot> {
    return this.updatePreferences({
      type: "preferences.removeRepo",
      id: this.createRequestId(),
      repoPath,
    });
  }

  async clearAllIndexedData(): Promise<PreferencesSnapshot> {
    if (this.connectionId) {
      await this.disconnect(this.connectionId);
      this.connectionId = undefined;
      this.repoPath = undefined;
    }

    const response = await this.request({ type: "preferences.clearIndexed", id: this.createRequestId() });

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for preferences.clearIndexed: ${response.type}`);
    }

    return response.preferences;
  }

  async listRepoSessions(repoPath: string, markRecent = false): Promise<SessionSummary[]> {
    return this.listSessions(repoPath, markRecent);
  }

  async listSessions(repoPath?: string, markRecent = false): Promise<SessionSummary[]> {
    const targetRepoPath = repoPath ?? this.repoPath;

    if (!targetRepoPath) {
      return [];
    }

    const response = await this.request({
      type: "session.list",
      id: this.createRequestId(),
      repoPath: targetRepoPath,
      providerId: "pi",
      markRecent,
    });

    if (response.type !== "session.list") {
      throw new Error(`Unexpected response for session.list: ${response.type}`);
    }

    return response.sessions;
  }

  async connectRepo(repoPath: string, selectedSessionRef?: SessionRef): Promise<ConnectRepoResult> {
    await this.ensureConnected();

    const sessions = await this.listRepoSessions(repoPath, true);
    const targetSessionRef = selectedSessionRef ?? sessions[0]?.sessionRef;

    if (this.connectionId) {
      await this.disconnect(this.connectionId);
      this.connectionId = undefined;
    }

    this.listeners.onConnectionStatus?.({
      connectionId: "pending" as ConnectionId,
      state: "starting",
      repoPath,
    });

    const connectionId = await this.connectWorkspace("pi", repoPath, targetSessionRef);
    this.connectionId = connectionId;
    this.repoPath = repoPath;

    let snapshot = await this.requestSnapshot(connectionId);

    if (targetSessionRef && snapshot.summary.sessionRef !== targetSessionRef) {
      snapshot = await this.switchSessionForConnection(connectionId, targetSessionRef);
    }

    this.listeners.onConnectionStatus?.({
      connectionId,
      state: "connected",
      repoPath,
    });

    return {
      repoPath,
      connectionId,
      sessions,
      selectedSessionRef: snapshot.summary.sessionRef,
      snapshot,
    };
  }

  async switchSession(sessionRef: SessionRef): Promise<SessionSnapshot> {
    const connectionId = this.requireConnectionId();
    return this.switchSessionForConnection(connectionId, sessionRef);
  }

  async createSession(parentSession?: SessionRef): Promise<SessionSnapshot> {
    const connectionId = this.requireConnectionId();
    const snapshotPromise = this.waitForSnapshot(connectionId);

    this.send({
      type: "session.create",
      id: this.createRequestId(),
      connectionId,
      options: parentSession ? { parentSession } : undefined,
    });

    return snapshotPromise;
  }

  async getSessionSnapshot(): Promise<SessionSnapshot> {
    return this.requestSnapshot(this.requireConnectionId());
  }

  async sendPrompt(message: string, streamingBehavior?: "steer" | "followUp"): Promise<void> {
    const mode =
      streamingBehavior === "steer" ? "steer" : streamingBehavior === "followUp" ? "followUp" : "prompt";
    await this.sendMessage(this.requireConnectionId(), message, mode);
  }

  async sendSteer(message: string): Promise<void> {
    await this.sendMessage(this.requireConnectionId(), message, "steer");
  }

  async sendFollowUp(message: string): Promise<void> {
    await this.sendMessage(this.requireConnectionId(), message, "followUp");
  }

  async abort(): Promise<void> {
    await this.abortConnection(this.requireConnectionId());
  }

  async respondToProviderUi(response: ProviderUiResponse): Promise<void> {
    await this.respondToUi(this.requireConnectionId(), response);
  }

  async getCommands(): Promise<ProviderCommand[]> {
    return this.listCommands(this.requireConnectionId());
  }

  async getAvailableModels(): Promise<ProviderModel[]> {
    return this.listModels(this.requireConnectionId());
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    await this.setConnectionModel(this.requireConnectionId(), { provider, id: modelId });
  }

  async setThinkingLevel(level: string): Promise<void> {
    await this.setConnectionThinkingLevel(this.requireConnectionId(), level);
  }

  async setSteeringMode(mode: ProviderQueueMode): Promise<SessionSnapshot> {
    return this.setConnectionSteeringMode(this.requireConnectionId(), mode);
  }

  async setFollowUpMode(mode: ProviderQueueMode): Promise<SessionSnapshot> {
    return this.setConnectionFollowUpMode(this.requireConnectionId(), mode);
  }

  async setAutoCompaction(enabled: boolean): Promise<SessionSnapshot> {
    return this.setConnectionAutoCompaction(this.requireConnectionId(), enabled);
  }

  async deleteSession(repoPath: string, sessionRef: SessionRef): Promise<SessionSummary[]> {
    const response = await this.request({
      type: "session.delete",
      id: this.createRequestId(),
      repoPath,
      sessionRef,
      connectionId: this.connectionId,
    });

    if (response.type !== "session.delete") {
      throw new Error(`Unexpected response for session.delete: ${response.type}`);
    }

    return response.sessions;
  }

  async getWorkspaceDiff(): Promise<WorkspaceDiffSummary> {
    return this.getConnectionWorkspaceDiff(this.requireConnectionId());
  }

  async getSessionMessageCache(sessionRef: SessionRef): Promise<SessionMessageCacheEntry | undefined> {
    const response = await this.request({
      type: "session.cache.get",
      id: this.createRequestId(),
      sessionRef,
    });

    if (response.type !== "session.cache.entry") {
      throw new Error(`Unexpected response for session.cache.get: ${response.type}`);
    }

    return response.entry;
  }

  async upsertSessionMessageCache(entry: SessionMessageCacheUpsert): Promise<void> {
    const response = await this.request({
      type: "session.cache.upsert",
      id: this.createRequestId(),
      entry,
    });

    if (response.type !== "session.cache.saved") {
      throw new Error(`Unexpected response for session.cache.upsert: ${response.type}`);
    }
  }

  async deleteSessionMessageCache(sessionRef: SessionRef): Promise<void> {
    const response = await this.request({
      type: "session.cache.delete",
      id: this.createRequestId(),
      sessionRef,
    });

    if (response.type !== "session.cache.deleted") {
      throw new Error(`Unexpected response for session.cache.delete: ${response.type}`);
    }
  }

  close() {
    this.socket?.close();
    this.socket = undefined;
    this.serverUrl = undefined;
    this.connectionId = undefined;
    this.repoPath = undefined;

    for (const pending of this.pending.values()) {
      pending.reject(new Error("Agent session client closed."));
    }

    this.pending.clear();
    this.snapshotWaiters.clear();
    this.connectionWaiters.length = 0;
  }

  private requireConnectionId(): ConnectionId {
    if (!this.connectionId) {
      throw new Error("No active agent connection.");
    }

    return this.connectionId;
  }

  private async updatePreferences(message: ClientToServerMessage & { id: RequestId }): Promise<PreferencesSnapshot> {
    const response = await this.request(message);

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for ${message.type}: ${response.type}`);
    }

    return response.preferences;
  }

  private async connectWorkspace(providerId: ProviderId, repoPath: string, sessionRef?: SessionRef): Promise<ConnectionId> {
    await this.ensureConnected();

    const connectionPromise = this.waitForNextConnection();

    this.send({
      type: "workspace.connect",
      id: this.createRequestId(),
      providerId,
      repoPath,
      sessionRef,
    });

    return connectionPromise;
  }

  private async disconnect(connectionId: ConnectionId): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    await this.sendCommand({
      type: "workspace.disconnect",
      id: this.createRequestId(),
      connectionId,
    });
  }

  private async requestSnapshot(connectionId: ConnectionId): Promise<SessionSnapshot> {
    const snapshotPromise = this.waitForSnapshot(connectionId);

    this.send({
      type: "session.snapshot",
      id: this.createRequestId(),
      connectionId,
    });

    return snapshotPromise;
  }

  private async switchSessionForConnection(connectionId: ConnectionId, sessionRef: SessionRef): Promise<SessionSnapshot> {
    const snapshotPromise = this.waitForSnapshot(connectionId);

    this.send({
      type: "session.switch",
      id: this.createRequestId(),
      connectionId,
      sessionRef,
    });

    return snapshotPromise;
  }

  private async sendMessage(connectionId: ConnectionId, text: string, mode: "prompt" | "steer" | "followUp"): Promise<void> {
    await this.sendCommand({
      type: "message.send",
      id: this.createRequestId(),
      connectionId,
      text,
      mode,
    });
  }

  private async abortConnection(connectionId: ConnectionId): Promise<void> {
    await this.sendCommand({
      type: "run.abort",
      id: this.createRequestId(),
      connectionId,
    });
  }

  private async setConnectionModel(connectionId: ConnectionId, model: unknown): Promise<void> {
    await this.sendCommand({
      type: "provider.model.set",
      id: this.createRequestId(),
      connectionId,
      model,
    });
  }

  private async setConnectionThinkingLevel(connectionId: ConnectionId, level: string): Promise<void> {
    await this.sendCommand({
      type: "provider.thinking.set",
      id: this.createRequestId(),
      connectionId,
      level,
    });
  }

  private async respondToUi(connectionId: ConnectionId, response: ProviderUiResponse): Promise<void> {
    await this.sendCommand({
      type: "provider.ui.respond",
      id: this.createRequestId(),
      connectionId,
      response,
    });
  }

  private async listCommands(connectionId: ConnectionId): Promise<ProviderCommand[]> {
    const response = await this.request({
      type: "provider.commands.list",
      id: this.createRequestId(),
      connectionId,
    });

    if (response.type !== "provider.commands.list") {
      throw new Error(`Unexpected response for provider.commands.list: ${response.type}`);
    }

    return response.commands;
  }

  private async listModels(connectionId: ConnectionId): Promise<ProviderModel[]> {
    const response = await this.request({
      type: "provider.models.list",
      id: this.createRequestId(),
      connectionId,
    });

    if (response.type !== "provider.models.list") {
      throw new Error(`Unexpected response for provider.models.list: ${response.type}`);
    }

    return response.models;
  }

  private async setConnectionSteeringMode(connectionId: ConnectionId, mode: ProviderQueueMode): Promise<SessionSnapshot> {
    const response = await this.request({
      type: "provider.queue.set",
      id: this.createRequestId(),
      connectionId,
      steeringMode: mode,
    });

    if (response.type !== "provider.queue.set" || !response.snapshot) {
      throw new Error("provider.queue.set response did not include a snapshot.");
    }

    return response.snapshot;
  }

  private async setConnectionFollowUpMode(connectionId: ConnectionId, mode: ProviderQueueMode): Promise<SessionSnapshot> {
    const response = await this.request({
      type: "provider.queue.set",
      id: this.createRequestId(),
      connectionId,
      followUpMode: mode,
    });

    if (response.type !== "provider.queue.set" || !response.snapshot) {
      throw new Error("provider.queue.set response did not include a snapshot.");
    }

    return response.snapshot;
  }

  private async setConnectionAutoCompaction(connectionId: ConnectionId, enabled: boolean): Promise<SessionSnapshot> {
    const response = await this.request({
      type: "provider.compaction.set",
      id: this.createRequestId(),
      connectionId,
      enabled,
    });

    if (response.type !== "provider.compaction.set" || !response.snapshot) {
      throw new Error("provider.compaction.set response did not include a snapshot.");
    }

    return response.snapshot;
  }

  private async getConnectionWorkspaceDiff(connectionId: ConnectionId): Promise<WorkspaceDiffSummary> {
    const response = await this.request({
      type: "workspace.diff",
      id: this.createRequestId(),
      connectionId,
    });

    if (response.type !== "workspace.diff") {
      throw new Error(`Unexpected response for workspace.diff: ${response.type}`);
    }

    return response.diff;
  }

  private async openSocket(): Promise<void> {
    const url = await this.resolveServerUrl();

    if (!url) {
      throw new Error("Agent server URL is unavailable.");
    }

    if (this.serverUrl && this.serverUrl !== url) {
      this.socket?.close();
      this.socket = undefined;
    }

    this.serverUrl = url;

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject(new Error("Failed to connect to the agent server.")));
      socket.addEventListener("message", (event) => this.handleMessage(event));
      socket.addEventListener("close", () => {
        this.socket = undefined;
        this.rejectPending(new Error("Agent server connection closed."));
      });
    });
  }

  private handleMessage(event: MessageEvent) {
    let message: ServerToClientMessage;

    try {
      message = JSON.parse(String(event.data)) as ServerToClientMessage;
    } catch {
      this.listeners.onError?.(new Error("Invalid agent server message."));
      return;
    }

    if (message.type === "error") {
      const error = new Error(message.message);

      if (message.id) {
        this.pending.get(message.id)?.reject(error);
        this.pending.delete(message.id);
        return;
      }

      this.listeners.onError?.(error);
      return;
    }

    if ("id" in message && message.id) {
      const pending = this.pending.get(message.id);

      if (pending) {
        pending.resolve(message);
        this.pending.delete(message.id);
        return;
      }
    }

    switch (message.type) {
      case "server.ready":
        for (const provider of message.providers) {
          this.providerCapabilities.set(provider.id, provider.capabilities);
        }

        return;

      case "workspace.diff":
        this.listeners.onWorkspaceDiff?.(message.connectionId, message.diff);
        return;

      case "connection.status":
        this.listeners.onConnectionStatus?.({
          connectionId: message.connectionId,
          state: message.state,
          repoPath: this.repoPath,
          message: message.message,
        });

        if (message.state === "connected") {
          const waiter = this.connectionWaiters.shift();

          if (waiter) {
            waiter.resolve(message.connectionId);
          }
        }

        return;

      case "session.event":
        this.listeners.onSessionEvent?.(message.connectionId, message.event as ProjectorSessionDomainEvent);
        return;

      case "provider.ui.request":
        this.listeners.onProviderUiRequest?.({
          ...message.request,
          connectionId: message.connectionId,
        });
        return;

      case "session.snapshot": {
        const waiters = this.snapshotWaiters.get(message.connectionId);

        if (waiters?.length) {
          waiters.shift()?.(message.snapshot);
        }

        return;
      }

      default:
        return;
    }
  }

  private waitForSnapshot(connectionId: ConnectionId): Promise<SessionSnapshot> {
    return new Promise((resolve, reject) => {
      const waiters = this.snapshotWaiters.get(connectionId) ?? [];
      waiters.push(resolve);
      this.snapshotWaiters.set(connectionId, waiters);

      window.setTimeout(() => {
        const current = this.snapshotWaiters.get(connectionId);

        if (!current?.includes(resolve)) {
          return;
        }

        this.snapshotWaiters.set(
          connectionId,
          current.filter((entry) => entry !== resolve),
        );
        reject(new Error("Timed out waiting for session snapshot."));
      }, 30_000);
    });
  }

  private waitForNextConnection(): Promise<ConnectionId> {
    return new Promise((resolve, reject) => {
      this.connectionWaiters.push({ resolve, reject });

      window.setTimeout(() => {
        const index = this.connectionWaiters.findIndex((waiter) => waiter.resolve === resolve);

        if (index === -1) {
          return;
        }

        this.connectionWaiters.splice(index, 1);
        reject(new Error("Timed out waiting for workspace connection."));
      }, 30_000);
    });
  }

  private send(message: ClientToServerMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Agent server is not connected.");
    }

    this.socket.send(JSON.stringify(message));
  }

  private async sendCommand(message: ClientToServerMessage & { id: RequestId }): Promise<void> {
    await this.ensureConnected();
    this.send(message);
  }

  private request(message: ClientToServerMessage & { id: RequestId }): Promise<ServerToClientMessage> {
    return new Promise((resolve, reject) => {
      void this.ensureConnected()
        .then(() => {
          this.pending.set(message.id, { resolve, reject });
          this.send(message);

          window.setTimeout(() => {
            if (!this.pending.has(message.id)) {
              return;
            }

            this.pending.delete(message.id);
            reject(new Error(`Timed out waiting for ${message.type}.`));
          }, 30_000);
        })
        .catch(reject);
    });
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }

    this.pending.clear();

    for (const waiter of this.connectionWaiters.splice(0)) {
      waiter.reject(error);
    }
  }

  private createRequestId(): RequestId {
    this.nextRequestId += 1;
    return `req-${this.nextRequestId}`;
  }
}

let client: AgentSessionClient | undefined;

export function getAgentSessionClient(): AgentSessionClient {
  client ??= new AgentSessionClient(async () => {
    const url = await window.h3code?.getAgentServerUrl?.();

    if (!url) {
      throw new Error("Agent server URL is unavailable. Restart the app and try again.");
    }

    return url;
  });

  return client;
}
