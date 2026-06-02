import { goto } from "$app/navigation";

import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input/index.js";
import { extractSessionMetadata } from "$lib/components/desktop/transcript-normalize.js";
import { formatMessageRole, formatMessageText } from "$lib/message-format.js";
import { mergeModelWithCatalog, normalizeThinkingLevel } from "$lib/pi-model.js";
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
import type { ProviderCapabilities } from "@h3code/agent-core";

import { getDesktopAgentApi } from "$lib/desktop-agent-api.js";
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
import {
  loadSessionSqlCache,
  removeSessionSqlCache,
  saveSessionSqlCache,
  type SessionSqlCacheState,
} from "$lib/session-sql-cache.js";

export type WorkspaceInspector = "diff" | "context";

export type ActivityItem = {
  type: string;
  detail: string;
};

export type SidebarRepo = {
  name: string;
  path: string;
  expanded?: boolean;
  sessions?: PiSessionSummary[];
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

type AgentSessionEvent = SessionDomainEvent & {
  agentId?: string;
};

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
  activeAgentId = $state<string | undefined>();
  repoPath = $state<string | undefined>();
  worktreePath = $state<string | undefined>();
  repos = $state<SidebarRepo[]>([]);
  sessions = $state<PiSessionSummary[]>([]);
  selectedSessionPath = $state<string | undefined>();
  sessionState = $state<PiSessionState | undefined>();
  sessionStats = $state<PiSessionStats | null>(null);
  sessionStatsLoading = $state(false);
  sessionStatsError = $state<string | undefined>();
  sessionDiff = $state<PiSessionDiff>({ patch: "", changedFiles: 0 });
  sessionDiffLoading = $state(false);
  sessionDiffError = $state<string | undefined>();
  sessionDiffPanelOpen = $state(false);
  slashCommands = $state<PiSlashCommand[]>([]);
  slashCommandsLoading = $state(false);
  slashCommandsError = $state<string | undefined>();
  slashCommandsLoaded = $state(false);
  slashCommandsSessionKey = $state<string | undefined>();
  availableModels = $state<PiModel[]>([]);
  modelsLoading = $state(false);
  modelsError = $state<string | undefined>();
  modelsLoaded = $state(false);
  modelsSessionKey = $state<string | undefined>();
  sessionReadModel = $state<SessionReadModel>(createInitialSessionReadModel());
  sessionCaches = $state<SessionCacheMap>({});
  sessionCacheSyncing = $state(false);
  isSwitchingSession = $state(false);
  sqlCachePersistTimer: ReturnType<typeof setTimeout> | undefined;
  reconciledSessionPath = $state<string | undefined>();
  switchGeneration = 0;
  agentReadModels = $state<Record<string, SessionReadModel>>({});
  agentStatuses = $state<Record<string, PiStatus>>({});
  extensionUiRequestsByAgent = $state<Record<string, PiExtensionUiRequest>>({});
  piStatus = $state<PiStatus>({ state: "disconnected" });
  isBusy = $state(false);
  isSendingPrompt = $state(false);
  errorMessage = $state<string | undefined>();
  preferencesLoaded = $state(false);
  preferencesDatabasePath = $state<string | undefined>();
  extensionUiRequest = $state<PiExtensionUiRequest | undefined>();
  desktopSettings = $state<DesktopSettings>(defaultDesktopSettings);

  reconcileInFlight = false;
  reconcileAgain = false;
  diffRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  selectedSession = $derived(this.sessions.find((session) => session.path === this.selectedSessionPath));
  canUseSession = $derived(this.piStatus.state === "connected" && Boolean(this.selectedSessionPath || this.sessionState?.sessionFile));
  isSessionReconciled = $derived(
    Boolean(this.selectedSessionPath) &&
      this.selectedSessionPath === this.reconciledSessionPath &&
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
    Boolean(this.selectedSessionPath || this.sessionState?.sessionFile),
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
      !this.sessionState?.isStreaming,
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
  hasSessionDiff = $derived(this.sessionDiff.patch.trim().length > 0);
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
    const agentApi = getDesktopAgentApi();

    agentApi.setEventListeners({
      onSessionEvent: (event) => {
        this.handleSessionEvent(event);
      },
      onPiStatus: (status) => {
        this.applyPiStatus(status);
      },
      onExtensionUiRequest: (request) => {
        this.applyExtensionUiRequest(request);
      },
      onWorkspaceDiff: (diff) => {
        this.applyWorkspaceDiff(diff);
      },
    });

    return () => {
      agentApi.setEventListeners({});
    };
  }

  applyPiStatus(status: PiStatus) {
    if (status.agentId) {
      this.agentStatuses = {
        ...this.agentStatuses,
        [status.agentId]: status,
      };

      if (!this.activeAgentId) {
        this.activeAgentId = status.agentId;
      }
    }

    const isActiveStatus = !status.agentId || status.agentId === this.activeAgentId;

    if (isActiveStatus) {
      this.piStatus = status;

      if (status.state !== "connected") {
        this.resetSlashCommands();
        this.resetModels();
        this.resetSessionReadModel();
        this.resetSessionDiff();
        this.clearExtensionUiRequest();
        this.cancelDebouncedDiffRefresh();
      }

      if (status.diagnostic) {
        this.errorMessage = status.diagnostic;
      }
    }
  }

  applyExtensionUiRequest(request: PiExtensionUiRequest) {
    const agentId = request.agentId ?? this.activeAgentId;

    if (agentId) {
      this.extensionUiRequestsByAgent = {
        ...this.extensionUiRequestsByAgent,
        [agentId]: request,
      };
    }

    if (!agentId || agentId === this.activeAgentId) {
      this.extensionUiRequest = request;
    }
  }

  async initializePreferences() {
    if (!window.h3code) {
      return;
    }

    try {
      const preferences = await this.getAgentApi().getPreferences();
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
      const sessions = await this.getAgentApi().listRepoSessions(nextRepoPath, markRecent);
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

  async connectRepo(nextRepoPath: string, selectedSessionPath?: string) {
    await this.withBusy(async () => {
      await this.connectRepoInternal(nextRepoPath, selectedSessionPath);
    });
  }

  async connectRepoInternal(
    nextRepoPath: string,
    selectedSessionPath?: string,
    options: { navigateToWorkspace?: boolean } = {},
  ) {
    const { navigateToWorkspace = true } = options;
    this.errorMessage = undefined;

    if (selectedSessionPath) {
      await this.applySqlCacheIfPresent(selectedSessionPath, nextRepoPath);
    }

    const result = await this.getAgentApi().connectRepo(nextRepoPath, selectedSessionPath);
    this.syncProviderCapabilities();

    this.repoPath = result.repoPath;
    this.activeAgentId = result.agentId;
    this.worktreePath = result.worktreePath;
    this.syncActiveAgentStatus();
    this.repos = upsertRepo(this.repos, result.repoPath, {
      expanded: true,
      sessions: result.sessions,
      sessionsLoaded: true,
      sessionsLoading: false,
      sessionsError: undefined,
    });
    this.sessions = result.sessions;
    this.selectedSessionPath = result.selectedSessionPath;
    this.sessionState = result.state;
    this.sessionStats = null;
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
    this.sessionReadModel = hydrateFromSnapshot(
      createInitialSessionReadModel(),
      result.state,
      result.messages ?? [],
    );
    this.storeActiveAgentReadModel();
    this.reconciledSessionPath = this.selectedSessionPath;
    this.sessionCacheSyncing = false;
    this.cacheCurrentSession();
    void this.persistSessionSqlCacheImmediate();
    void this.refreshSessionStats();
    void this.refreshSessionDiff();
    void this.ensureAvailableModels(true);

    if (navigateToWorkspace) {
      await this.ensureWorkspaceRoute();
    }
  }

  clearWorkspaceSessionState() {
    this.repoPath = undefined;
    this.activeAgentId = undefined;
    this.worktreePath = undefined;
    this.sessions = [];
    this.selectedSessionPath = undefined;
    this.reconciledSessionPath = undefined;
    this.isSwitchingSession = false;
    this.sessionCacheSyncing = false;
    this.cancelSqlCachePersist();
    this.sessionCaches = clearSessionCache();
    this.sessionState = undefined;
    this.sessionStats = null;
    this.piStatus = { state: "disconnected" };
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

    if (repoPath !== this.repoPath || this.piStatus.state !== "connected") {
      await this.connectRepo(repoPath, sessionPath);
      return;
    }

    if (sessionPath === this.selectedSessionPath && this.isSessionReconciled) {
      return;
    }

    this.cacheCurrentSession();
    this.switchGeneration += 1;
    const generation = this.switchGeneration;

    this.errorMessage = undefined;
    this.selectedSessionPath = sessionPath;

    const cached = getCachedSession(this.sessionCaches, sessionPath);

    if (cached) {
      this.sessionCaches = setCachedSession(this.sessionCaches, {
        ...cached,
        lastAccessedAt: Date.now(),
      });
      this.applyCachedSession(cached);
    } else {
      const sqlApplied = await this.applySqlCacheIfPresent(sessionPath, repoPath);

      if (!sqlApplied) {
        this.sessionReadModel = createInitialSessionReadModel();
        this.sessionState = undefined;
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
      const result = await this.getAgentApi().switchSession(sessionPath);

      if (generation !== this.switchGeneration) {
        return;
      }

      this.activeAgentId = result.agentId;
      this.repoPath = result.repoPath ?? this.repoPath;
      this.worktreePath = result.worktreePath;
      this.syncActiveAgentStatus();
      this.selectedSessionPath = sessionPath;
      this.sessionState = result.state;
      this.resetSlashCommands();
      this.resetModels();
      this.sessionReadModel = hydrateFromSnapshot(
        createInitialSessionReadModel(),
        result.state,
        result.messages,
      );
      this.reconciledSessionPath = sessionPath;
      this.sessionCacheSyncing = false;
      this.storeActiveAgentReadModel();
      this.cacheCurrentSession();
      void this.persistSessionSqlCacheImmediate();
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
    const parentSessionPath = this.selectedSessionPath;
    const result = await this.getAgentApi().newSession(parentSessionPath);
    this.activeAgentId = result.agentId;
    this.repoPath = result.repoPath ?? repoPath;
    this.worktreePath = result.worktreePath;
    this.syncActiveAgentStatus();
    this.sessionState = result.state;
    this.selectedSessionPath = result.state.sessionFile;
    this.sessionStats = null;
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
    this.sessionReadModel = hydrateFromSnapshot(
      createInitialSessionReadModel(),
      result.state,
      result.messages,
    );
    this.storeActiveAgentReadModel();
    this.reconciledSessionPath = this.selectedSessionPath;
    this.sessionCacheSyncing = false;
    this.cacheCurrentSession();
    void this.persistSessionSqlCacheImmediate();
    this.sessions = await this.getAgentApi().listSessions();
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

    const isRunning = this.isAgentRunning || Boolean(this.sessionState?.isStreaming);
    this.isSendingPrompt = true;

    try {
      this.errorMessage = undefined;

      if (isRunning) {
        await this.getAgentApi().sendFollowUp(text);
      } else {
        await this.getAgentApi().sendPrompt(text);
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
      const preferences = await this.getAgentApi().removeIndexedRepo(repoPath);
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
        this.activeAgentId = undefined;
        this.worktreePath = undefined;
        this.sessions = [];
        this.selectedSessionPath = undefined;
        this.sessionState = undefined;
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
      const deletingActiveSession = sessionPath === this.selectedSessionPath || sessionPath === this.sessionState?.sessionFile;
      this.sessionCaches = deleteCachedSession(this.sessionCaches, sessionPath);
      void removeSessionSqlCache(sessionPath);
      const sessions = await this.getAgentApi().deleteSession(repoPath, sessionPath);
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
        this.selectedSessionPath = undefined;
        this.sessionState = undefined;
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
      await this.getAgentApi().sendSteer(text);
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
      await this.getAgentApi().abort();
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
      const result = await this.getAgentApi().getSessionSnapshot();
      this.applySessionSnapshot(result);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  applySessionSnapshot(result: { state: PiSessionState; messages: unknown[] }) {
    this.sessionState = result.state;

    if (result.state.sessionFile) {
      this.selectedSessionPath = result.state.sessionFile;
    }

    this.sessionReadModel = hydrateFromSnapshot(this.sessionReadModel, result.state, result.messages);
    this.reconciledSessionPath = this.selectedSessionPath ?? result.state.sessionFile;
    this.storeActiveAgentReadModel();
  }

  async syncSidebarSessionsForActiveRepo() {
    if (!this.repoPath || this.piStatus.state !== "connected") {
      return;
    }

    await this.loadRepoSessions(this.repoPath);
  }

  async syncSidebarSessionsForAgent(agentId: string | undefined) {
    if (!agentId) {
      return;
    }

    const repoPath = this.agentStatuses[agentId]?.repoPath;

    if (!repoPath) {
      return;
    }

    await this.loadRepoSessions(repoPath);
  }

  async refreshSessionStats() {
    if (!this.selectedSessionPath && !this.sessionState?.sessionFile) {
      this.sessionStats = null;
      this.sessionStatsError = undefined;
      this.sessionStatsLoading = false;
      return;
    }

    this.sessionStatsLoading = true;
    this.sessionStatsError = undefined;

    try {
      this.sessionStats = await this.getAgentApi().getSessionStatsFromSnapshot();
    } catch (error) {
      this.sessionStatsError = getErrorMessage(error);
    } finally {
      this.sessionStatsLoading = false;
    }
  }

  async refreshSessionDiff() {
    if (!this.selectedSessionPath && !this.sessionState?.sessionFile) {
      this.resetSessionDiff();
      return;
    }

    this.sessionDiffLoading = true;
    this.sessionDiffError = undefined;

    try {
      this.sessionDiff = await this.getAgentApi().getSessionDiff();

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
    this.sessionDiff = { patch: "", changedFiles: 0 };
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
    if (this.piStatus.state !== "connected" || !this.canUseSession || this.sessionReadModel.messages.length > 0) {
      return;
    }

    try {
      await this.refreshActiveSessionData();
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  applyWorkspaceDiff(diff: PiSessionDiff) {
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
    this.providerCapabilities = this.getAgentApi().getProviderCapabilities() ?? null;
  }

  async ensureSlashCommands(refresh = false) {
    if (!this.supportsSlashCommands) {
      this.slashCommands = [];
      this.slashCommandsLoaded = true;
      this.slashCommandsError = undefined;
      return;
    }

    const sessionKey = this.selectedSessionPath ?? this.sessionState?.sessionFile;

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
      const commands = await this.getAgentApi().getCommands();

      if (sessionKey !== (this.selectedSessionPath ?? this.sessionState?.sessionFile)) {
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

    const sessionKey = this.selectedSessionPath ?? this.sessionState?.sessionFile;

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
      const models = await this.getAgentApi().getAvailableModels();

      if (sessionKey !== (this.selectedSessionPath ?? this.sessionState?.sessionFile)) {
        return;
      }

      this.availableModels = models;
      this.modelsLoaded = true;
      this.modelsSessionKey = sessionKey;

      if (this.sessionState?.model) {
        const sessionModel = mergeModelWithCatalog(this.sessionState.model, models);

        if (sessionModel && sessionModel.reasoning !== this.sessionState.model.reasoning) {
          this.sessionState = {
            ...this.sessionState,
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
      const model = await this.getAgentApi().setModel(provider, modelId);
      const sessionModel = mergeModelWithCatalog(model, this.availableModels);

      if (this.sessionState && sessionModel) {
        this.sessionState = {
          ...this.sessionState,
          model: sessionModel,
        };
      }

      void this.refreshSessionStats();
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async setThinkingLevel(level: PiThinkingLevel) {
    if (!this.canChangeSessionSettings) {
      return;
    }

    try {
      await this.getAgentApi().setThinkingLevel(level);

      if (this.sessionState) {
        this.sessionState = {
          ...this.sessionState,
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
    const preferences = await this.getAgentApi().clearAllIndexedData();
    this.applyPreferencesSnapshot(preferences);
    this.repoPath = undefined;
    this.activeAgentId = undefined;
    this.worktreePath = undefined;
    this.selectedSessionPath = undefined;
    this.sessions = [];
    this.sessionState = undefined;
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
  }

  applyPreferencesSnapshot(preferences: DesktopPreferences) {
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

  async setSteeringMode(mode: PiQueueMode) {
    if (!this.canChangeSessionSettings || !this.supportsQueueSettings) {
      return;
    }

    try {
      this.sessionState = await this.getAgentApi().setSteeringMode(mode);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async setFollowUpMode(mode: PiQueueMode) {
    if (!this.canChangeSessionSettings || !this.supportsQueueSettings) {
      return;
    }

    try {
      this.sessionState = await this.getAgentApi().setFollowUpMode(mode);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async setAutoCompaction(enabled: boolean) {
    if (!this.canChangeSessionSettings || !this.supportsCompactionSettings) {
      return;
    }

    try {
      this.sessionState = await this.getAgentApi().setAutoCompaction(enabled);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  async persistDesktopSettings(settings: Partial<DesktopSettings>) {
    const previous = this.desktopSettings;
    this.desktopSettings = { ...this.desktopSettings, ...settings };

    try {
      await this.getAgentApi().updateDesktopSettings(settings);
    } catch (error) {
      this.desktopSettings = previous;
      this.errorMessage = getErrorMessage(error);
    }
  }

  getSessionRowStatus(session: PiSessionSummary): SessionRowStatus {
    const agentId = session.agentId;

    if (!agentId) {
      return session.worktreePath
        ? createSessionRowStatus("mapped")
        : createSessionRowStatus("done");
    }

    const status = this.agentStatuses[agentId];
    const model = this.agentReadModels[agentId] ?? (agentId === this.activeAgentId ? this.sessionReadModel : undefined);
    const request = this.extensionUiRequestsByAgent[agentId];

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

    if (status?.state === "connected" || agentId === this.activeAgentId) {
      return createSessionRowStatus("connected");
    }

    return session.worktreePath
      ? createSessionRowStatus("mapped")
      : createSessionRowStatus("done");
  }

  handleSessionEvent(event: AgentSessionEvent) {
    const agentId = event.agentId ?? this.activeAgentId;
    const currentModel = agentId
      ? (this.agentReadModels[agentId] ?? (agentId === this.activeAgentId ? this.sessionReadModel : createInitialSessionReadModel()))
      : this.sessionReadModel;
    const nextModel = applySessionEvent(currentModel, event);

    if (agentId) {
      this.agentReadModels = {
        ...this.agentReadModels,
        [agentId]: nextModel,
      };
    }

    if (agentId && this.activeAgentId && agentId !== this.activeAgentId) {
      if (event.type === "run.started" || event.type === "run.ended") {
        void this.syncSidebarSessionsForAgent(agentId);
      }
      return;
    }

    if (agentId) {
      this.activeAgentId = agentId;
    }

    this.sessionReadModel = nextModel;

    if (event.type === "run.started") {
      this.setSessionStreaming(true);
      void this.syncSidebarSessionsForAgent(agentId);
    }

    if (event.type === "run.ended") {
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
      void this.reconcileRunEnded();
    }

    this.cacheCurrentSession();
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
    this.storeActiveAgentReadModel();
  }

  clearExtensionUiRequest() {
    if (this.extensionUiRequest) {
      const nextRequests = { ...this.extensionUiRequestsByAgent };
      const requestAgentId = this.extensionUiRequest.agentId ?? this.activeAgentId;

      if (requestAgentId) {
        delete nextRequests[requestAgentId];
      }

      for (const [agentId, request] of Object.entries(nextRequests)) {
        if (request.id === this.extensionUiRequest.id) {
          delete nextRequests[agentId];
        }
      }

      this.extensionUiRequestsByAgent = nextRequests;
    }

    this.extensionUiRequest = undefined;
  }

  async respondToExtensionUi(response: PiExtensionUiResponse) {
    await this.getAgentApi().respondToExtensionUi(response);
    this.clearExtensionUiRequest();
  }

  resetSessionReadModel() {
    this.sessionReadModel = createInitialSessionReadModel();
    this.storeActiveAgentReadModel();
  }

  storeActiveAgentReadModel() {
    if (!this.activeAgentId) {
      return;
    }

    this.agentReadModels = {
      ...this.agentReadModels,
      [this.activeAgentId]: this.sessionReadModel,
    };

    this.cacheCurrentSession();
  }

  cacheCurrentSession() {
    const sessionPath = this.selectedSessionPath ?? this.sessionState?.sessionFile;

    if (!sessionPath || !this.sessionState) {
      return;
    }

    this.sessionCaches = setCachedSession(this.sessionCaches, {
      sessionPath,
      sessionReadModel: this.sessionReadModel,
      sessionState: this.sessionState,
      worktreePath: this.worktreePath,
      sessionStats: this.sessionStats,
      sessionDiff: this.hasSessionDiff ? this.sessionDiff : undefined,
      lastAccessedAt: Date.now(),
    });
    this.schedulePersistSessionSqlCache();
  }

  async applySqlCacheIfPresent(sessionPath: string, repoPath: string): Promise<boolean> {
    const entry = await loadSessionSqlCache(sessionPath);

    if (!entry || entry.messages.length === 0) {
      return false;
    }

    const state = this.sqlCacheStateToPiSessionState(entry.sessionState, sessionPath, entry.messageCount);
    this.sessionState = state;
    this.sessionReadModel = hydrateFromSnapshot(createInitialSessionReadModel(), state, entry.messages);
    this.sessionCacheSyncing = entry.syncStatus !== undefined && entry.syncStatus !== "fresh";
    this.resetSessionDiff();
    this.resetSlashCommands();
    this.resetModels();
    return true;
  }

  sqlCacheStateToPiSessionState(
    cached: SessionSqlCacheState | undefined,
    sessionPath: string,
    messageCount: number,
  ): PiSessionState {
    const sessionId = cached?.sessionId ?? sessionPathToId(sessionPath);

    return {
      thinkingLevel: "off",
      isStreaming: cached?.isStreaming ?? false,
      isCompacting: cached?.isCompacting ?? false,
      steeringMode: "one-at-a-time",
      followUpMode: "one-at-a-time",
      sessionFile: cached?.sessionFile ?? sessionPath,
      sessionId,
      autoCompactionEnabled: true,
      messageCount,
      pendingMessageCount: 0,
    };
  }

  cancelSqlCachePersist() {
    if (this.sqlCachePersistTimer === undefined) {
      return;
    }

    clearTimeout(this.sqlCachePersistTimer);
    this.sqlCachePersistTimer = undefined;
  }

  schedulePersistSessionSqlCache() {
    if (!this.repoPath || !this.sessionState) {
      return;
    }

    if (this.sessionReadModel.isAgentRunning || this.sessionReadModel.phase === "running") {
      return;
    }

    this.cancelSqlCachePersist();
    this.sqlCachePersistTimer = setTimeout(() => {
      this.sqlCachePersistTimer = undefined;
      void this.persistSessionSqlCacheImmediate();
    }, 500);
  }

  async persistSessionSqlCacheImmediate() {
    const sessionPath = this.selectedSessionPath ?? this.sessionState?.sessionFile;
    const repoPath = this.repoPath;

    if (!sessionPath || !repoPath || !this.sessionState) {
      return;
    }

    if (this.sessionReadModel.isAgentRunning || this.sessionReadModel.phase === "running") {
      return;
    }

    if (this.sessionReadModel.messages.length === 0) {
      return;
    }

    await saveSessionSqlCache({
      sessionPath,
      repoPath,
      messages: this.sessionReadModel.messages,
      sessionState: {
        isStreaming: this.sessionState.isStreaming,
        isCompacting: this.sessionState.isCompacting,
        sessionFile: this.sessionState.sessionFile,
        sessionId: this.sessionState.sessionId,
      },
      messageCount: this.sessionReadModel.messages.length,
      syncStatus: "fresh",
    });
  }

  applyCachedSession(entry: SessionCacheEntry) {
    if (!entry) {
      return;
    }

    this.sessionReadModel = entry.sessionReadModel;
    this.sessionState = entry.sessionState;
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

  syncActiveAgentStatus() {
    if (!this.activeAgentId) {
      return;
    }

    const status = this.agentStatuses[this.activeAgentId];

    if (status) {
      this.piStatus = status;
    }

    this.extensionUiRequest = this.extensionUiRequestsByAgent[this.activeAgentId];
  }

  setSessionStreaming(isStreaming: boolean) {
    if (!this.sessionState) {
      return;
    }

    this.sessionState = {
      ...this.sessionState,
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

  getAgentApi() {
    if (!window.h3code) {
      throw new Error("Desktop API is unavailable.");
    }

    return getDesktopAgentApi();
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
  const sessionsByRepo = new Map<string, PiSessionSummary[]>();

  for (const session of indexedSessions) {
    const sessions = sessionsByRepo.get(session.repoPath) ?? [];
    sessions.push({
      path: session.path,
      id: session.id,
      cwd: session.repoPath,
      worktreePath: session.worktreePath,
      name: session.name,
      created: session.created,
      modified: session.modified,
      messageCount: session.messageCount,
      firstMessage: session.firstMessage,
    });
    sessionsByRepo.set(session.repoPath, sessions);
  }

  return sessionsByRepo;
}

function createSessionRowStatus(kind: SessionRowStatusKind): SessionRowStatus {
  switch (kind) {
    case "error":
      return {
        kind,
        label: "Pi error",
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
        label: "Pi running",
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
