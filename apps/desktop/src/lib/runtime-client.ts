import {
  AGENT_PROTOCOL_VERSION,
  type ClientToServerMessage,
  type ListSessionsInput,
  type RequestId,
  type ServerToClientMessage,
  type SessionId,
  type SessionReadModel,
  type SessionSummary,
  type UiSessionEvent,
  type ProviderCommand,
  type ProviderModel,
  type ProviderQueueMode,
} from "@h3code/agent-protocol";

type PendingRequest = {
  resolve: (message: ServerToClientMessage) => void;
  reject: (error: Error) => void;
};

type PendingSnapshotRequest = {
  resolve: (session: SessionReadModel) => void;
  reject: (error: Error) => void;
};

type PendingListRequest = {
  resolve: (sessions: SessionSummary[]) => void;
  reject: (error: Error) => void;
};

export type RuntimeClientListeners = {
  onSessionEvent?: (sessionId: SessionId, event: UiSessionEvent) => void;
  onConnectionStatus?: (status: { connected: boolean; message?: string }) => void;
  onError?: (error: Error) => void;
};

export class RuntimeClient {
  private socket: WebSocket | undefined;
  private nextRequestId = 0;
  private readonly pending = new Map<RequestId, PendingRequest>();
  private readonly sessionEventHandlers = new Map<SessionId, Set<(event: UiSessionEvent) => void>>();
  private readonly snapshotWaiters = new Map<RequestId, PendingSnapshotRequest>();
  private readonly listWaiters = new Map<RequestId, PendingListRequest>();
  private listeners: RuntimeClientListeners = {};
  private connectPromise: Promise<void> | undefined;

  constructor(private readonly resolveServerUrl: () => Promise<string>) {}

  setListeners(listeners: RuntimeClientListeners) {
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

  async createSession(repoPath: string): Promise<SessionReadModel> {
    await this.ensureConnected();
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "session.create", repoPath, providerId: "pi" },
    });

    return this.requireSessionFromCommandResult(response, requestId);
  }

  async switchSession(repoPath: string, sessionId: string): Promise<SessionReadModel> {
    await this.ensureConnected();
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "session.switch", repoPath, providerId: "pi", sessionId },
    });

    return this.requireSessionFromCommandResult(response, requestId);
  }

  async deleteSession(repoPath: string, sessionId: string): Promise<SessionSummary[]> {
    await this.ensureConnected();
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "session.delete", repoPath, providerId: "pi", sessionId },
    });

    return this.requireSessionsFromCommandResult(response);
  }

  async sendTurn(sessionId: string, text: string): Promise<void> {
    await this.ensureConnected();
    const requestId = this.createRequestId();
    await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "turn.send", sessionId, input: { text } },
    });
  }

  async abortTurn(sessionId: string): Promise<void> {
    await this.ensureConnected();
    const requestId = this.createRequestId();
    await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "turn.abort", sessionId },
    });
  }

  async listProviderCommands(sessionId: string): Promise<ProviderCommand[]> {
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "provider.commands.list", sessionId },
    });

    return this.requireProviderCommandsFromCommandResult(response);
  }

  async listProviderModels(sessionId: string): Promise<ProviderModel[]> {
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "provider.models.list", sessionId },
    });

    return this.requireProviderModelsFromCommandResult(response);
  }

  async setModel(sessionId: string, model: ProviderModel): Promise<SessionReadModel> {
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "provider.model.set", sessionId, model },
    });

    return this.requireSessionFromCommandResult(response, requestId);
  }

  async setThinkingLevel(sessionId: string, level: string): Promise<SessionReadModel> {
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "provider.thinking.set", sessionId, level },
    });

    return this.requireSessionFromCommandResult(response, requestId);
  }

  async setQueueSettings(
    sessionId: string,
    settings: { steeringMode?: ProviderQueueMode; followUpMode?: ProviderQueueMode },
  ): Promise<SessionReadModel> {
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "provider.queue.set", sessionId, ...settings },
    });

    return this.requireSessionFromCommandResult(response, requestId);
  }

  async setAutoCompaction(sessionId: string, enabled: boolean): Promise<SessionReadModel> {
    const requestId = this.createRequestId();
    const response = await this.request({
      id: requestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "provider.compaction.set", sessionId, enabled },
    });

    return this.requireSessionFromCommandResult(response, requestId);
  }

  async subscribeSession(sessionId: string, onEvent: (event: UiSessionEvent) => void): Promise<() => void> {
    await this.ensureConnected();

    const handlers = this.sessionEventHandlers.get(sessionId) ?? new Set();
    handlers.add(onEvent);
    this.sessionEventHandlers.set(sessionId, handlers);

    if (handlers.size === 1) {
      this.send({
        type: "session.subscribe",
        protocolVersion: AGENT_PROTOCOL_VERSION,
        payload: { sessionId },
      });
    }

    return () => {
      const current = this.sessionEventHandlers.get(sessionId);
      current?.delete(onEvent);

      if (current && current.size === 0) {
        this.sessionEventHandlers.delete(sessionId);
        this.send({
          type: "session.unsubscribe",
          protocolVersion: AGENT_PROTOCOL_VERSION,
          payload: { sessionId },
        });
      }
    };
  }

  async requestSnapshot(sessionId: string): Promise<SessionReadModel> {
    await this.ensureConnected();
    const requestId = this.createRequestId();

    const snapshotPromise = new Promise<SessionReadModel>((resolve, reject) => {
      this.snapshotWaiters.set(requestId, { resolve, reject });
      this.send({
        id: requestId,
        type: "session.snapshot.request",
        protocolVersion: AGENT_PROTOCOL_VERSION,
        payload: { sessionId },
      });

      const timeout = setTimeout(() => {
        if (this.snapshotWaiters.has(requestId)) {
          this.snapshotWaiters.delete(requestId);
          reject(new Error("Runtime snapshot request timed out."));
        }
      }, 30_000);
      (timeout as unknown as { unref?: () => void }).unref?.();
    });

    return snapshotPromise;
  }

  async listSessions(input: ListSessionsInput): Promise<SessionSummary[]> {
    await this.ensureConnected();
    const requestId = this.createRequestId();

    return new Promise<SessionSummary[]>((resolve, reject) => {
      this.listWaiters.set(requestId, { resolve, reject });
      this.send({
        id: requestId,
        type: "session.list.request",
        protocolVersion: AGENT_PROTOCOL_VERSION,
        payload: input,
      });

      const timeout = setTimeout(() => {
        if (this.listWaiters.has(requestId)) {
          this.listWaiters.delete(requestId);
          reject(new Error("Runtime session list request timed out."));
        }
      }, 30_000);
      (timeout as unknown as { unref?: () => void }).unref?.();
    });
  }

  async resolveApproval(
    sessionId: string,
    requestId: string,
    approved: boolean,
    response?: unknown,
  ): Promise<void> {
    await this.ensureConnected();
    const commandRequestId = this.createRequestId();
    await this.request({
      id: commandRequestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "approval.resolve", sessionId, requestId, approved, response },
    });
  }

  async resolveUserInput(sessionId: string, requestId: string, input: unknown): Promise<void> {
    await this.ensureConnected();
    const commandRequestId = this.createRequestId();
    await this.request({
      id: commandRequestId,
      type: "command",
      protocolVersion: AGENT_PROTOCOL_VERSION,
      payload: { type: "user_input.resolve", sessionId, requestId, input },
    });
  }

  close() {
    for (const waiter of this.snapshotWaiters.values()) {
      waiter.reject(new Error("Runtime client closed."));
    }
    this.snapshotWaiters.clear();

    for (const waiter of this.listWaiters.values()) {
      waiter.reject(new Error("Runtime client closed."));
    }
    this.listWaiters.clear();
    this.socket?.close();
    this.socket = undefined;

    for (const pending of this.pending.values()) {
      pending.reject(new Error("Runtime client closed."));
    }

    this.pending.clear();
    this.sessionEventHandlers.clear();
  }

  private async openSocket(): Promise<void> {
    const url = await this.resolveServerUrl();

    if (!url) {
      throw new Error("Runtime server URL is unavailable.");
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.addEventListener("open", () => {
        this.listeners.onConnectionStatus?.({ connected: true });
        resolve();
      });

      socket.addEventListener("message", (event) => {
        this.handleMessage(event.data);
      });

      socket.addEventListener("close", () => {
        this.listeners.onConnectionStatus?.({ connected: false, message: "Disconnected from runtime server." });
        this.socket = undefined;
      });

      socket.addEventListener("error", () => {
        const error = new Error("Runtime WebSocket connection failed.");
        this.listeners.onError?.(error);
        reject(error);
      });
    });
  }

  private handleMessage(raw: unknown) {
    const message = JSON.parse(String(raw)) as ServerToClientMessage;

    if (message.type === "session.event") {
      const sessionId = inferSessionId(message.payload);

      for (const handler of this.sessionEventHandlers.get(sessionId) ?? []) {
        handler(message.payload);
      }

      this.listeners.onSessionEvent?.(sessionId, message.payload);
      return;
    }

    if (message.type === "session.snapshot.response") {
      const requestId = message.payload.requestId;

      if (!requestId) {
        this.listeners.onError?.(new Error("Snapshot response is missing request id."));
        return;
      }

      const waiter = this.snapshotWaiters.get(requestId);

      if (waiter) {
        this.snapshotWaiters.delete(requestId);
        waiter.resolve(message.payload.session);
      }

      return;
    }

    if (message.type === "session.list.response") {
      const requestId = message.payload.requestId;

      if (!requestId) {
        this.listeners.onError?.(new Error("Session list response is missing request id."));
        return;
      }

      const waiter = this.listWaiters.get(requestId);

      if (waiter) {
        this.listWaiters.delete(requestId);
        waiter.resolve(message.payload.sessions);
      }

      return;
    }

    const requestId =
      message.type === "command.result" || message.type === "error"
        ? message.payload.requestId
        : undefined;

    if (!requestId || !this.pending.has(requestId)) {
      return;
    }

    const pending = this.pending.get(requestId)!;
    this.pending.delete(requestId);

    if (message.type === "error") {
      pending.reject(new Error(message.payload.message));
      return;
    }

    pending.resolve(message);
  }

  private async request(message: ClientToServerMessage & { id?: RequestId }): Promise<ServerToClientMessage> {
    await this.ensureConnected();

    const requestId = message.id ?? this.createRequestId();
    const envelope = { ...message, id: requestId };

    return new Promise<ServerToClientMessage>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.send(envelope);

      const timeout = setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error(`Runtime request timed out: ${message.type}`));
        }
      }, 30_000);
      (timeout as unknown as { unref?: () => void }).unref?.();
    });
  }

  private send(message: ClientToServerMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error("Runtime WebSocket is not connected.");
    }

    this.socket.send(JSON.stringify(message));
  }

  private createRequestId(): RequestId {
    this.nextRequestId += 1;
    return `req-${this.nextRequestId}`;
  }

  private requireSessionFromCommandResult(response: ServerToClientMessage, requestId: RequestId): SessionReadModel {
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }

    if (response.type !== "command.result") {
      throw new Error(`Unexpected response for command: ${response.type}`);
    }

    if (!response.payload.session) {
      throw new Error(`Command result missing session for request ${requestId}.`);
    }

    return response.payload.session;
  }

  private requireProviderCommandsFromCommandResult(response: ServerToClientMessage): ProviderCommand[] {
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }

    if (response.type !== "command.result" || !response.payload.providerCommands) {
      throw new Error(`Unexpected provider commands response: ${response.type}`);
    }

    return response.payload.providerCommands.commands;
  }

  private requireProviderModelsFromCommandResult(response: ServerToClientMessage): ProviderModel[] {
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }

    if (response.type !== "command.result" || !response.payload.providerModels) {
      throw new Error(`Unexpected provider models response: ${response.type}`);
    }

    return response.payload.providerModels.models;
  }

  private requireSessionsFromCommandResult(response: ServerToClientMessage): SessionSummary[] {
    if (response.type === "error") {
      throw new Error(response.payload.message);
    }

    if (response.type !== "command.result" || !response.payload.sessions) {
      throw new Error(`Unexpected sessions response: ${response.type}`);
    }

    return response.payload.sessions;
  }
}

function inferSessionId(event: UiSessionEvent): SessionId {
  if (event.type === "session.snapshot") {
    return event.session.id;
  }

  return event.sessionId;
}

let client: RuntimeClient | undefined;

export function getRuntimeClient(): RuntimeClient {
  client ??= new RuntimeClient(async () => {
    const url = await window.h3code?.getAgentServerUrl?.();

    if (!url) {
      throw new Error("Runtime server URL is unavailable.");
    }

    return url;
  });

  return client;
}
