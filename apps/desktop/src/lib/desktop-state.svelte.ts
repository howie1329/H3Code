import { goto } from "$app/navigation";

import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input/index.js";
import { extractSessionMetadata } from "$lib/components/desktop/transcript-normalize.js";
import type { ConnectionStatus } from "$lib/connection-status.js";
import { getDesktopShellApi } from "$lib/desktop-shell-api.js";
import {
  abortHarnessSession,
  createHarnessChat,
  resolveHarnessStreamUrl,
} from "$lib/harness-chat.js";
import { createLiveSessionSummary, listIndexedSessionsForRepo } from "$lib/harness-sessions.js";
import type { ActiveProviderUiRequest, ProviderUiResponse } from "$lib/interaction-ui.js";
import {
  buildTranscriptViewModelFromUiMessages,
} from "$lib/ui-message-transcript.js";
import {
  clearAllIndexedData,
  getPreferences,
  getSessionUiMessages,
  removeIndexedRepo,
  removeIndexedSession,
  updateDesktopSettings,
  type DesktopPreferences,
  type DesktopSettings,
  type IndexedSessionPreference,
} from "$lib/metadata-client.js";
import { getSessionDisplayTitle } from "$lib/session-display-title.js";
import { indexedSessionToSummary } from "$lib/session-summary.js";
import { findProviderModel } from "$lib/provider-model.js";
import type { ProviderCommand, ProviderModel, ProviderQueueMode, SessionDiffState, SessionNotification } from "$lib/desktop-types.js";
import { DESKTOP_GATEWAY_MODELS } from "@h3code/agent-provider-pi/harness";
import type { Chat } from "@ai-sdk/svelte";
import type { SessionSummary } from "@h3code/agent-protocol";
import type { UIMessage } from "ai";

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

const GATEWAY_MODEL_OPTIONS: ProviderModel[] = DESKTOP_GATEWAY_MODELS.map((id) => {
  const slashIndex = id.indexOf("/");
  const provider = slashIndex === -1 ? "openai" : id.slice(0, slashIndex);
  const shortName = slashIndex === -1 ? id : id.slice(slashIndex + 1);

  return {
    id,
    modelId: id,
    provider,
    name: shortName,
  };
});

class DesktopState {
  platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");
  supportsSlashCommands = false;
  supportsModelPicker = true;
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
  harnessChat = $state<Chat<UIMessage> | undefined>();
  sessionDiff = $state<SessionDiffState>({ files: [], changedFiles: 0, patch: "" });
  sessionDiffLoading = $state(false);
  sessionDiffError = $state<string | undefined>();
  sessionDiffPanelOpen = $state(false);
  slashCommands = $state<ProviderCommand[]>([]);
  slashCommandsLoading = $state(false);
  slashCommandsError = $state<string | undefined>();
  availableModels = $state<ProviderModel[]>([]);
  pendingModel = $state<ProviderModel | undefined>();
  pendingThinkingLevel = $state<string | undefined>();
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

  selectedSession = $derived(this.sessions.find((session) => session.id === this.selectedSessionId));
  canUseSession = $derived(this.connectionStatus.state === "connected" && Boolean(this.activeSessionId));
  isSessionReconciled = $derived(Boolean(this.activeSessionId) && !this.isSwitchingSession);
  harnessMessages = $derived(this.harnessChat?.messages ?? []);
  harnessStatus = $derived(this.harnessChat?.status ?? "ready");
  canSubmit = $derived(
    this.canUseSession &&
      this.isSessionReconciled &&
      !this.isBusy &&
      !this.isSendingPrompt &&
      this.harnessStatus === "ready" &&
      this.promptValue.trim().length > 0,
  );
  hasActiveWorkspaceSession = $derived(Boolean(this.activeSessionId));
  canSubmitLanding = $derived(
    Boolean(this.landingRepoPath && this.landingPromptValue.trim()) &&
      !this.isBusy &&
      !this.isSendingPrompt &&
      this.harnessStatus === "ready",
  );
  landingRepoName = $derived(
    this.landingRepoPath
      ? (this.repos.find((repo) => repo.path === this.landingRepoPath)?.name ?? basename(this.landingRepoPath))
      : undefined,
  );
  isAgentRunning = $derived(this.harnessStatus === "streaming" || this.harnessStatus === "submitted");
  canChangeSessionSettings = false;
  transcriptViewModel = $derived(buildTranscriptViewModelFromUiMessages(this.harnessMessages));
  composerPhaseLine = $derived(
    this.isAgentRunning ? { text: "Thinking…", tone: "working" as const } : null,
  );
  statusStripLines = $derived<string[]>([]);
  sessionNotification = $derived<SessionNotification | null>(null);
  sessionMetadata = $derived(extractSessionMetadata(this.harnessMessages));
  sessionTitle = $derived(
    this.selectedSession ? getSessionDisplayTitle(this.selectedSession) : "No session",
  );
  repoName = $derived(this.repoPath ? basename(this.repoPath) : "No repo selected");
  currentProviderModel = $derived(this.pendingModel ?? this.availableModels[0]);
  currentThinkingLevel = $derived(this.pendingThinkingLevel ?? "off");
  selectedRepo = $derived(this.repoPath ? this.repos.find((repo) => repo.path === this.repoPath) : undefined);
  hasSessionDiff = $derived(false);
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
    return () => {};
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
      const preferences = await getPreferences();
      const sessions = listIndexedSessionsForRepo(preferences, nextRepoPath);
      this.repos = updateRepo(this.repos, nextRepoPath, {
        sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });

      if (nextRepoPath === this.repoPath) {
        this.sessions = sessions;
      }

      void markRecent;
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
    options: { navigateToWorkspace?: boolean; sessionId?: string } = {},
  ) {
    const { navigateToWorkspace = true, sessionId = crypto.randomUUID() } = options;
    this.errorMessage = undefined;
    this.connectionStatus = { state: "starting", repoPath: nextRepoPath };

    try {
      const chat = await this.createHarnessChatForSession(sessionId, nextRepoPath);
      this.pendingModel = undefined;
      this.pendingThinkingLevel = undefined;
      await this.attachHarnessSession(sessionId, nextRepoPath, chat);

      const preferences = await getPreferences();
      const listedSessions = listIndexedSessionsForRepo(preferences, nextRepoPath);
      const liveSummary = createLiveSessionSummary({ sessionId, repoPath: nextRepoPath });
      const sessions = this.mergeLiveSessionSummary(listedSessions, liveSummary);

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

  async createHarnessChatForSession(sessionId: string, repoPath: string): Promise<Chat<UIMessage>> {
    const api = await resolveHarnessStreamUrl();
    const cached = await getSessionUiMessages(sessionId);
    const model = this.pendingModel?.modelId ?? this.pendingModel?.id;
    const thinkingLevel = this.pendingThinkingLevel;

    return createHarnessChat({
      sessionId,
      repoPath,
      api,
      messages: (cached ?? []) as unknown as UIMessage[],
      model,
      thinkingLevel,
    });
  }

  async attachHarnessSession(sessionId: string, nextRepoPath: string, chat: Chat<UIMessage>) {
    this.harnessChat = chat;
    this.activeSessionId = sessionId;
    this.repoPath = nextRepoPath;
    this.worktreePath = nextRepoPath;
    this.selectedSessionId = sessionId;
    this.connectionStatus = {
      state: "connected",
      sessionId,
      repoPath: nextRepoPath,
    };
    this.resetSlashCommands();
    this.resetSessionDiff();
    this.providerUiRequest = undefined;

    const liveSummary = createLiveSessionSummary({ sessionId, repoPath: nextRepoPath });
    this.sessions = this.mergeLiveSessionSummary(this.sessions, liveSummary);
    this.repos = updateRepo(this.repos, nextRepoPath, { sessions: this.sessions });
  }

  clearWorkspaceSessionState() {
    this.harnessChat = undefined;
    this.repoPath = undefined;
    this.activeSessionId = undefined;
    this.worktreePath = undefined;
    this.sessions = [];
    this.selectedSessionId = undefined;
    this.isSwitchingSession = false;
    this.connectionStatus = { state: "disconnected" };
    this.resetSlashCommands();
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
      const chat = await this.createHarnessChatForSession(sessionId, repoPath);
      this.resetSessionDiff();
      await this.attachHarnessSession(sessionId, repoPath, chat);

      const preferences = await getPreferences();
      const sessions = listIndexedSessionsForRepo(preferences, repoPath);
      const liveSummary = createLiveSessionSummary({ sessionId, repoPath });
      this.sessions = this.mergeLiveSessionSummary(sessions, liveSummary);
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
    if (!text || !this.canUseSession || !this.activeSessionId || !this.harnessChat) {
      return;
    }

    this.isSendingPrompt = true;

    try {
      this.errorMessage = undefined;
      await this.harnessChat.sendMessage({ text });
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
      const preferences = await removeIndexedSession(sessionId);
      this.applyPreferencesSnapshot(preferences);
      const sessions = listIndexedSessionsForRepo(preferences, repoPath);
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
      this.harnessChat?.stop();
      await abortHarnessSession(this.activeSessionId!);
    });
  }

  async refreshSessionDiff() {
    this.resetSessionDiff();
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

  resetSlashCommands() {
    this.slashCommands = [];
    this.slashCommandsLoaded = false;
    this.slashCommandsLoading = false;
    this.slashCommandsError = undefined;
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

  async ensureSlashCommands(_refresh = false) {
    this.slashCommands = [];
    this.slashCommandsLoaded = false;
    this.slashCommandsLoading = false;
    this.slashCommandsError = undefined;
  }

  slashCommandsLoaded = false;

  async ensureAvailableModels(refresh = false) {
    if (this.modelsLoaded && !refresh) {
      return;
    }

    this.modelsLoading = true;
    this.modelsError = undefined;

    try {
      this.availableModels = GATEWAY_MODEL_OPTIONS;
      this.modelsLoaded = true;
    } catch (error) {
      this.modelsError = getErrorMessage(error);
    } finally {
      this.modelsLoading = false;
    }
  }

  modelsLoaded = false;

  async setProviderModel(model: ProviderModel) {
    this.pendingModel = model;
  }

  async setModel(provider: string | undefined, modelId: string) {
    const model = findProviderModel(this.availableModels, provider, modelId) ?? {
      id: modelId,
      modelId,
      provider,
    };

    await this.setProviderModel(model);
  }

  async setThinkingLevel(level: string) {
    this.pendingThinkingLevel = level;
  }

  async setSteeringMode(_mode: string) {}

  async setFollowUpMode(_mode: string) {}

  async setAutoCompaction(_enabled: boolean) {}

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

  mergeLiveSessionSummary(sessions: SessionSummary[], live: SessionSummary): SessionSummary[] {
    const existingIndex = sessions.findIndex((entry) => entry.id === live.id);

    if (existingIndex !== -1) {
      return sessions.map((entry, index) => (index === existingIndex ? { ...entry, ...live } : entry));
    }

    return [live, ...sessions];
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

  dismissSessionNotification(_notificationId: string) {}

  clearProviderUiRequest() {
    this.providerUiRequest = undefined;
  }

  async respondToProviderUi(_response: ProviderUiResponse) {}

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
