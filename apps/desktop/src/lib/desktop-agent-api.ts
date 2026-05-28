import type { ProviderCapabilities } from "@h3code/agent-core";
import type { SessionDomainEvent } from "$lib/pi-session/domain-events.js";

import { AgentClient, type AgentClientListeners } from "$lib/agent-client.js";
import {
  connectionStatusToPiStatus,
  piExtensionUiResponseToProvider,
  providerCommandToPiSlashCommand,
  providerModelToPiModel,
  providerUiToPiRequest,
  sessionSummaryToPiSessionSummary,
  snapshotToPiSessionState,
  snapshotToPiSessionStats,
  workspaceDiffToPiSessionDiff,
  wrapSessionEvent,
} from "$lib/agent-adapters.js";
import { getAgentTransport, usesLegacyAgentTransport } from "$lib/agent-transport.js";
import { normalizeModel } from "./pi-model.js";

export type DesktopAgentApi = {
  readonly transport: "ipc" | "ws";
  setEventListeners: (listeners: {
    onSessionEvent?: (event: SessionDomainEvent & { agentId?: string }) => void;
    onPiStatus?: (status: PiStatus) => void;
    onExtensionUiRequest?: (request: PiExtensionUiRequest) => void;
    onWorkspaceDiff?: (diff: PiSessionDiff) => void;
  }) => void;
  getPreferences: () => Promise<DesktopPreferences>;
  updateDesktopSettings: (settings: Partial<DesktopSettings>) => Promise<DesktopSettings>;
  setPiExecutablePath: (executablePath: string) => Promise<{ piExecutablePath: string }>;
  removeIndexedRepo: (repoPath: string) => Promise<DesktopPreferences>;
  clearAllIndexedData: () => Promise<DesktopPreferences>;
  listRepoSessions: (repoPath: string, markRecent?: boolean) => Promise<PiSessionSummary[]>;
  listSessions: () => Promise<PiSessionSummary[]>;
  connectRepo: (repoPath: string, selectedSessionPath?: string) => Promise<PiConnectRepoResult>;
  switchSession: (sessionPath: string) => Promise<{
    state: PiSessionState;
    messages: unknown[];
    agentId?: string;
    repoPath?: string;
    worktreePath?: string;
  }>;
  newSession: (parentSession?: string) => Promise<{
    state: PiSessionState;
    messages: unknown[];
    agentId?: string;
    repoPath?: string;
    worktreePath?: string;
  }>;
  getSessionSnapshot: () => Promise<{ state: PiSessionState; messages: unknown[] }>;
  sendPrompt: (message: string, streamingBehavior?: "steer" | "followUp") => Promise<void>;
  sendSteer: (message: string) => Promise<void>;
  sendFollowUp: (message: string) => Promise<void>;
  abort: () => Promise<void>;
  respondToExtensionUi: (response: PiExtensionUiResponse) => Promise<void>;
  getCommands: () => Promise<PiSlashCommand[]>;
  getAvailableModels: () => Promise<PiModel[]>;
  setModel: (provider: string, modelId: string) => Promise<PiModel>;
  setThinkingLevel: (level: PiThinkingLevel) => Promise<void>;
  setSteeringMode: (mode: PiQueueMode) => Promise<PiSessionState>;
  setFollowUpMode: (mode: PiQueueMode) => Promise<PiSessionState>;
  setAutoCompaction: (enabled: boolean) => Promise<PiSessionState>;
  getSessionStatsFromSnapshot: () => Promise<PiSessionStats | null>;
  deleteSession: (repoPath: string, sessionPath: string) => Promise<PiSessionSummary[]>;
  getSessionDiff: () => Promise<PiSessionDiff>;
  getProviderCapabilities: () => ProviderCapabilities | undefined;
};

class IpcDesktopAgentApi implements DesktopAgentApi {
  readonly transport = "ipc" as const;

  setEventListeners(_listeners: {
    onSessionEvent?: (event: SessionDomainEvent & { agentId?: string }) => void;
    onPiStatus?: (status: PiStatus) => void;
    onExtensionUiRequest?: (request: PiExtensionUiRequest) => void;
    onWorkspaceDiff?: (diff: PiSessionDiff) => void;
  }) {
    // IPC events are delivered via window.h3code in desktop-state.
  }

  private requireApi() {
    if (!window.h3code) {
      throw new Error("Desktop API is unavailable.");
    }

    return window.h3code;
  }

  async getPreferences() {
    return this.requireApi().getPreferences();
  }

  async updateDesktopSettings(settings: Partial<DesktopSettings>) {
    return this.requireApi().updateDesktopSettings(settings);
  }

  async setPiExecutablePath(executablePath: string) {
    return this.requireApi().setPiExecutablePath(executablePath);
  }

  async removeIndexedRepo(repoPath: string) {
    return this.requireApi().removeIndexedRepo(repoPath);
  }

  async clearAllIndexedData() {
    return this.requireApi().clearAllIndexedData();
  }

  async listRepoSessions(repoPath: string, markRecent?: boolean) {
    return this.requireApi().listRepoSessions(repoPath, markRecent);
  }

  async listSessions() {
    return this.requireApi().listSessions();
  }

  async connectRepo(repoPath: string, selectedSessionPath?: string) {
    return this.requireApi().connectRepo(repoPath, selectedSessionPath);
  }

  async switchSession(sessionPath: string) {
    return this.requireApi().switchSession(sessionPath);
  }

  async newSession(parentSession?: string) {
    return this.requireApi().newSession(parentSession);
  }

  async getSessionSnapshot() {
    return this.requireApi().getSessionSnapshot();
  }

  async sendPrompt(message: string, streamingBehavior?: "steer" | "followUp") {
    return this.requireApi().sendPrompt(message, streamingBehavior);
  }

  async sendSteer(message: string) {
    return this.requireApi().sendSteer(message);
  }

  async sendFollowUp(message: string) {
    return this.requireApi().sendFollowUp(message);
  }

  async abort() {
    return this.requireApi().abort();
  }

  async respondToExtensionUi(response: PiExtensionUiResponse) {
    return this.requireApi().respondToExtensionUi(response);
  }

  async getCommands() {
    return this.requireApi().getCommands();
  }

  async getAvailableModels() {
    return this.requireApi().getAvailableModels();
  }

  async setModel(provider: string, modelId: string) {
    return this.requireApi().setModel(provider, modelId);
  }

  async setThinkingLevel(level: PiThinkingLevel) {
    return this.requireApi().setThinkingLevel(level);
  }

  async setSteeringMode(mode: PiQueueMode) {
    return this.requireApi().setSteeringMode(mode);
  }

  async setFollowUpMode(mode: PiQueueMode) {
    return this.requireApi().setFollowUpMode(mode);
  }

  async setAutoCompaction(enabled: boolean) {
    return this.requireApi().setAutoCompaction(enabled);
  }

  async getSessionStatsFromSnapshot() {
    return this.requireApi().getSessionStats();
  }

  async deleteSession(repoPath: string, sessionPath: string) {
    return this.requireApi().deletePiSession(repoPath, sessionPath);
  }

  async getSessionDiff(worktreePath?: string) {
    return this.requireApi().getSessionDiff(worktreePath);
  }

  getProviderCapabilities(): ProviderCapabilities | undefined {
    return undefined;
  }
}

class WsDesktopAgentApi implements DesktopAgentApi {
  readonly transport = "ws" as const;
  private connectionId: string | undefined;
  private repoPath: string | undefined;
  private readonly client: AgentClient;
  private eventListeners: {
    onSessionEvent?: (event: SessionDomainEvent & { agentId?: string }) => void;
    onPiStatus?: (status: PiStatus) => void;
    onExtensionUiRequest?: (request: PiExtensionUiRequest) => void;
    onWorkspaceDiff?: (diff: PiSessionDiff) => void;
  } = {};

  constructor() {
    this.client = new AgentClient(async () => {
      const url = await window.h3code?.getAgentServerUrl?.();

      if (!url) {
        throw new Error("Agent server URL is unavailable. Restart the app and try again.");
      }

      return url;
    });

    this.client.setListeners({
      onSessionEvent: (connectionId, event) => {
        this.eventListeners.onSessionEvent?.(wrapSessionEvent(connectionId, event));
      },
      onConnectionStatus: (connectionId, state, message) => {
        this.eventListeners.onPiStatus?.(
          connectionStatusToPiStatus(state, connectionId, this.repoPath, message),
        );
      },
      onProviderUiRequest: (connectionId, request) => {
        this.eventListeners.onExtensionUiRequest?.(providerUiToPiRequest(connectionId, request));
      },
      onError: (error) => {
        if (this.connectionId) {
          this.eventListeners.onPiStatus?.(
            connectionStatusToPiStatus("error", this.connectionId, this.repoPath, error.message),
          );
        }
      },
      onWorkspaceDiff: (_connectionId, diff) => {
        this.eventListeners.onWorkspaceDiff?.(workspaceDiffToPiSessionDiff(diff));
      },
    });
  }

  setEventListeners(listeners: {
    onSessionEvent?: (event: SessionDomainEvent & { agentId?: string }) => void;
    onPiStatus?: (status: PiStatus) => void;
    onExtensionUiRequest?: (request: PiExtensionUiRequest) => void;
    onWorkspaceDiff?: (diff: PiSessionDiff) => void;
  }) {
    this.eventListeners = listeners;
  }

  private requireConnectionId(): string {
    if (!this.connectionId) {
      throw new Error("No active agent connection.");
    }

    return this.connectionId;
  }

  async getPreferences() {
    return this.client.getPreferences();
  }

  async updateDesktopSettings(settings: Partial<DesktopSettings>) {
    const preferences = await this.client.updateDesktopSettings(settings);
    return preferences.desktopSettings;
  }

  async setPiExecutablePath(executablePath: string) {
    const preferences = await this.client.setPiExecutablePath(executablePath);
    return { piExecutablePath: preferences.piExecutablePath };
  }

  async removeIndexedRepo(repoPath: string) {
    return this.client.removeIndexedRepo(repoPath);
  }

  async clearAllIndexedData() {
    if (this.connectionId) {
      await this.client.disconnect(this.connectionId);
      this.connectionId = undefined;
      this.repoPath = undefined;
    }

    return this.client.clearAllIndexedData();
  }

  async listRepoSessions(repoPath: string, markRecent = false) {
    const sessions = await this.client.listSessions(repoPath, markRecent);
    return sessions.map(sessionSummaryToPiSessionSummary);
  }

  async listSessions() {
    if (!this.repoPath) {
      return [];
    }

    return this.listRepoSessions(this.repoPath);
  }

  async connectRepo(repoPath: string, selectedSessionPath?: string) {
    await this.client.ensureConnected();

    const sessions = await this.listRepoSessions(repoPath, true);
    const targetSession = selectedSessionPath ?? sessions[0]?.path;

    if (this.connectionId) {
      await this.client.disconnect(this.connectionId);
      this.connectionId = undefined;
    }

    this.eventListeners.onPiStatus?.({ state: "starting", repoPath, worktreePath: repoPath });

    const connectionId = await this.client.connectWorkspace("pi", repoPath, targetSession);
    this.connectionId = connectionId;
    this.repoPath = repoPath;

    let snapshot = await this.client.requestSnapshot(connectionId);

    if (targetSession && snapshot.summary.sessionRef !== targetSession) {
      snapshot = await this.client.switchSession(connectionId, targetSession);
    }

    const state = snapshotToPiSessionState(snapshot);

    this.eventListeners.onPiStatus?.(connectionStatusToPiStatus("connected", connectionId, repoPath));

    return {
      repoPath,
      agentId: connectionId,
      worktreePath: repoPath,
      sessions,
      selectedSessionPath: state.sessionFile,
      state,
      messages: snapshot.messages,
    };
  }

  async switchSession(sessionPath: string) {
    const connectionId = this.requireConnectionId();
    const snapshot = await this.client.switchSession(connectionId, sessionPath);
    const state = snapshotToPiSessionState(snapshot);

    return {
      state,
      messages: snapshot.messages,
      agentId: connectionId,
      repoPath: this.repoPath,
      worktreePath: this.repoPath,
    };
  }

  async newSession(parentSession?: string) {
    const connectionId = this.requireConnectionId();
    const snapshot = await this.client.createSession(connectionId, parentSession);
    const state = snapshotToPiSessionState(snapshot);

    return {
      state,
      messages: snapshot.messages,
      agentId: connectionId,
      repoPath: this.repoPath,
      worktreePath: this.repoPath,
    };
  }

  async getSessionSnapshot() {
    const connectionId = this.requireConnectionId();
    const snapshot = await this.client.requestSnapshot(connectionId);

    return {
      state: snapshotToPiSessionState(snapshot),
      messages: snapshot.messages,
    };
  }

  async sendPrompt(message: string) {
    await this.client.sendMessage(this.requireConnectionId(), message, "prompt");
  }

  async sendSteer(message: string) {
    await this.client.sendMessage(this.requireConnectionId(), message, "steer");
  }

  async sendFollowUp(message: string) {
    await this.client.sendMessage(this.requireConnectionId(), message, "followUp");
  }

  async abort() {
    await this.client.abort(this.requireConnectionId());
  }

  async respondToExtensionUi(response: PiExtensionUiResponse) {
    await this.client.respondToUi(this.requireConnectionId(), piExtensionUiResponseToProvider(response));
  }

  async getCommands(): Promise<PiSlashCommand[]> {
    const commands = await this.client.listCommands(this.requireConnectionId());
    return commands.map(providerCommandToPiSlashCommand);
  }

  async getAvailableModels(): Promise<PiModel[]> {
    const models = await this.client.listModels(this.requireConnectionId());
    return models.map(providerModelToPiModel);
  }

  async setModel(provider: string, modelId: string): Promise<PiModel> {
    await this.client.setModel(this.requireConnectionId(), { provider, id: modelId });
    const snapshot = await this.getSessionSnapshot();
    return snapshot.state.model ?? normalizeModel({ provider, id: modelId }) ?? { provider, id: modelId };
  }

  async setThinkingLevel(level: PiThinkingLevel) {
    await this.client.setThinkingLevel(this.requireConnectionId(), level);
  }

  async setSteeringMode(mode: PiQueueMode): Promise<PiSessionState> {
    const snapshot = await this.client.setSteeringMode(this.requireConnectionId(), mode);
    return snapshotToPiSessionState(snapshot);
  }

  async setFollowUpMode(mode: PiQueueMode): Promise<PiSessionState> {
    const snapshot = await this.client.setFollowUpMode(this.requireConnectionId(), mode);
    return snapshotToPiSessionState(snapshot);
  }

  async setAutoCompaction(enabled: boolean): Promise<PiSessionState> {
    const snapshot = await this.client.setAutoCompaction(this.requireConnectionId(), enabled);
    return snapshotToPiSessionState(snapshot);
  }

  async getSessionStatsFromSnapshot() {
    const snapshot = await this.client.requestSnapshot(this.requireConnectionId());
    return snapshotToPiSessionStats(snapshot);
  }

  async deleteSession(repoPath: string, sessionPath: string) {
    const sessions = await this.client.deleteSession(repoPath, sessionPath, this.connectionId);
    return sessions.map(sessionSummaryToPiSessionSummary);
  }

  async getSessionDiff() {
    const diff = await this.client.getWorkspaceDiff(this.requireConnectionId());
    return workspaceDiffToPiSessionDiff(diff);
  }

  getProviderCapabilities(): ProviderCapabilities | undefined {
    return this.client.getProviderCapabilities("pi");
  }
}

let agentApi: DesktopAgentApi | undefined;

export function getDesktopAgentApi(): DesktopAgentApi {
  if (!agentApi) {
    agentApi = usesLegacyAgentTransport(getAgentTransport()) ? new IpcDesktopAgentApi() : new WsDesktopAgentApi();
  }

  return agentApi;
}

