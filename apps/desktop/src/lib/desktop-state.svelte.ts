import { goto } from "$app/navigation";

import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input/index.js";
import { extractSessionMetadata } from "$lib/components/desktop/transcript-normalize.js";
import { formatMessageRole, formatMessageText } from "$lib/message-format.js";
import type { SessionDomainEvent } from "$lib/pi-session/domain-events.js";
import type { SessionActivity, SessionReadModel } from "$lib/pi-session/read-model.js";
import {
  applySessionEvent,
  createInitialSessionReadModel,
  hydrateFromSnapshot,
} from "$lib/pi-session/projector.js";
import {
  composerPhase,
  latestNotification,
  statusStripLines as selectStatusStripLines,
  transcriptMessages as selectTranscriptMessages,
} from "$lib/pi-session/selectors.js";
import type { ActiveProviderUiRequest } from "$lib/agent-session-client.js";
import type { ConnectionStatus } from "$lib/connection-status.js";
import { mergeModelWithCatalog, normalizeModel, normalizeThinkingLevel, type ThinkingLevel } from "$lib/provider-model.js";
import { parseSessionStats, type SessionStats } from "$lib/session-stats.js";
import { indexedSessionToSummary } from "$lib/session-summary.js";
import type {
  DesktopSettings,
  IndexedSessionPreference,
  PreferencesSnapshot,
  ProviderCommand,
  ProviderModel,
  ProviderQueueMode,
  ProviderUiResponse,
  SessionMessageCacheState,
  SessionSnapshot,
  SessionSummary,
  WorkspaceDiffSummary,
} from "@h3code/agent-core";
import type { ProviderCapabilities } from "@h3code/agent-core";

import { getAgentSessionClient } from "$lib/agent-session-client.js";
import { getDesktopShellApi } from "$lib/desktop-shell-api.js";
import { getSessionDisplayTitle } from "$lib/session-display-title.js";
import {
  clearSessionCache,
  deleteCachedSession,
  getCachedSession,
  setCachedSession,
  type SessionCacheEntry,
  type SessionCacheMap,
} from "$lib/session-cache.js";

export type WorkspaceInspector = "diff" | "context";

export type ActivityItem = {
  type: string;
  detail: string;
};

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

type AgentSessionEvent = SessionDomainEvent & { connectionId?: string };

class DesktopState {
  platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");
  providerCapabilities = $state<ProviderCapabilities | null>(null);
  supportsSlashCommands = $derived(this.providerCapabilities?.ui.commands === true);
  supportsModelPicker = $derived(this.providerCapabilities?.ui.modelsList === true);
  supportsQueueSettings = $derived(this.providerCapabilities?.ui.queueSettings === true);
  supportsCompactionSettings = $derived(this.providerCapabilities?.ui.compaction === true);
  promptValue = $state("");
  landingRepoPath = $state<string | undefined>();
  landingPromptValue = $state("");
  activeConnectionId = $state<string | undefined>();
  repoPath = $state<string | undefined>();
  worktreePath = $state<string | undefined>();
  repos = $state<SidebarRepo[]>([]);
  sessions = $state<SessionSummary[]>([]);
  selectedSessionRef = $state<string | undefined>();
  sessionSnapshot = $state<SessionSnapshot | undefined>();
  sessionStats = $state<SessionStats | null>(null);
  sessionStatsLoading = $state(false);
  sessionStatsError = $state<string | undefined>();
  sessionDiff = $state<WorkspaceDiffSummary>({ files: [], updatedAt: 0, patch: "", changedFiles: 0 });
  sessionDiffLoading = $state(false);
  sessionDiffError = $state<string | undefined>();
  sessionDiffPanelOpen = $state(false);
  slashCommands = $state<ProviderCommand[]>([]);
  slashCommandsLoading = $state(false);
  slashCommandsError = $state<string | undefined>();
  slashCommandsLoaded = $state(false);
  slashCommandsSessionKey = $state<string | undefined>();
  availableModels = $state<ProviderModel[]>([]);
  modelsLoading = $state(false);
  modelsError = $state<string | undefined>();
  modelsLoaded = $state(false);
  modelsSessionKey = $state<string | undefined>();
  sessionReadModel = $state<SessionReadModel>(createInitialSessionReadModel());
  sessionCaches = $state<SessionCacheMap>({});
  messageCacheSyncing = $state(false);
  isSwitchingSession = $state(false);
  messageCachePersistTimer: ReturnType<typeof setTimeout> | undefined;
  reconciledSessionRef = $state<string | undefined>();
  switchGeneration = 0;
  connectionReadModels = $state<Record<string, SessionReadModel>>({});
  connectionStatuses = $state<Record<string, ConnectionStatus>>({});
  providerUiRequestsByConnection = $state<Record<string, ActiveProviderUiRequest>>({});
  connectionStatus = $state<ConnectionStatus>({ state: "disconnected" });
  isBusy = $state(false);
  isSendingPrompt = $state(false);
  errorMessage = $state<string | undefined>();
  preferencesLoaded = $state(false);
  preferencesDatabasePath = $state<string | undefined>();
  providerUiRequest = $state<ActiveProviderUiRequest | undefined>();
  desktopSettings = $state<DesktopSettings>(defaultDesktopSettings);

  reconcileInFlight = false;
  reconcileAgain = false;
  diffRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  runEndedHousekeepingTimer: ReturnType<typeof setTimeout> | undefined;
  pendingStreamingUpdates = new Map<string, AgentSessionEvent>();
  streamingUpdateFrame: ReturnType<typeof requestAnimationFrame> | undefined;

  selectedSession = $derived(this.sessions.find((session) => session.sessionRef === this.selectedSessionRef));
  canUseSession = $derived(this.connectionStatus.state === "connected" && Boolean(this.selectedSessionRef || this.sessionSnapshot?.summary.sessionRef));
  isSessionReconciled = $derived(
    Boolean(this.selectedSessionRef) &&
      this.selectedSessionRef === this.reconciledSessionRef &&
      !this.isSwitchingSession,
  );
  canSubmit = $derived(
    this.canUseSession &&
      this.isSessionReconciled &&
      !this.isBusy &&
      !this.isSendingPrompt &&
      this.promptValue.trim().length > 0,
  );
  hasActiveWorkspaceSession = $derived(
    Boolean(this.selectedSessionRef || this.sessionSnapshot?.summary.sessionRef),
  );
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
  isAgentRunning = $derived(this.sessionReadModel.isAgentRunning);
  canChangeSessionSettings = $derived(
    this.canUseSession &&
      this.isSessionReconciled &&
      !this.isBusy &&
      !this.isSendingPrompt &&
      !this.isAgentRunning &&
      !this.sessionSnapshot?.isStreaming,
  );
  activity = $derived(
    this.sessionReadModel.activities.slice(0, 8).map((item: SessionActivity) => ({
      type: item.type,
      detail: item.detail,
    })),
  );
  transcriptMessages = $derived(selectTranscriptMessages(this.sessionReadModel));
  composerPhaseLine = $derived(composerPhase(this.sessionReadModel));
  statusStripLines = $derived(selectStatusStripLines(this.sessionReadModel));
  sessionNotification = $derived(latestNotification(this.sessionReadModel));
  sessionMetadata = $derived(extractSessionMetadata(this.transcriptMessages));
  sessionTitle = $derived(
    this.selectedSession ? getSessionDisplayTitle(this.selectedSession) : "No session"
  );
  repoName = $derived(this.repoPath ? basename(this.repoPath) : "No repo selected");
  selectedRepo = $derived(this.repoPath ? this.repos.find((repo) => repo.path === this.repoPath) : undefined);
  hasSessionDiff = $derived((this.sessionDiff.patch ?? "").trim().length > 0);
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
    const agentApi = getAgentSessionClient();

    agentApi.setListeners({
      onSessionEvent: (connectionId, event) => {
        this.handleSessionEvent({ ...event, connectionId });
      },
      onConnectionStatus: (status) => {
        this.applyConnectionStatus({
          state: status.state,
          connectionId: status.connectionId,
          repoPath: status.repoPath,
          message: status.message,
        });
      },
      onProviderUiRequest: (request) => {
        this.applyProviderUiRequest(request);
      },
      onWorkspaceDiff: (_connectionId, diff) => {
        this.applyWorkspaceDiff(diff);
      },
    });

    return () => {
      agentApi.setListeners({});
    };
  }

  applyConnectionStatus(status: ConnectionStatus) {
    if (status.connectionId) {
      this.connectionStatuses = {
        ...this.connectionStatuses,
        [status.connectionId]: status,
      };

      if (!this.activeConnectionId) {
        this.activeConnectionId = status.connectionId;
      }
    }

    const isActiveStatus = !status.connectionId || status.connectionId === this.activeConnectionId;

    if (isActiveStatus) {
      this.connectionStatus = status;

      if (status.state !== "connected") {
        this.resetSlashCommands();
        this.resetModels();
        this.resetSessionReadModel();
        this.resetSessionDiff();
        this.clearProviderUiRequest();
        this.cancelDebouncedDiffRefresh();
      }

      if (status.message) {
        this.errorMessage = status.message;
      }
    }
  }

  applyProviderUiRequest(request: ActiveProviderUiRequest) {
    const connectionId = request.connectionId ?? this.activeConnectionId;

    if (connectionId) {
      this.providerUiRequestsByConnection = {
        ...this.providerUiRequestsByConnection,
        [connectionId]: request,
      };
    }

    if (!connectionId || connectionId === this.activeConnectionId) {
      this.providerUiRequest = request;
    }
  }

  async initializePreferences() {
    if (!window.h3code) {
      return;
    }

    try {
      const preferences = await this.getSessionClient().getPreferences();
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
      const sessions = await this.getSessionClient().listRepoSessions(nextRepoPath, markRecent);
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

  async connectRepo(nextRepoPath: string, selectedSessionRef?: string) {
    await this.withBusy(async () => {
      await this.connectRepoInternal(nextRepoPath, selectedSessionRef);
    });
  }

  async connectRepoInternal(
    nextRepoPath: string,
    selectedSessionRef?: string,
    options: { navigateToWorkspace?: boolean } = {},
  ) {
    const { navigateToWorkspace = true } = options;
    this.errorMessage = undefined;

    if (selectedSessionRef) {
      await this.applyMessageCacheIfPresent(selectedSessionRef, nextRepoPath);
    }

    const result = await this.getSessionClient().connectRepo(nextRepoPath, selectedSessionRef);
    this.syncProviderCapabilities();

    this.repoPath = result.repoPath;
    this.activeConnectionId = result.connectionId;
    this.worktreePath = result.repoPath;
    this.syncActiveConnectionStatus();
    this.repos = upsertRepo(this.repos, result.repoPath, {
      expanded: true,
      sessions: result.sessions,
      sessionsLoaded: true,
      sessionsLoading: false,
      sessionsError: undefined,
    });
    this.sessions = result.sessions;
    this.selectedSessionRef = result.selectedSessionRef;
    this.sessionSnapshot = result.snapshot;
    this.sessionStats = parseSessionStats(result.snapshot);
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
    this.sessionReadModel = hydrateFromSnapshot(
      createInitialSessionReadModel(),
      result.snapshot,
      result.snapshot.messages,
    );
    this.storeActiveConnectionReadModel();
    this.reconciledSessionRef = this.selectedSessionRef;
    this.messageCacheSyncing = false;
    this.cacheCurrentSession();
    void this.persistSessionMessageCacheImmediate();
    void this.refreshSessionStats();
    void this.refreshSessionDiff();
    void this.ensureAvailableModels(true);

    if (navigateToWorkspace) {
      await this.ensureWorkspaceRoute();
    }
  }

  clearWorkspaceSessionState() {
    this.repoPath = undefined;
    this.activeConnectionId = undefined;
    this.worktreePath = undefined;
    this.sessions = [];
    this.selectedSessionRef = undefined;
    this.reconciledSessionRef = undefined;
    this.isSwitchingSession = false;
    this.messageCacheSyncing = false;
    this.cancelMessageCachePersist();
    this.sessionCaches = clearSessionCache();
    this.sessionSnapshot = undefined;
    this.sessionStats = null;
    this.connectionStatus = { state: "disconnected" };
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
    this.resetSessionReadModel();
    this.promptValue = "";
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

  async handleSwitchSession(sessionPath: string, repoPath = this.repoPath) {
    if (!repoPath) {
      return;
    }

    await this.ensureWorkspaceRoute();

    if (repoPath !== this.repoPath || this.connectionStatus.state !== "connected") {
      await this.connectRepo(repoPath, sessionPath);
      return;
    }

    if (sessionPath === this.selectedSessionRef && this.isSessionReconciled) {
      return;
    }

    this.cacheCurrentSession();
    this.switchGeneration += 1;
    const generation = this.switchGeneration;

    this.errorMessage = undefined;
    this.selectedSessionRef = sessionPath;

    const cached = getCachedSession(this.sessionCaches, sessionPath);

    if (cached) {
      this.sessionCaches = setCachedSession(this.sessionCaches, {
        ...cached,
        lastAccessedAt: Date.now(),
      });
      this.applyCachedSession(cached);
    } else {
      const sqlApplied = await this.applyMessageCacheIfPresent(sessionPath, repoPath);

      if (!sqlApplied) {
        this.sessionReadModel = createInitialSessionReadModel();
        this.sessionSnapshot = undefined;
        this.sessionStats = null;
        this.resetSessionDiff();
        this.resetSlashCommands();
        this.resetModels();
      }
    }

    this.isSwitchingSession = true;
    void this.reconcileSessionSwitch(sessionPath, generation);
  }

  async reconcileSessionSwitch(sessionPath: string, generation: number) {
    try {
      const snapshot = await this.getSessionClient().switchSession(sessionPath);
      if (generation !== this.switchGeneration) {
        return;
      }

      this.worktreePath = this.repoPath;
      this.selectedSessionRef = sessionPath;
      this.sessionSnapshot = snapshot;
      this.sessionStats = parseSessionStats(snapshot);
      this.sessionReadModel = hydrateFromSnapshot(
        createInitialSessionReadModel(),
        snapshot,
        snapshot.messages,
      );
      this.reconciledSessionRef = sessionPath;
      this.messageCacheSyncing = false;
      this.storeActiveConnectionReadModel();
      this.cacheCurrentSession();
      void this.persistSessionMessageCacheImmediate();
      void this.refreshSessionStats();
      void this.refreshSessionDiff();
      void this.ensureAvailableModels(true);
    } catch (error) {
      if (generation === this.switchGeneration) {
        this.errorMessage = getErrorMessage(error);
      }
    } finally {
      if (generation === this.switchGeneration) {
        this.isSwitchingSession = false;
      }
    }
  }

  async createNewSessionForRepo(repoPath: string) {
    const parentSessionPath = this.selectedSessionRef;
    const snapshot = await this.getSessionClient().createSession(parentSessionPath);
    this.worktreePath = this.repoPath;
    this.sessionSnapshot = snapshot;
    this.selectedSessionRef = snapshot.summary.sessionRef;
    this.sessionStats = parseSessionStats(snapshot);
    this.sessionReadModel = hydrateFromSnapshot(
      createInitialSessionReadModel(),
      snapshot,
      snapshot.messages,
    );
    this.reconciledSessionRef = this.selectedSessionRef;
    this.messageCacheSyncing = false;
    this.cacheCurrentSession();
    void this.persistSessionMessageCacheImmediate();
    this.sessions = await this.getSessionClient().listSessions();
    this.repos = upsertRepo(this.repos, repoPath, {
      expanded: true,
      sessions: this.sessions,
      sessionsLoaded: true,
      sessionsLoading: false,
      sessionsError: undefined,
    });
    await this.refreshSessionStats();
    await this.refreshSessionDiff();
    void this.ensureAvailableModels(true);
  }

  async handleNewSession(repoPath = this.repoPath) {
    if (!repoPath) {
      this.errorMessage = "Select a repo before creating a session.";
      return;
    }

    await this.ensureWorkspaceRoute();

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await this.connectRepoInternal(repoPath, undefined, { navigateToWorkspace: true });
      await this.createNewSessionForRepo(repoPath);
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
        await this.connectRepoInternal(repoPath, undefined, { navigateToWorkspace: false });
        await this.createNewSessionForRepo(repoPath);
        this.landingPromptValue = "";
        await this.ensureWorkspaceRoute();
        await this.sendPromptText(text);
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
      }
    });
  }

  async sendPromptText(text: string) {
    if (!text || !this.canUseSession) {
      return;
    }

    const isRunning = this.isAgentRunning || Boolean(this.sessionSnapshot?.isStreaming);
    this.isSendingPrompt = true;

    try {
      this.errorMessage = undefined;

      if (isRunning) {
        await this.getSessionClient().sendFollowUp(text);
      } else {
        await this.getSessionClient().sendPrompt(text);
      }

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
      const preferences = await this.getSessionClient().removeIndexedRepo(repoPath);
      const indexedSessionsByRepo = groupIndexedSessionsByRepo(preferences.indexedSessions);
      this.preferencesDatabasePath = preferences.databasePath;
      this.desktopSettings = preferences.desktopSettings;
      this.repos = preferences.recentRepos.map((repo) =>
        createRepo(repo.path, {
          name: repo.name,
          expanded: repo.path === preferences.lastSelectedRepoPath,
          sessions: indexedSessionsByRepo.get(repo.path) ?? [],
          sessionsLoaded: Boolean(repo.sessionsIndexedAt),
          sessionsLoading: false,
          sessionsError: undefined,
        }),
      );

      if (this.repoPath === repoPath) {
        this.repoPath = undefined;
        this.activeConnectionId = undefined;
        this.worktreePath = undefined;
        this.sessions = [];
        this.selectedSessionRef = undefined;
        this.sessionSnapshot = undefined;
        this.sessionStats = null;
        this.resetSessionDiff();
        this.resetSlashCommands();
        this.resetSessionReadModel();
      }

    });
  }

  async deleteSession(sessionPath: string, repoPath = this.repoPath) {
    if (!repoPath) {
      this.errorMessage = "Select a repo before deleting a session.";
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const deletingActiveSession = sessionPath === this.selectedSessionRef || sessionPath === this.sessionSnapshot?.summary.sessionRef;
      this.sessionCaches = deleteCachedSession(this.sessionCaches, sessionPath);
      void this.getSessionClient().deleteSessionMessageCache(sessionPath);
      const sessions = await this.getSessionClient().deleteSession(repoPath, sessionPath);
      this.repos = upsertRepo(this.repos, repoPath, {
        sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });

      if (repoPath === this.repoPath) {
        this.sessions = sessions;
      }

      if (deletingActiveSession) {
        this.selectedSessionRef = undefined;
        this.sessionSnapshot = undefined;
        this.sessionStats = null;
        this.resetSessionDiff();
        this.resetSlashCommands();
        this.resetSessionReadModel();
        await this.enterLanding({ repoPath });
      }

    });
  }

  async handleSteerSubmit(text: string) {
    if (!text || !this.canUseSession) {
      return;
    }

    this.isSendingPrompt = true;

    try {
      this.errorMessage = undefined;
      await this.getSessionClient().sendSteer(text);
      this.promptValue = "";
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    } finally {
      this.isSendingPrompt = false;
    }
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
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await this.getSessionClient().abort();
      await this.refreshActiveSessionData();
    });
  }

  async refreshActiveSessionData() {
    await this.refreshActiveMessages();
    await this.refreshSessionStats();
    await this.refreshSessionDiff();
  }

  async refreshActiveMessages() {
    if (!this.canUseSession) {
      return;
    }

    try {
      const result = await this.getSessionClient().getSessionSnapshot();
      this.applySessionSnapshot(result);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  applySessionSnapshot(snapshot: SessionSnapshot) {
    this.sessionSnapshot = snapshot;
    this.selectedSessionRef = snapshot.summary.sessionRef;
    this.sessionReadModel = hydrateFromSnapshot(this.sessionReadModel, snapshot, snapshot.messages);
    this.sessionStats = parseSessionStats(snapshot);
    this.reconciledSessionRef = this.selectedSessionRef;
    this.storeActiveConnectionReadModel();
  }

  async syncSidebarSessionsForActiveRepo() {
    if (!this.repoPath || this.connectionStatus.state !== "connected") {
      return;
    }

    await this.loadRepoSessions(this.repoPath);
  }

  async syncSidebarSessionsForConnection(connectionId: string | undefined) {
    if (!connectionId) {
      return;
    }

    const repoPath = this.connectionStatuses[connectionId]?.repoPath;

    if (!repoPath) {
      return;
    }

    await this.loadRepoSessions(repoPath);
  }

  async refreshSessionStats() {
    if (!this.selectedSessionRef && !this.sessionSnapshot?.summary.sessionRef) {
      this.sessionStats = null;
      this.sessionStatsError = undefined;
      this.sessionStatsLoading = false;
      return;
    }

    this.sessionStatsLoading = true;
    this.sessionStatsError = undefined;

    try {
      const snapshot = this.sessionSnapshot ?? (await this.getSessionClient().getSessionSnapshot());
      this.sessionStats = parseSessionStats(snapshot);
    } catch (error) {
      this.sessionStatsError = getErrorMessage(error);
    } finally {
      this.sessionStatsLoading = false;
    }
  }

  async refreshSessionDiff() {
    if (!this.selectedSessionRef && !this.sessionSnapshot?.summary.sessionRef) {
      this.resetSessionDiff();
      return;
    }

    this.sessionDiffLoading = true;
    this.sessionDiffError = undefined;

    try {
      this.sessionDiff = await this.getSessionClient().getWorkspaceDiff();

      if (!this.hasSessionDiff) {
        this.sessionDiffPanelOpen = false;
      } else if (this.desktopSettings.preferDiffPanel) {
        this.sessionDiffPanelOpen = true;
      }
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
    this.cancelDebouncedDiffRefresh();
    this.sessionDiff = { files: [], updatedAt: Date.now(), patch: "", changedFiles: 0 };
    this.sessionDiffLoading = false;
    this.sessionDiffError = undefined;
    this.sessionDiffPanelOpen = false;
  }

  cancelDebouncedDiffRefresh() {
    if (this.diffRefreshTimer === undefined) {
      return;
    }

    clearTimeout(this.diffRefreshTimer);
    this.diffRefreshTimer = undefined;
  }

  scheduleDebouncedDiffRefresh() {
    if (!this.canUseSession) {
      return;
    }

    this.cancelDebouncedDiffRefresh();
    this.diffRefreshTimer = setTimeout(() => {
      this.diffRefreshTimer = undefined;
      void this.refreshSessionDiff();
    }, 400);
  }

  async resyncConnectedSessionIfNeeded() {
    if (this.connectionStatus.state !== "connected" || !this.canUseSession || this.sessionReadModel.messages.length > 0) {
      return;
    }

    try {
      await this.refreshActiveSessionData();
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  applyWorkspaceDiff(diff: WorkspaceDiffSummary) {
    this.sessionDiff = diff;
    this.sessionDiffLoading = false;
    this.sessionDiffError = undefined;

    if (!this.hasSessionDiff) {
      this.sessionDiffPanelOpen = false;
    } else if (this.desktopSettings.preferDiffPanel) {
      this.sessionDiffPanelOpen = true;
    }
  }

  syncProviderCapabilities() {
    this.providerCapabilities = this.getSessionClient().getProviderCapabilities() ?? null;
  }

  async ensureSlashCommands(refresh = false) {
    if (!this.supportsSlashCommands) {
      this.slashCommands = [];
      this.slashCommandsLoaded = true;
      this.slashCommandsError = undefined;
      return;
    }

    const sessionKey = this.selectedSessionRef ?? this.sessionSnapshot?.summary.sessionRef;

    if (!this.canUseSession || !sessionKey) {
      this.slashCommands = [];
      this.slashCommandsLoaded = false;
      this.slashCommandsError = "Slash commands unavailable for this session.";
      return;
    }

    if (!refresh && this.slashCommandsLoaded && this.slashCommandsSessionKey === sessionKey) {
      return;
    }

    if (this.slashCommandsLoading) {
      return;
    }

    this.slashCommandsLoading = true;
    this.slashCommandsError = undefined;

    try {
      const commands = await this.getSessionClient().getCommands();

      if (sessionKey !== (this.selectedSessionRef ?? this.sessionSnapshot?.summary.sessionRef)) {
        return;
      }

      this.slashCommands = commands.filter((command) => command.name.length > 0);
      this.slashCommandsLoaded = true;
      this.slashCommandsSessionKey = sessionKey;
    } catch (error) {
      this.slashCommandsError = getErrorMessage(error);
      this.slashCommandsLoaded = false;
    } finally {
      this.slashCommandsLoading = false;
    }
  }

  resetSlashCommands() {
    this.slashCommands = [];
    this.slashCommandsLoading = false;
    this.slashCommandsError = undefined;
    this.slashCommandsLoaded = false;
    this.slashCommandsSessionKey = undefined;
  }

  async ensureAvailableModels(refresh = false) {
    if (!this.supportsModelPicker) {
      this.availableModels = [];
      this.modelsLoaded = true;
      this.modelsError = undefined;
      return;
    }

    const sessionKey = this.selectedSessionRef ?? this.sessionSnapshot?.summary.sessionRef;

    if (!this.canUseSession || !sessionKey) {
      this.availableModels = [];
      this.modelsLoaded = false;
      this.modelsError = undefined;
      return;
    }

    if (!refresh && this.modelsLoaded && this.modelsSessionKey === sessionKey) {
      return;
    }

    if (this.modelsLoading) {
      return;
    }

    this.modelsLoading = true;
    this.modelsError = undefined;

    try {
      const models = await this.getSessionClient().getAvailableModels();

      if (sessionKey !== (this.selectedSessionRef ?? this.sessionSnapshot?.summary.sessionRef)) {
        return;
      }

      this.availableModels = models;
      this.modelsLoaded = true;
      this.modelsSessionKey = sessionKey;

      if (this.sessionSnapshot?.model) {
        const sessionModel = mergeModelWithCatalog(this.sessionSnapshot.model, models);
        const currentModel = normalizeModel(this.sessionSnapshot.model);

        if (sessionModel && currentModel && sessionModel.reasoning !== currentModel.reasoning) {
          this.sessionSnapshot = {
            ...this.sessionSnapshot,
            model: sessionModel,
          };
        }
      }
    } catch (error) {
      this.modelsError = getErrorMessage(error);
      this.modelsLoaded = false;
    } finally {
      this.modelsLoading = false;
    }
  }

  resetModels() {
    this.availableModels = [];
    this.modelsLoading = false;
    this.modelsError = undefined;
    this.modelsLoaded = false;
    this.modelsSessionKey = undefined;
  }

  async setModel(provider: string, modelId: string) {
    if (!this.canChangeSessionSettings) {
      return;
    }

    try {
      await this.getSessionClient().setModel(provider, modelId);
      const snapshot = await this.getSessionClient().getSessionSnapshot();
      this.applySessionSnapshot(snapshot);
      void this.refreshSessionStats();
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async setThinkingLevel(level: ThinkingLevel) {
    if (!this.canChangeSessionSettings) {
      return;
    }

    try {
      await this.getSessionClient().setThinkingLevel(level);

      if (this.sessionSnapshot) {
        this.sessionSnapshot = {
          ...this.sessionSnapshot,
          thinkingLevel: normalizeThinkingLevel(level),
        };
      }
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
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
    const preferences = await this.getSessionClient().clearAllIndexedData();
    this.applyPreferencesSnapshot(preferences);
    this.repoPath = undefined;
    this.activeConnectionId = undefined;
    this.worktreePath = undefined;
    this.selectedSessionRef = undefined;
    this.sessions = [];
    this.sessionSnapshot = undefined;
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
  }

  applyPreferencesSnapshot(preferences: PreferencesSnapshot) {
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

  async setSteeringMode(mode: ProviderQueueMode) {
    if (!this.canChangeSessionSettings || !this.supportsQueueSettings) {
      return;
    }

    try {
      this.applySessionSnapshot(await this.getSessionClient().setSteeringMode(mode));
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async setFollowUpMode(mode: ProviderQueueMode) {
    if (!this.canChangeSessionSettings || !this.supportsQueueSettings) {
      return;
    }

    try {
      this.applySessionSnapshot(await this.getSessionClient().setFollowUpMode(mode));
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async setAutoCompaction(enabled: boolean) {
    if (!this.canChangeSessionSettings || !this.supportsCompactionSettings) {
      return;
    }

    try {
      this.applySessionSnapshot(await this.getSessionClient().setAutoCompaction(enabled));
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async persistDesktopSettings(settings: Partial<DesktopSettings>) {
    const previous = this.desktopSettings;
    this.desktopSettings = { ...this.desktopSettings, ...settings };

    try {
      await this.getSessionClient().updateDesktopSettings(settings);
    } catch (error) {
      this.desktopSettings = previous;
      this.errorMessage = getErrorMessage(error);
    }
  }

  getSessionRowStatus(session: SessionSummary): SessionRowStatus {
    const connectionId = session.liveConnectionId;

    if (!connectionId) {
      return session.worktreePath
        ? createSessionRowStatus("mapped")
        : createSessionRowStatus("done");
    }

    const status = this.connectionStatuses[connectionId];
    const model = this.connectionReadModels[connectionId] ?? (connectionId === this.activeConnectionId ? this.sessionReadModel : undefined);
    const request = this.providerUiRequestsByConnection[connectionId];

    if (
      status?.state === "error" ||
      status?.state === "exited" ||
      Boolean(model?.streamingError || model?.extensionError)
    ) {
      return createSessionRowStatus("error");
    }

    if (request) {
      return createSessionRowStatus("needs_input");
    }

    if (
      status?.state === "starting" ||
      model?.isAgentRunning ||
      model?.isCompacting ||
      model?.retry?.active ||
      model?.streamingMessage ||
      Object.values(model?.tools ?? {}).some((tool) => tool.state === "input-available" || tool.state === "input-streaming")
    ) {
      return createSessionRowStatus("working");
    }

    if (status?.state === "connected" || connectionId === this.activeConnectionId) {
      return createSessionRowStatus("connected");
    }

    return session.worktreePath
      ? createSessionRowStatus("mapped")
      : createSessionRowStatus("done");
  }

  handleSessionEvent(event: AgentSessionEvent) {
    if (event.type === "message.streaming" && event.phase === "update" && !event.errorMessage) {
      this.queueStreamingUpdate(event);
      return;
    }

    this.flushStreamingUpdate(event.connectionId ?? this.activeConnectionId);

    this.applySessionEventNow(event);
  }

  applySessionEventNow(event: AgentSessionEvent) {
    const connectionId = event.connectionId ?? this.activeConnectionId;
    const currentModel = connectionId
      ? (this.connectionReadModels[connectionId] ?? (connectionId === this.activeConnectionId ? this.sessionReadModel : createInitialSessionReadModel()))
      : this.sessionReadModel;
    const nextModel = applySessionEvent(currentModel, event);

    if (connectionId) {
      this.connectionReadModels = {
        ...this.connectionReadModels,
        [connectionId]: nextModel,
      };
    }

    if (connectionId && this.activeConnectionId && connectionId !== this.activeConnectionId) {
      if (event.type === "run.started" || event.type === "run.ended" || event.type === "run.failed") {
        void this.syncSidebarSessionsForConnection(connectionId);
      }
      return;
    }

    if (connectionId) {
      this.activeConnectionId = connectionId;
    }

    this.sessionReadModel = nextModel;

    if (event.type === "run.started") {
      this.setSessionStreaming(true);
      void this.syncSidebarSessionsForConnection(connectionId);
    }

    if (event.type === "run.ended" || event.type === "run.failed") {
      this.setSessionStreaming(false);
    }

    if (this.sessionReadModel.streamingError) {
      this.errorMessage = this.sessionReadModel.streamingError;
    } else if (this.sessionReadModel.extensionError) {
      this.errorMessage = this.sessionReadModel.extensionError;
    }

    if (this.sessionReadModel.needsDiffRefresh) {
      this.scheduleDebouncedDiffRefresh();
    }

    if (this.sessionReadModel.needsRunHousekeeping) {
      this.scheduleRunEndedHousekeeping();
    }

    if (event.type !== "message.streaming" || event.phase !== "update") {
      this.cacheCurrentSession();
    }
  }

  queueStreamingUpdate(event: AgentSessionEvent) {
    const connectionId = event.connectionId ?? this.activeConnectionId ?? "__active__";
    this.pendingStreamingUpdates.set(connectionId, event);

    if (this.streamingUpdateFrame !== undefined) {
      return;
    }

    const scheduleFrame = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16) as unknown as number;

    this.streamingUpdateFrame = scheduleFrame(() => {
      this.streamingUpdateFrame = undefined;
      const updates = [...this.pendingStreamingUpdates.values()];
      this.pendingStreamingUpdates.clear();

      for (const update of updates) {
        this.applySessionEventNow(update);
      }
    });
  }

  flushStreamingUpdate(connectionId: string | undefined) {
    const key = connectionId ?? "__active__";
    const pending = this.pendingStreamingUpdates.get(key);

    if (!pending) {
      return;
    }

    this.pendingStreamingUpdates.delete(key);
    this.applySessionEventNow(pending);
  }

  scheduleRunEndedHousekeeping() {
    if (this.runEndedHousekeepingTimer !== undefined) {
      clearTimeout(this.runEndedHousekeepingTimer);
    }

    this.runEndedHousekeepingTimer = setTimeout(() => {
      this.runEndedHousekeepingTimer = undefined;
      void this.reconcileRunEnded();
    }, 100);
  }

  async reconcileRunEnded() {
    if (this.reconcileInFlight) {
      this.reconcileAgain = true;
      return;
    }

    this.reconcileInFlight = true;

    try {
      await this.refreshSessionStats();
      await this.refreshSessionDiff();
      await this.syncSidebarSessionsForActiveRepo();
      void this.ensureSlashCommands(true);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    } finally {
      this.reconcileInFlight = false;

      if (this.reconcileAgain) {
        this.reconcileAgain = false;
        void this.reconcileRunEnded();
      }
    }
  }

  dismissSessionNotification(notificationId: string) {
    this.sessionReadModel = {
      ...this.sessionReadModel,
      notifications: this.sessionReadModel.notifications.filter(
        (item: SessionReadModel["notifications"][number]) => item.id !== notificationId,
      ),
    };
    this.storeActiveConnectionReadModel();
  }

  clearProviderUiRequest() {
    if (this.providerUiRequest) {
      const nextRequests = { ...this.providerUiRequestsByConnection };
      const requestAgentId = this.providerUiRequest.connectionId ?? this.activeConnectionId;

      if (requestAgentId) {
        delete nextRequests[requestAgentId];
      }

      for (const [connectionId, request] of Object.entries(nextRequests)) {
        if (request.id === this.providerUiRequest.id) {
          delete nextRequests[connectionId];
        }
      }

      this.providerUiRequestsByConnection = nextRequests;
    }

    this.providerUiRequest = undefined;
  }

  async respondToProviderUi(response: ProviderUiResponse) {
    await this.getSessionClient().respondToProviderUi(response);
    this.clearProviderUiRequest();
  }

  resetSessionReadModel() {
    this.sessionReadModel = createInitialSessionReadModel();
    this.storeActiveConnectionReadModel();
  }

  storeActiveConnectionReadModel() {
    if (!this.activeConnectionId) {
      return;
    }

    this.connectionReadModels = {
      ...this.connectionReadModels,
      [this.activeConnectionId]: this.sessionReadModel,
    };

    this.cacheCurrentSession();
  }

  cacheCurrentSession() {
    const sessionRef = this.selectedSessionRef ?? this.sessionSnapshot?.summary.sessionRef;

    if (!sessionRef || !this.sessionSnapshot) {
      return;
    }

    this.sessionCaches = setCachedSession(this.sessionCaches, {
      sessionRef,
      sessionReadModel: this.sessionReadModel,
      sessionSnapshot: this.sessionSnapshot,
      worktreePath: this.worktreePath,
      sessionStats: this.sessionStats,
      sessionDiff: this.hasSessionDiff ? this.sessionDiff : undefined,
      lastAccessedAt: Date.now(),
    });
    this.schedulePersistSessionMessageCache();
  }

  async applyMessageCacheIfPresent(sessionRef: string, repoPath: string): Promise<boolean> {
    const entry = await this.getSessionClient().getSessionMessageCache(sessionRef);

    if (!entry || entry.messages.length === 0) {
      return false;
    }

    const snapshot = this.messageCacheToSnapshot(entry.sessionState, sessionRef, repoPath, entry.messages);
    this.sessionSnapshot = snapshot;
    this.sessionReadModel = hydrateFromSnapshot(createInitialSessionReadModel(), snapshot, entry.messages);
    this.messageCacheSyncing = entry.syncStatus !== undefined && entry.syncStatus !== "fresh";
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
    return true;
  }

  messageCacheToSnapshot(
    cached: SessionMessageCacheState | undefined,
    sessionRef: string,
    repoPath: string,
    messages: unknown[],
  ): SessionSnapshot {
    return {
      summary: {
        providerId: "pi",
        sessionRef: cached?.sessionRef ?? sessionRef,
        status: "idle",
        repoPath,
        messageCount: messages.length,
      },
      cwd: repoPath,
      messages,
      isStreaming: cached?.isStreaming ?? false,
      isCompacting: cached?.isCompacting ?? false,
      steering: [],
      followUp: [],
      activeTools: [],
      tools: [],
      diagnostics: [],
    };
  }

  cancelMessageCachePersist() {
    if (this.messageCachePersistTimer === undefined) {
      return;
    }

    clearTimeout(this.messageCachePersistTimer);
    this.messageCachePersistTimer = undefined;
  }

  schedulePersistSessionMessageCache() {
    if (!this.repoPath || !this.sessionSnapshot) {
      return;
    }

    if (this.sessionReadModel.isAgentRunning || this.sessionReadModel.phase === "running") {
      return;
    }

    this.cancelMessageCachePersist();
    this.messageCachePersistTimer = setTimeout(() => {
      this.messageCachePersistTimer = undefined;
      void this.persistSessionMessageCacheImmediate();
    }, 500);
  }

  async persistSessionMessageCacheImmediate() {
    const sessionRef = this.selectedSessionRef ?? this.sessionSnapshot?.summary.sessionRef;
    const repoPath = this.repoPath;

    if (!sessionRef || !repoPath || !this.sessionSnapshot) {
      return;
    }

    if (this.sessionReadModel.isAgentRunning || this.sessionReadModel.phase === "running") {
      return;
    }

    if (this.sessionReadModel.messages.length === 0) {
      return;
    }

    await this.getSessionClient().upsertSessionMessageCache({
      sessionRef,
      repoPath,
      messages: this.sessionReadModel.messages,
      sessionState: {
        isStreaming: this.sessionSnapshot.isStreaming,
        isCompacting: this.sessionSnapshot.isCompacting,
        sessionRef,
      },
      messageCount: this.sessionReadModel.messages.length,
      syncStatus: "fresh",
      syncedAt: new Date().toISOString(),
    });
  }

  applyCachedSession(entry: SessionCacheEntry) {
    if (!entry) {
      return;
    }

    this.sessionReadModel = entry.sessionReadModel;
    this.sessionSnapshot = entry.sessionSnapshot;
    this.worktreePath = entry.worktreePath;

    if (entry.sessionStats !== undefined) {
      this.sessionStats = entry.sessionStats;
    } else {
      this.sessionStats = null;
    }

    if (entry.sessionDiff) {
      this.sessionDiff = entry.sessionDiff;
      this.sessionDiffLoading = false;
      this.sessionDiffError = undefined;
    } else {
      this.resetSessionDiff();
    }

    this.resetSlashCommands();
    this.resetModels();
  }

  syncActiveConnectionStatus() {
    if (!this.activeConnectionId) {
      return;
    }

    const status = this.connectionStatuses[this.activeConnectionId];

    if (status) {
      this.connectionStatus = status;
    }

    this.providerUiRequest = this.providerUiRequestsByConnection[this.activeConnectionId];
  }

  setSessionStreaming(isStreaming: boolean) {
    if (!this.sessionSnapshot) {
      return;
    }

    this.sessionSnapshot = {
      ...this.sessionSnapshot,
      isStreaming,
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

  getSessionClient() {
    if (!window.h3code) {
      throw new Error("Desktop API is unavailable.");
    }

    return getAgentSessionClient();
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
      return {
        kind,
        label: "Agent error",
        dotClass: "bg-destructive",
      };
    case "needs_input":
      return {
        kind,
        label: "Needs input",
        dotClass: "animate-pulse bg-amber-500",
      };
    case "working":
      return {
        kind,
        label: "Agent running",
        dotClass: "animate-pulse bg-primary",
      };
    case "connected":
      return {
        kind,
        label: "Connected",
        dotClass: "bg-primary",
      };
    case "mapped":
      return {
        kind,
        label: "Worktree available",
        dotClass: "border border-muted-foreground/45 bg-transparent",
      };
    case "done":
      return {
        kind,
        label: "Done",
        dotClass: "bg-muted-foreground/25",
      };
  }
}

function sessionPathToId(sessionPath: string) {
  const base = sessionPath.split(/[/\\]/).pop() ?? sessionPath;
  return base.replace(/\.jsonl$/i, "");
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
