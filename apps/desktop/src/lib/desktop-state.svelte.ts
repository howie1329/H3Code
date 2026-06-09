import { goto } from "$app/navigation";

import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input/index.js";
import { extractSessionMetadata } from "$lib/components/desktop/transcript-normalize.js";
import type { ConnectionStatus } from "$lib/connection-status.js";
import { getDesktopShellApi } from "$lib/desktop-shell-api.js";
import {
  pendingInteractionToUiRequest,
  type ActiveProviderUiRequest,
  type ProviderUiResponse,
} from "$lib/interaction-ui.js";
import {
  clearAllIndexedData,
  getPreferences,
  removeIndexedRepo,
  updateDesktopSettings,
  type DesktopPreferences,
  type DesktopSettings,
  type IndexedSessionPreference,
} from "$lib/metadata-client.js";
import { getRuntimeClient } from "$lib/runtime-client.js";
import { getSessionDisplayTitle } from "$lib/session-display-title.js";
import { applySessionEvent, createEmptySessionReadModel } from "$lib/session-state.js";
import { indexedSessionToSummary } from "$lib/session-summary.js";
import {
  composerPhase,
  isAgentRunning,
  statusStripLines,
  streamingMessage,
  transcriptMessages,
} from "$lib/transcript-adapter.js";
import type { ProviderCommand, ProviderModel, ProviderQueueMode, SessionDiffState, SessionNotification } from "$lib/desktop-types.js";
import type { SessionReadModel, SessionSummary, UiSessionEvent } from "@h3code/agent-protocol";

export type WorkspaceInspector = "diff" | "context";

export type SidebarRepo = {
  name: string;
  path: string;
  expanded?: boolean;
  sessions?: SessionSummary[];
  sessionsLoaded?: boolean;
  sessionsLoading?: boolean;
  sessionsError?: string;
};

export type SessionRowStatusKind = "error" | "needs_input" | "working" | "connected" | "mapped" | "done";

export type SessionRowStatus = {
  kind: SessionRowStatusKind;
  label: string;
  dotClass: string;
};

const defaultDesktopSettings: DesktopSettings = {
  sidebarOpen: true,
  contextPanelOpen: false,
  preferDiffPanel: false,
  autoConnectOnLaunch: false,
};

export const LANDING_ADD_REPO_VALUE = "__add_repository__";

class DesktopState {
  platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");
  supportsSlashCommands = false;
  supportsModelPicker = false;
  supportsQueueSettings = false;
  supportsCompactionSettings = false;
  promptValue = $state("");
  landingRepoPath = $state<string | undefined>();
  landingPromptValue = $state("");
  activeSessionId = $state<string | undefined>();
  repoPath = $state<string | undefined>();
  worktreePath = $state<string | undefined>();
  repos = $state<SidebarRepo[]>([]);
  sessions = $state<SessionSummary[]>([]);
  selectedSessionId = $state<string | undefined>();
  sessionReadModel = $state<SessionReadModel>(createEmptySessionReadModel());
  sessionDiff = $state<SessionDiffState>({ files: [], changedFiles: 0, patch: "" });
  sessionDiffLoading = $state(false);
  sessionDiffError = $state<string | undefined>();
  sessionDiffPanelOpen = $state(false);
  slashCommands = $state<ProviderCommand[]>([]);
  slashCommandsLoading = $state(false);
  slashCommandsError = $state<string | undefined>();
  availableModels = $state<ProviderModel[]>([]);
  modelsLoading = $state(false);
  modelsError = $state<string | undefined>();
  isSwitchingSession = $state(false);
  connectionStatus = $state<ConnectionStatus>({ state: "disconnected" });
  isBusy = $state(false);
  isSendingPrompt = $state(false);
  errorMessage = $state<string | undefined>();
  preferencesLoaded = $state(false);
  preferencesDatabasePath = $state<string | undefined>();
  providerUiRequest = $state<ActiveProviderUiRequest | undefined>();
  desktopSettings = $state<DesktopSettings>(defaultDesktopSettings);

  sessionUnsubscribe: (() => void) | undefined;

  selectedSession = $derived(this.sessions.find((session) => session.id === this.selectedSessionId));
  canUseSession = $derived(this.connectionStatus.state === "connected" && Boolean(this.activeSessionId));
  isSessionReconciled = $derived(Boolean(this.activeSessionId) && !this.isSwitchingSession);
  canSubmit = $derived(
    this.canUseSession &&
      this.isSessionReconciled &&
      !this.isBusy &&
      !this.isSendingPrompt &&
      this.promptValue.trim().length > 0,
  );
  hasActiveWorkspaceSession = $derived(Boolean(this.activeSessionId));
  canSubmitLanding = $derived(
    Boolean(this.landingRepoPath && this.landingPromptValue.trim()) &&
      !this.isBusy &&
      !this.isSendingPrompt,
  );
  landingRepoName = $derived(
    this.landingRepoPath
      ? (this.repos.find((repo) => repo.path === this.landingRepoPath)?.name ?? basename(this.landingRepoPath))
      : undefined,
  );
  isAgentRunning = $derived(isAgentRunning(this.sessionReadModel));
  canChangeSessionSettings = false;
  transcriptSourceMessages = $derived(transcriptMessages(this.sessionReadModel));
  composerPhaseLine = $derived(composerPhase(this.sessionReadModel));
  statusStripLines = $derived(statusStripLines(this.sessionReadModel));
  sessionNotification = $derived<SessionNotification | null>(null);
  sessionMetadata = $derived(extractSessionMetadata(this.transcriptSourceMessages));
  sessionTitle = $derived(
    this.sessionReadModel.title ??
      (this.selectedSession ? getSessionDisplayTitle(this.selectedSession) : "No session"),
  );
  repoName = $derived(this.repoPath ? basename(this.repoPath) : "No repo selected");
  selectedRepo = $derived(this.repoPath ? this.repos.find((repo) => repo.path === this.repoPath) : undefined);
  hasSessionDiff = $derived((this.sessionReadModel.diffSummary?.changedFiles ?? 0) > 0);
  activeInspector = $derived.by((): WorkspaceInspector | null => {
    if (this.sessionDiffPanelOpen && this.hasSessionDiff) {
      return "diff";
    }

    if (this.desktopSettings.contextPanelOpen) {
      return "context";
    }

    return null;
  });

  async ensureWorkspaceRoute() {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname !== "/workspace") {
      await goto("/workspace");
    }
  }

  async ensureLandingRoute() {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname !== "/") {
      await goto("/");
    }
  }

  focusLandingComposer() {
    window.dispatchEvent(new CustomEvent("h3code:focus-landing-composer"));
  }

  initializeListeners() {
    const runtime = getRuntimeClient();

    runtime.setListeners({
      onConnectionStatus: (status) => {
        if (!status.connected) {
          this.connectionStatus = {
            state: "disconnected",
            message: status.message,
          };
        }
      },
      onError: (error) => {
        this.errorMessage = error.message;
      },
    });

    return () => {
      runtime.setListeners({});
    };
  }

  async initializePreferences() {
    if (!window.h3code) {
      return;
    }

    try {
      const preferences = await getPreferences();
      this.applyPreferencesSnapshot(preferences);
      this.clearWorkspaceSessionState();
      await this.ensureLandingRoute();
    } catch (error) {
      this.preferencesLoaded = true;
      this.errorMessage = getErrorMessage(error);
    }
  }

  async handleSelectRepo() {
    const selected = await this.getShellApi().selectRepo();

    if (!selected) {
      return;
    }

    await this.addRepo(selected.path);
  }

  async addRepo(nextRepoPath: string) {
    this.errorMessage = undefined;
    this.repos = upsertRepo(this.repos, nextRepoPath, { expanded: true });
    await this.loadRepoSessions(nextRepoPath, true);
  }

  async toggleRepo(nextRepoPath: string) {
    const repo = this.repos.find((item) => item.path === nextRepoPath);
    const expanded = !repo?.expanded;

    this.repos = updateRepo(this.repos, nextRepoPath, { expanded });

    if (expanded && !repo?.sessionsLoaded && !repo?.sessionsLoading) {
      await this.loadRepoSessions(nextRepoPath);
    }
  }

  async loadRepoSessions(nextRepoPath: string, markRecent = false) {
    this.repos = updateRepo(this.repos, nextRepoPath, {
      sessionsLoading: true,
      sessionsError: undefined,
    });

    try {
      const sessions = await getRuntimeClient().listSessions({ repoPath: nextRepoPath, markRecent });
      this.repos = updateRepo(this.repos, nextRepoPath, {
        sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });

      if (nextRepoPath === this.repoPath) {
        this.sessions = sessions;
      }
    } catch (error) {
      this.repos = updateRepo(this.repos, nextRepoPath, {
        sessionsLoading: false,
        sessionsError: getErrorMessage(error),
      });
    }
  }

  async connectRepo(nextRepoPath: string) {
    await this.withBusy(async () => {
      await this.connectRepoInternal(nextRepoPath);
    });
  }

  async connectRepoInternal(
    nextRepoPath: string,
    options: { navigateToWorkspace?: boolean } = {},
  ) {
    const { navigateToWorkspace = true } = options;
    this.errorMessage = undefined;
    this.connectionStatus = { state: "starting", repoPath: nextRepoPath };

    try {
      const runtime = getRuntimeClient();
      const session = await runtime.createSession(nextRepoPath);
      await this.attachSession(session, nextRepoPath);

      const listedSessions = await getRuntimeClient().listSessions({ repoPath: nextRepoPath, markRecent: true });
      const sessions = this.mergeLiveSession(listedSessions, session, nextRepoPath);

      this.repos = upsertRepo(this.repos, nextRepoPath, {
        expanded: true,
        sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });
      this.sessions = sessions;

      if (navigateToWorkspace) {
        await this.ensureWorkspaceRoute();
      }
    } catch (error) {
      this.connectionStatus = { state: "error", repoPath: nextRepoPath, message: getErrorMessage(error) };
      throw error;
    }
  }

  async attachSession(session: SessionReadModel, nextRepoPath: string) {
    this.sessionUnsubscribe?.();
    this.activeSessionId = session.id;
    this.repoPath = nextRepoPath;
    this.worktreePath = nextRepoPath;
    this.sessionReadModel = session;
    this.selectedSessionId = session.id;
    this.connectionStatus = {
      state: "connected",
      sessionId: session.id,
      repoPath: nextRepoPath,
    };
    this.supportsSlashCommands = true;
    this.supportsModelPicker = true;
    this.supportsQueueSettings = true;
    this.supportsCompactionSettings = true;
    this.canChangeSessionSettings = true;
    this.syncPendingInteraction();
    this.applyDiffSummary(session.diffSummary);

    this.sessions = this.mergeLiveSession(this.sessions, session, nextRepoPath);
    this.repos = updateRepo(this.repos, nextRepoPath, { sessions: this.sessions });

    this.sessionUnsubscribe = await getRuntimeClient().subscribeSession(session.id, (event) => {
      this.handleUiSessionEvent(event);
    });
  }

  clearWorkspaceSessionState() {
    this.sessionUnsubscribe?.();
    this.sessionUnsubscribe = undefined;
    this.repoPath = undefined;
    this.activeSessionId = undefined;
    this.worktreePath = undefined;
    this.sessions = [];
    this.selectedSessionId = undefined;
    this.isSwitchingSession = false;
    this.sessionReadModel = createEmptySessionReadModel();
    this.connectionStatus = { state: "disconnected" };
    this.resetSessionDiff();
    this.promptValue = "";
    this.providerUiRequest = undefined;
  }

  async enterLanding(options: { repoPath?: string } = {}) {
    this.clearWorkspaceSessionState();
    this.landingRepoPath = options.repoPath;
    this.landingPromptValue = "";
    this.errorMessage = undefined;
    await this.ensureLandingRoute();
  }

  async addRepoFromLanding() {
    const selected = await this.getShellApi().selectRepo();

    if (!selected) {
      return;
    }

    await this.addRepo(selected.path);
    this.landingRepoPath = selected.path;
  }

  async handleSwitchSession(sessionId: string, repoPath = this.repoPath) {
    if (!repoPath) {
      this.errorMessage = "Select a repo before switching sessions.";
      return;
    }

    this.isSwitchingSession = true;

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const session = await getRuntimeClient().switchSession(repoPath, sessionId);
      this.resetSessionDiff();
      await this.attachSession(session, repoPath);
      const sessions = await getRuntimeClient().listSessions({ repoPath, markRecent: true });
      this.sessions = this.mergeLiveSession(sessions, session, repoPath);
      this.repos = updateRepo(this.repos, repoPath, {
        expanded: true,
        sessions: this.sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });
      await this.ensureWorkspaceRoute();
    });

    this.isSwitchingSession = false;
  }

  async handleNewSession(repoPath = this.repoPath) {
    if (!repoPath) {
      this.errorMessage = "Select a repo before creating a session.";
      return;
    }

    await this.ensureWorkspaceRoute();

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await this.connectRepoInternal(repoPath, { navigateToWorkspace: true });
    });
  }

  async startSessionFromLanding(repoPath: string, promptText: string) {
    const text = promptText.trim();

    if (!repoPath || !text) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;

      try {
        await this.connectRepoInternal(repoPath, { navigateToWorkspace: false });
        this.landingPromptValue = "";
        await this.ensureWorkspaceRoute();
        await this.sendPromptText(text);
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
      }
    });
  }

  async sendPromptText(text: string) {
    if (!text || !this.canUseSession || !this.activeSessionId) {
      return;
    }

    this.isSendingPrompt = true;

    try {
      this.errorMessage = undefined;
      await getRuntimeClient().sendTurn(this.activeSessionId, text);
      this.promptValue = "";
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
      throw error;
    } finally {
      this.isSendingPrompt = false;
    }
  }

  async removeRepoFromIndex(repoPath: string) {
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const preferences = await removeIndexedRepo(repoPath);
      this.applyPreferencesSnapshot(preferences);

      if (this.repoPath === repoPath) {
        this.clearWorkspaceSessionState();
      }
    });
  }

  async deleteSession(sessionId: string, repoPath = this.repoPath) {
    if (!repoPath) {
      this.errorMessage = "Select a repo before deleting a session.";
      return;
    }

    const deletingActive = sessionId === this.selectedSessionId || sessionId === this.activeSessionId;

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const sessions = await getRuntimeClient().deleteSession(repoPath, sessionId);
      this.sessions = sessions;
      this.repos = updateRepo(this.repos, repoPath, {
        sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });

      if (deletingActive) {
        this.clearWorkspaceSessionState();
        this.landingRepoPath = repoPath;
        await this.ensureLandingRoute();
      }
    });
  }

  async handleSteerSubmit(text: string) {
    await this.sendPromptText(text);
  }

  async handlePromptSubmit(message: PromptInputMessage, event: SubmitEvent) {
    event.preventDefault();

    const text = message.text?.trim();

    if (!text || !this.canUseSession) {
      return;
    }

    try {
      await this.sendPromptText(text);
    } catch {
      // sendPromptText records errorMessage
    }
  }

  async handleAbort() {
    if (!this.activeSessionId) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await getRuntimeClient().abortTurn(this.activeSessionId!);
    });
  }

  async refreshSessionDiff() {
    if (!this.activeSessionId) {
      this.resetSessionDiff();
      return;
    }

    this.sessionDiffLoading = true;
    this.sessionDiffError = undefined;

    try {
      const snapshot = await getRuntimeClient().requestSnapshot(this.activeSessionId);
      this.sessionReadModel = snapshot;
      this.applyDiffSummary(snapshot.diffSummary);
    } catch (error) {
      this.sessionDiffError = getErrorMessage(error);
    } finally {
      this.sessionDiffLoading = false;
    }
  }

  setSessionDiffPanelOpen(open: boolean) {
    if (open && !this.hasSessionDiff) {
      return;
    }

    if (open) {
      this.sessionDiffPanelOpen = true;

      if (this.desktopSettings.contextPanelOpen) {
        void this.persistDesktopSettings({ contextPanelOpen: false });
      }

      void this.refreshSessionDiff();
      return;
    }

    this.sessionDiffPanelOpen = false;
  }

  resetSessionDiff() {
    this.sessionDiff = { files: [], changedFiles: 0 };
    this.sessionDiffLoading = false;
    this.sessionDiffError = undefined;
    this.sessionDiffPanelOpen = false;
  }

  applyDiffSummary(diffSummary: SessionDiffState | undefined) {
    if (!diffSummary) {
      return;
    }

    this.sessionDiff = {
      ...diffSummary,
      patch: this.sessionDiff.patch ?? "",
    };

    if (!this.hasSessionDiff) {
      this.sessionDiffPanelOpen = false;
    } else if (this.desktopSettings.preferDiffPanel) {
      this.sessionDiffPanelOpen = true;
    }
  }

  async ensureSlashCommands(refresh = false) {
    if (!this.activeSessionId || !this.supportsSlashCommands) {
      this.slashCommands = [];
      this.slashCommandsLoaded = false;
      return;
    }

    if (this.slashCommandsLoaded && !refresh) {
      return;
    }

    this.slashCommandsLoading = true;
    this.slashCommandsError = undefined;

    try {
      this.slashCommands = await getRuntimeClient().listProviderCommands(this.activeSessionId);
      this.slashCommandsLoaded = true;
    } catch (error) {
      this.slashCommandsError = getErrorMessage(error);
    } finally {
      this.slashCommandsLoading = false;
    }
  }

  slashCommandsLoaded = false;

  async ensureAvailableModels(refresh = false) {
    if (!this.activeSessionId || !this.supportsModelPicker) {
      this.availableModels = [];
      this.modelsLoaded = false;
      return;
    }

    if (this.modelsLoaded && !refresh) {
      return;
    }

    this.modelsLoading = true;
    this.modelsError = undefined;

    try {
      this.availableModels = (await getRuntimeClient().listProviderModels(this.activeSessionId)).map((model) => ({
        ...model,
        provider: model.provider ?? this.sessionReadModel.providerId,
        modelId: model.modelId ?? model.id,
      }));
      this.modelsLoaded = true;
    } catch (error) {
      this.modelsError = getErrorMessage(error);
    } finally {
      this.modelsLoading = false;
    }
  }

  modelsLoaded = false;

  async setModel(provider: string | undefined, modelId: string) {
    if (!this.activeSessionId) {
      return;
    }

    const model = this.availableModels.find((entry) => entry.id === modelId || entry.modelId === modelId) ?? {
      id: modelId,
      modelId,
      provider,
    };

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      this.sessionReadModel = await getRuntimeClient().setModel(this.activeSessionId!, model);
    });
  }

  async setThinkingLevel(level: string) {
    if (!this.activeSessionId) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      this.sessionReadModel = await getRuntimeClient().setThinkingLevel(this.activeSessionId!, level);
    });
  }

  async setSteeringMode(mode: string) {
    if (!this.activeSessionId) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      this.sessionReadModel = await getRuntimeClient().setQueueSettings(this.activeSessionId!, {
        steeringMode: mode as ProviderQueueMode,
      });
    });
  }

  async setFollowUpMode(mode: string) {
    if (!this.activeSessionId) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      this.sessionReadModel = await getRuntimeClient().setQueueSettings(this.activeSessionId!, {
        followUpMode: mode as ProviderQueueMode,
      });
    });
  }

  async setAutoCompaction(enabled: boolean) {
    if (!this.activeSessionId) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      this.sessionReadModel = await getRuntimeClient().setAutoCompaction(this.activeSessionId!, enabled);
    });
  }

  setSidebarOpen(open: boolean) {
    if (this.desktopSettings.sidebarOpen === open) {
      return;
    }

    void this.persistDesktopSettings({ sidebarOpen: open });
  }

  toggleSidebar() {
    this.setSidebarOpen(!this.desktopSettings.sidebarOpen);
  }

  toggleContextPanel() {
    this.setContextPanelOpen(!this.desktopSettings.contextPanelOpen);
  }

  toggleSessionDiffPanel() {
    this.setSessionDiffPanelOpen(!this.sessionDiffPanelOpen);
  }

  focusComposer() {
    window.dispatchEvent(new CustomEvent("h3code:focus-composer"));
  }

  setContextPanelOpen(open: boolean) {
    if (open) {
      this.sessionDiffPanelOpen = false;
    }

    if (this.desktopSettings.contextPanelOpen === open) {
      return;
    }

    void this.persistDesktopSettings({ contextPanelOpen: open });
  }

  setPreferDiffPanel(enabled: boolean) {
    if (this.desktopSettings.preferDiffPanel === enabled) {
      return;
    }

    void this.persistDesktopSettings({ preferDiffPanel: enabled });

    if (enabled && this.hasSessionDiff) {
      this.sessionDiffPanelOpen = true;
    }
  }

  setAutoConnectOnLaunch(enabled: boolean) {
    if (this.desktopSettings.autoConnectOnLaunch === enabled) {
      return;
    }

    void this.persistDesktopSettings({ autoConnectOnLaunch: enabled });
  }

  async revealPreferencesDatabase() {
    return this.getShellApi().revealPreferencesDatabase();
  }

  async revealFolder() {
    const targetPath = this.sessionDiffCwd();

    if (!targetPath) {
      throw new Error("No folder is available to reveal.");
    }

    return this.getShellApi().revealPath(targetPath);
  }

  async clearAllIndexedData() {
    const preferences = await clearAllIndexedData();
    this.applyPreferencesSnapshot(preferences);
    this.clearWorkspaceSessionState();
  }

  applyPreferencesSnapshot(preferences: DesktopPreferences) {
    this.preferencesLoaded = true;
    this.preferencesDatabasePath = preferences.databasePath;
    this.desktopSettings = preferences.desktopSettings;

    const indexedSessionsByRepo = groupIndexedSessionsByRepo(preferences.indexedSessions);
    this.repos = preferences.recentRepos.map((repo) =>
      createRepo(repo.path, {
        name: repo.name,
        expanded: false,
        sessions: indexedSessionsByRepo.get(repo.path) ?? [],
        sessionsLoaded: Boolean(repo.sessionsIndexedAt),
        sessionsLoading: false,
        sessionsError: undefined,
      }),
    );
  }

  async persistDesktopSettings(settings: Partial<DesktopSettings>) {
    const previous = this.desktopSettings;
    this.desktopSettings = { ...this.desktopSettings, ...settings };

    try {
      await updateDesktopSettings(settings);
    } catch (error) {
      this.desktopSettings = previous;
      this.errorMessage = getErrorMessage(error);
    }
  }

  mergeLiveSession(sessions: SessionSummary[], session: SessionReadModel, repoPath: string): SessionSummary[] {
    const existingIndex = sessions.findIndex((entry) => entry.id === session.id);

    if (existingIndex !== -1) {
      return sessions.map((entry, index) =>
        index === existingIndex ? { ...entry, status: session.status } : entry,
      );
    }

    return [liveSessionToSummary(session, repoPath), ...sessions];
  }

  getSessionRowStatus(session: SessionSummary): SessionRowStatus {
    if (session.id === this.activeSessionId) {
      if (this.providerUiRequest) {
        return createSessionRowStatus("needs_input");
      }

      if (this.isAgentRunning) {
        return createSessionRowStatus("working");
      }

      if (this.connectionStatus.state === "connected") {
        return createSessionRowStatus("connected");
      }

      if (this.connectionStatus.state === "error") {
        return createSessionRowStatus("error");
      }
    }

    return session.worktreePath ? createSessionRowStatus("mapped") : createSessionRowStatus("done");
  }

  handleUiSessionEvent(event: UiSessionEvent) {
    this.sessionReadModel = applySessionEvent(this.sessionReadModel, event);
    this.syncPendingInteraction();

    if (event.type === "session.patch" || event.type === "session.snapshot") {
      this.applyDiffSummary(this.sessionReadModel.diffSummary);
    }
  }

  dismissSessionNotification(_notificationId: string) {}

  clearProviderUiRequest() {
    this.providerUiRequest = undefined;
  }

  async respondToProviderUi(response: ProviderUiResponse) {
    if (!this.activeSessionId) {
      return;
    }

    const interaction = this.sessionReadModel.pendingInteractions.find((item) => item.id === response.requestId);

    if (!interaction) {
      return;
    }

    if (interaction.kind === "approval") {
      await getRuntimeClient().resolveApproval(
        this.activeSessionId,
        response.requestId,
        response.kind === "confirm" ? response.accepted : false,
        response,
      );
    } else {
      await getRuntimeClient().resolveUserInput(this.activeSessionId, response.requestId, response);
    }

    this.clearProviderUiRequest();
  }

  syncPendingInteraction() {
    const pending = this.sessionReadModel.pendingInteractions[0];

    if (!pending) {
      this.providerUiRequest = undefined;
      return;
    }

    const uiRequest = pendingInteractionToUiRequest(pending);

    if (!uiRequest) {
      this.providerUiRequest = undefined;
      return;
    }

    this.providerUiRequest = {
      ...uiRequest,
      sessionId: this.activeSessionId,
    };
  }

  async withBusy(action: () => Promise<void>) {
    this.isBusy = true;

    try {
      await action();
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    } finally {
      this.isBusy = false;
    }
  }

  sessionDiffCwd() {
    return this.worktreePath ?? this.repoPath;
  }

  getShellApi() {
    if (!window.h3code) {
      throw new Error("Desktop API is unavailable.");
    }

    return getDesktopShellApi();
  }
}

export const desktopState = new DesktopState();

export function basename(value: string) {
  const clean = value.replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1) || clean;
}

function createRepo(nextRepoPath: string, updates: Partial<SidebarRepo> = {}): SidebarRepo {
  return {
    name: basename(nextRepoPath),
    path: nextRepoPath,
    expanded: false,
    sessions: [],
    sessionsLoaded: false,
    sessionsLoading: false,
    ...updates,
  };
}

function upsertRepo(currentRepos: SidebarRepo[], nextRepoPath: string, updates: Partial<SidebarRepo> = {}) {
  const existingRepoIndex = currentRepos.findIndex((repo) => repo.path === nextRepoPath);

  if (existingRepoIndex === -1) {
    return [...currentRepos, createRepo(nextRepoPath, updates)];
  }

  return currentRepos.map((repo, index) =>
    index === existingRepoIndex ? { ...repo, ...updates, name: basename(nextRepoPath), path: nextRepoPath } : repo,
  );
}

function updateRepo(currentRepos: SidebarRepo[], nextRepoPath: string, updates: Partial<SidebarRepo>) {
  if (!currentRepos.some((repo) => repo.path === nextRepoPath)) {
    return [...currentRepos, createRepo(nextRepoPath, updates)];
  }

  return currentRepos.map((repo) => (repo.path === nextRepoPath ? { ...repo, ...updates } : repo));
}

function liveSessionToSummary(session: SessionReadModel, repoPath: string): SessionSummary {
  const timestamp = session.updatedAt || Date.now();
  const firstUserMessage = session.messages.find((message) => message.role === "user");

  return {
    id: session.id,
    providerId: session.providerId ?? "pi",
    providerSessionRef: session.providerSessionRef,
    status: session.status === "running" ? "running" : session.status === "error" ? "error" : "idle",
    title: session.title,
    preview: typeof firstUserMessage?.content === "string" ? firstUserMessage.content : undefined,
    repoPath,
    createdAt: timestamp,
    updatedAt: timestamp,
    worktreePath: repoPath,
    messageCount: session.messages.length,
  };
}

function groupIndexedSessionsByRepo(indexedSessions: IndexedSessionPreference[]) {
  const sessionsByRepo = new Map<string, SessionSummary[]>();

  for (const session of indexedSessions) {
    const sessions = sessionsByRepo.get(session.repoPath) ?? [];
    sessions.push(indexedSessionToSummary(session));
    sessionsByRepo.set(session.repoPath, sessions);
  }

  return sessionsByRepo;
}

function createSessionRowStatus(kind: SessionRowStatusKind): SessionRowStatus {
  switch (kind) {
    case "error":
      return { kind, label: "Agent error", dotClass: "bg-destructive" };
    case "needs_input":
      return { kind, label: "Needs input", dotClass: "animate-pulse bg-amber-500" };
    case "working":
      return { kind, label: "Agent running", dotClass: "animate-pulse bg-primary" };
    case "connected":
      return { kind, label: "Connected", dotClass: "bg-primary" };
    case "mapped":
      return { kind, label: "Worktree available", dotClass: "border border-muted-foreground/45 bg-transparent" };
    case "done":
      return { kind, label: "Done", dotClass: "bg-muted-foreground/25" };
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export { formatMessageRole, formatMessageText } from "$lib/message-format.js";

// Re-export desktop UI types for components.
export type { SessionStats } from "$lib/session-stats.js";
export type { ProviderCommand, ProviderModel, ProviderQueueMode, SessionNotification } from "$lib/desktop-types.js";
