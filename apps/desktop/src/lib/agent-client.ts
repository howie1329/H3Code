import type {
  ClientToServerMessage,
  ConnectionId,
  ConnectionState,
  DesktopSettings,
  ProviderId,
  ProviderUiRequest,
  ProviderUiResponse,
  PreferencesSnapshot,
  RequestId,
  ServerToClientMessage,
  SessionDomainEvent,
  SessionRef,
  SessionSnapshot,
  SessionSummary,
} from "@h3code/agent-core";

type PendingRequest = {
  resolve: (message: ServerToClientMessage) => void;
  reject: (error: Error) => void;
};

export type AgentClientListeners = {
  onSessionEvent?: (connectionId: ConnectionId, event: SessionDomainEvent) => void;
  onConnectionStatus?: (connectionId: ConnectionId, state: ConnectionState, message?: string) => void;
  onProviderUiRequest?: (connectionId: ConnectionId, request: ProviderUiRequest) => void;
  onError?: (error: Error) => void;
};

export class AgentClient {
  private socket: WebSocket | undefined;
  private nextRequestId = 0;
  private readonly pending = new Map<RequestId, PendingRequest>();
  private readonly snapshotWaiters = new Map<ConnectionId, Array<(snapshot: SessionSnapshot) => void>>();
  private readonly connectionWaiters: Array<{
    resolve: (connectionId: ConnectionId) => void;
    reject: (error: Error) => void;
  }> = [];
  private listeners: AgentClientListeners = {};
  private connectPromise: Promise<void> | undefined;
  private serverUrl: string | undefined;

  constructor(private readonly resolveServerUrl: () => Promise<string>) {}

  setListeners(listeners: AgentClientListeners) {
    this.listeners = listeners;
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

  async listSessions(repoPath: string, markRecent = false): Promise<SessionSummary[]> {
    const response = await this.request({
      type: "session.list",
      id: this.createRequestId(),
      repoPath,
      providerId: "pi",
      markRecent,
    });

    if (response.type !== "session.list") {
      throw new Error(`Unexpected response for session.list: ${response.type}`);
    }

    return response.sessions;
  }

  async connectWorkspace(providerId: ProviderId, repoPath: string, sessionRef?: SessionRef): Promise<ConnectionId> {
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

  async disconnect(connectionId: ConnectionId): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    await this.sendCommand({
      type: "workspace.disconnect",
      id: this.createRequestId(),
      connectionId,
    });
  }

  async requestSnapshot(connectionId: ConnectionId): Promise<SessionSnapshot> {
    const snapshotPromise = this.waitForSnapshot(connectionId);

    this.send({
      type: "session.snapshot",
      id: this.createRequestId(),
      connectionId,
    });

    return snapshotPromise;
  }

  async switchSession(connectionId: ConnectionId, sessionRef: SessionRef): Promise<SessionSnapshot> {
    const snapshotPromise = this.waitForSnapshot(connectionId);

    this.send({
      type: "session.switch",
      id: this.createRequestId(),
      connectionId,
      sessionRef,
    });

    return snapshotPromise;
  }

  async createSession(connectionId: ConnectionId, parentSession?: SessionRef): Promise<SessionSnapshot> {
    const snapshotPromise = this.waitForSnapshot(connectionId);

    this.send({
      type: "session.create",
      id: this.createRequestId(),
      connectionId,
      options: parentSession ? { parentSession } : undefined,
    });

    return snapshotPromise;
  }

  async sendMessage(connectionId: ConnectionId, text: string, mode: "prompt" | "steer" | "followUp"): Promise<void> {
    await this.sendCommand({
      type: "message.send",
      id: this.createRequestId(),
      connectionId,
      text,
      mode,
    });
  }

  async abort(connectionId: ConnectionId): Promise<void> {
    await this.sendCommand({
      type: "run.abort",
      id: this.createRequestId(),
      connectionId,
    });
  }

  async setModel(connectionId: ConnectionId, model: unknown): Promise<void> {
    await this.sendCommand({
      type: "provider.model.set",
      id: this.createRequestId(),
      connectionId,
      model,
    });
  }

  async setThinkingLevel(connectionId: ConnectionId, level: string): Promise<void> {
    await this.sendCommand({
      type: "provider.thinking.set",
      id: this.createRequestId(),
      connectionId,
      level,
    });
  }

  async respondToUi(connectionId: ConnectionId, response: ProviderUiResponse): Promise<void> {
    await this.sendCommand({
      type: "provider.ui.respond",
      id: this.createRequestId(),
      connectionId,
      response,
    });
  }

  async getPreferences(): Promise<PreferencesSnapshot> {
    const response = await this.request({ type: "preferences.get", id: this.createRequestId() });

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for preferences.get: ${response.type}`);
    }

    return response.preferences;
  }

  async updateDesktopSettings(settings: Partial<DesktopSettings>): Promise<PreferencesSnapshot> {
    const response = await this.request({
      type: "preferences.updateDesktopSettings",
      id: this.createRequestId(),
      settings,
    });

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for preferences.updateDesktopSettings: ${response.type}`);
    }

    return response.preferences;
  }

  async setPiExecutablePath(path: string): Promise<PreferencesSnapshot> {
    const response = await this.request({
      type: "preferences.setPiExecutablePath",
      id: this.createRequestId(),
      path,
    });

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for preferences.setPiExecutablePath: ${response.type}`);
    }

    return response.preferences;
  }

  async removeIndexedRepo(repoPath: string): Promise<PreferencesSnapshot> {
    const response = await this.request({
      type: "preferences.removeRepo",
      id: this.createRequestId(),
      repoPath,
    });

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for preferences.removeRepo: ${response.type}`);
    }

    return response.preferences;
  }

  async clearAllIndexedData(): Promise<PreferencesSnapshot> {
    const response = await this.request({ type: "preferences.clearIndexed", id: this.createRequestId() });

    if (response.type !== "preferences.snapshot") {
      throw new Error(`Unexpected response for preferences.clearIndexed: ${response.type}`);
    }

    return response.preferences;
  }

  close() {
    this.socket?.close();
    this.socket = undefined;
    this.serverUrl = undefined;

    for (const pending of this.pending.values()) {
      pending.reject(new Error("Agent client closed."));
    }

    this.pending.clear();
    this.snapshotWaiters.clear();
    this.connectionWaiters.length = 0;
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
        return;

      case "connection.status":
        this.listeners.onConnectionStatus?.(message.connectionId, message.state, message.message);

        if (message.state === "connected") {
          const waiter = this.connectionWaiters.shift();

          if (waiter) {
            waiter.resolve(message.connectionId);
          }
        }

        return;

      case "session.event":
        this.listeners.onSessionEvent?.(message.connectionId, message.event);
        return;

      case "provider.ui.request":
        this.listeners.onProviderUiRequest?.(message.connectionId, message.request);
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
