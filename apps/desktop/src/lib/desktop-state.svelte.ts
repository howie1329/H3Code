import { goto } from "$app/navigation";
import { page } from "$app/state";

import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input/index.js";

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
  showAllSessions?: boolean;
};

const defaultDesktopSettings: DesktopSettings = {
  sidebarOpen: true,
  contextPanelOpen: true,
};

type OptimisticUserMessage = {
  id: string;
  role: "user";
  content: string;
  timestamp: number;
  optimistic: true;
};

type LiveToolExecutionMessage = {
  id: string;
  role: "toolExecution";
  toolCallId: string;
  toolName: string;
  content: unknown;
  args?: unknown;
  isError: boolean;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  timestamp: number;
};

class DesktopState {
  platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");
  promptValue = $state("");
  repoPath = $state<string | undefined>();
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
  messages = $state<unknown[]>([]);
  pendingUserMessages = $state<OptimisticUserMessage[]>([]);
  streamingMessage = $state<unknown | undefined>();
  liveToolExecutions = $state<Record<string, LiveToolExecutionMessage>>({});
  piStatus = $state<PiStatus>({ state: "disconnected" });
  activity = $state<ActivityItem[]>([]);
  isBusy = $state(false);
  isSendingPrompt = $state(false);
  isAgentRunning = $state(false);
  errorMessage = $state<string | undefined>();
  preferencesLoaded = $state(false);
  preferencesDatabasePath = $state<string | undefined>();
  desktopSettings = $state<DesktopSettings>(defaultDesktopSettings);

  selectedSession = $derived(this.sessions.find((session) => session.path === this.selectedSessionPath));
  canUseSession = $derived(this.piStatus.state === "connected" && Boolean(this.selectedSessionPath || this.sessionState?.sessionFile));
  canSubmit = $derived(this.canUseSession && !this.isBusy && !this.isSendingPrompt && this.promptValue.trim().length > 0);
  transcriptMessages = $derived([
    ...this.messages,
    ...this.pendingUserMessages,
    ...(this.streamingMessage ? [this.streamingMessage] : []),
    ...Object.values(this.liveToolExecutions),
  ]);
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

  ensureWorkspaceRoute() {
    if (typeof window === "undefined") {
      return;
    }

    if (page.url.pathname !== "/workspace") {
      void goto("/workspace");
    }
  }

  initializeListeners() {
    const removeEventListener = window.h3code?.onPiEvent((event) => {
      const item = formatActivity(event);
      this.activity = [item, ...this.activity].slice(0, 8);
      this.handlePiEvent(event, item.type);
    });

    const removeStatusListener = window.h3code?.onPiStatus((status) => {
      this.piStatus = status;

      if (status.state !== "connected") {
        this.resetSlashCommands();
        this.resetTransientTranscript();
        this.resetSessionDiff();
      }

      if (status.diagnostic) {
        this.errorMessage = status.diagnostic;
      }
    });

    return () => {
      removeEventListener?.();
      removeStatusListener?.();
    };
  }

  async initializePreferences() {
    if (!window.h3code) {
      return;
    }

    try {
      const preferences = await window.h3code.getPreferences();
      this.preferencesLoaded = true;
      this.preferencesDatabasePath = preferences.databasePath;
      this.desktopSettings = preferences.desktopSettings;

      const indexedSessionsByRepo = groupIndexedSessionsByRepo(preferences.indexedSessions);
      this.repos = preferences.recentRepos.map((repo) =>
        createRepo(repo.path, {
          name: repo.name,
          expanded: repo.path === preferences.lastSelectedRepoPath,
          sessions: indexedSessionsByRepo.get(repo.path) ?? [],
          sessionsLoaded: Boolean(indexedSessionsByRepo.get(repo.path)?.length),
          sessionsLoading: false,
          sessionsError: undefined,
        }),
      );

      if (preferences.lastSelectedRepoPath) {
        this.repoPath = preferences.lastSelectedRepoPath;
        this.selectedSessionPath = preferences.lastSelectedSessionPath;
        this.sessions = indexedSessionsByRepo.get(preferences.lastSelectedRepoPath) ?? [];
        await this.loadRepoSessions(preferences.lastSelectedRepoPath);
      }
    } catch (error) {
      this.preferencesLoaded = true;
      this.errorMessage = getErrorMessage(error);
    }
  }

  async handleSelectRepo() {
    const selected = await window.h3code?.selectRepo();

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

  showAllRepoSessions(nextRepoPath: string) {
    this.repos = updateRepo(this.repos, nextRepoPath, { showAllSessions: true });
  }

  async loadRepoSessions(nextRepoPath: string, markRecent = false) {
    this.repos = updateRepo(this.repos, nextRepoPath, {
      sessionsLoading: true,
      sessionsError: undefined,
    });

    try {
      const sessions = await this.requireApi().listRepoSessions(nextRepoPath, markRecent);
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

  async connectRepoInternal(nextRepoPath: string, selectedSessionPath?: string) {
    this.errorMessage = undefined;
    this.activity = [];
    const result = await this.requireApi().connectRepo(nextRepoPath, selectedSessionPath);

    this.repoPath = result.repoPath;
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
    this.messages = result.messages ?? [];
    this.resetTransientTranscript();
    this.isAgentRunning = Boolean(result.state?.isStreaming);
    await this.refreshSessionStats();
    await this.refreshSessionDiff();
    this.ensureWorkspaceRoute();
  }

  async handleSwitchSession(sessionPath: string, repoPath = this.repoPath) {
    if (!repoPath) {
      return;
    }

    this.ensureWorkspaceRoute();

    if (repoPath !== this.repoPath || this.piStatus.state !== "connected") {
      await this.connectRepo(repoPath, sessionPath);
      return;
    }

    if (sessionPath === this.selectedSessionPath) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const result = await this.requireApi().switchSession(sessionPath);
      this.selectedSessionPath = sessionPath;
      this.sessionState = result.state;
      this.sessionStats = null;
      this.resetSessionDiff();
      this.resetSlashCommands();
      this.messages = result.messages;
      this.resetTransientTranscript();
      this.isAgentRunning = Boolean(result.state?.isStreaming);
      await this.refreshSessionStats();
      await this.refreshSessionDiff();
    });
  }

  async handleNewSession(repoPath = this.repoPath) {
    if (!repoPath) {
      this.errorMessage = "Select a repo before creating a session.";
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;

      if (repoPath !== this.repoPath || this.piStatus.state !== "connected") {
        await this.connectRepoInternal(repoPath);
      }

      const result = await this.requireApi().newSession(this.selectedSessionPath);
      this.sessionState = result.state;
      this.selectedSessionPath = result.state.sessionFile;
      this.sessionStats = null;
      this.resetSessionDiff();
      this.resetSlashCommands();
      this.messages = result.messages;
      this.resetTransientTranscript();
      this.isAgentRunning = Boolean(result.state.isStreaming);
      this.sessions = await this.requireApi().listSessions();
      this.repos = upsertRepo(this.repos, repoPath, {
        expanded: true,
        sessions: this.sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });
      await this.refreshSessionStats();
      await this.refreshSessionDiff();
      this.ensureWorkspaceRoute();
    });
  }

  async removeRepoFromIndex(repoPath: string) {
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const preferences = await this.requireApi().removeIndexedRepo(repoPath);
      const indexedSessionsByRepo = groupIndexedSessionsByRepo(preferences.indexedSessions);
      this.preferencesDatabasePath = preferences.databasePath;
      this.desktopSettings = preferences.desktopSettings;
      this.repos = preferences.recentRepos.map((repo) =>
        createRepo(repo.path, {
          name: repo.name,
          expanded: repo.path === preferences.lastSelectedRepoPath,
          sessions: indexedSessionsByRepo.get(repo.path) ?? [],
          sessionsLoaded: Boolean(indexedSessionsByRepo.get(repo.path)?.length),
          sessionsLoading: false,
          sessionsError: undefined,
        }),
      );

      if (this.repoPath === repoPath) {
        this.repoPath = undefined;
        this.sessions = [];
        this.selectedSessionPath = undefined;
        this.sessionState = undefined;
        this.sessionStats = null;
        this.resetSessionDiff();
        this.resetSlashCommands();
        this.messages = [];
        this.resetTransientTranscript();
        this.isAgentRunning = false;
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
      const sessions = await this.requireApi().deletePiSession(repoPath, sessionPath);
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
        this.messages = [];
        this.resetTransientTranscript();
        this.isAgentRunning = false;
      }
    });
  }

  async handlePromptSubmit(message: PromptInputMessage, event: SubmitEvent) {
    event.preventDefault();

    const text = message.text?.trim();

    if (!text || !this.canUseSession) {
      return;
    }

    const optimisticMessage = createOptimisticUserMessage(text);
    this.pendingUserMessages = [...this.pendingUserMessages, optimisticMessage];
    this.isSendingPrompt = true;

    try {
      this.errorMessage = undefined;
      await this.requireApi().sendPrompt(text, this.sessionState?.isStreaming ? "followUp" : undefined);
      this.promptValue = "";
    } catch (error) {
      this.pendingUserMessages = this.pendingUserMessages.filter((pendingMessage) => pendingMessage.id !== optimisticMessage.id);
      this.errorMessage = getErrorMessage(error);
    } finally {
      this.isSendingPrompt = false;
    }
  }

  async handleAbort() {
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await this.requireApi().abort();
      await this.refreshActiveSessionData();
      this.resetTransientTranscript();
    });
  }

  async refreshActiveSessionData() {
    await this.refreshActiveMessages();
    await this.refreshSessionStats();
    await this.refreshSessionDiff();
  }

  async refreshActiveMessages() {
    if (!this.selectedSessionPath) {
      return;
    }

    try {
      const result = await this.requireApi().switchSession(this.selectedSessionPath);
      this.pendingUserMessages = [];
      this.sessionState = result.state;
      this.messages = result.messages;
      this.isAgentRunning = Boolean(result.state.isStreaming);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
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
      this.sessionStats = await this.requireApi().getSessionStats();
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
      this.sessionDiff = await this.requireApi().getSessionDiff();

      if (!this.hasSessionDiff) {
        this.sessionDiffPanelOpen = false;
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
        this.desktopSettings = { ...this.desktopSettings, contextPanelOpen: false };
        void this.persistDesktopSettings({ contextPanelOpen: false });
      }

      return;
    }

    this.sessionDiffPanelOpen = false;
  }

  resetSessionDiff() {
    this.sessionDiff = { patch: "", changedFiles: 0 };
    this.sessionDiffLoading = false;
    this.sessionDiffError = undefined;
    this.sessionDiffPanelOpen = false;
  }

  async ensureSlashCommands(refresh = false) {
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
      const commands = await this.requireApi().getCommands();

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

  setSidebarOpen(open: boolean) {
    if (this.desktopSettings.sidebarOpen === open) {
      return;
    }

    this.desktopSettings = { ...this.desktopSettings, sidebarOpen: open };
    void this.persistDesktopSettings({ sidebarOpen: open });
  }

  setContextPanelOpen(open: boolean) {
    if (open) {
      this.sessionDiffPanelOpen = false;
    }

    if (this.desktopSettings.contextPanelOpen === open) {
      return;
    }

    this.desktopSettings = { ...this.desktopSettings, contextPanelOpen: open };
    void this.persistDesktopSettings({ contextPanelOpen: open });
  }

  async persistDesktopSettings(settings: Partial<DesktopSettings>) {
    try {
      this.desktopSettings = await this.requireApi().updateDesktopSettings(settings);
    } catch (error) {
      this.errorMessage = getErrorMessage(error);
    }
  }

  handlePiEvent(event: unknown, type: string) {
    const record = toRecord(event);

    if (type === "agent_start") {
      this.isAgentRunning = true;
      this.setSessionStreaming(true);
      return;
    }

    if (type === "message_start" || type === "message_update" || type === "message_end") {
      const nextStreamingMessage = getStreamingMessage(record);

      if (nextStreamingMessage !== undefined) {
        this.streamingMessage = cloneForState(nextStreamingMessage);
      }

      const streamingError = getStreamingErrorMessage(record);

      if (streamingError) {
        this.errorMessage = streamingError;
      }

      return;
    }

    if (type === "tool_execution_start" || type === "tool_execution_update" || type === "tool_execution_end") {
      const toolExecution = createLiveToolExecutionMessage(record, type);

      if (toolExecution) {
        this.liveToolExecutions = {
          ...this.liveToolExecutions,
          [toolExecution.toolCallId]: toolExecution,
        };
      }

      return;
    }

    if (type === "agent_end") {
      void this.reconcileAgentEnd();
    }
  }

  async reconcileAgentEnd() {
    await this.refreshActiveSessionData();
    this.resetTransientTranscript();
    this.isAgentRunning = false;
    this.setSessionStreaming(false);
  }

  resetTransientTranscript() {
    this.pendingUserMessages = [];
    this.streamingMessage = undefined;
    this.liveToolExecutions = {};
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

  requireApi() {
    if (!window.h3code) {
      throw new Error("Desktop API is unavailable.");
    }

    return window.h3code;
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
    showAllSessions: false,
    ...updates,
  };
}

function upsertRepo(currentRepos: SidebarRepo[], nextRepoPath: string, updates: Partial<SidebarRepo> = {}) {
  const existingRepo = currentRepos.find((repo) => repo.path === nextRepoPath);
  const nextRepo = existingRepo ? { ...existingRepo, ...updates, name: basename(nextRepoPath), path: nextRepoPath } : createRepo(nextRepoPath, updates);

  return [nextRepo, ...currentRepos.filter((repo) => repo.path !== nextRepoPath)];
}

function updateRepo(currentRepos: SidebarRepo[], nextRepoPath: string, updates: Partial<SidebarRepo>) {
  if (!currentRepos.some((repo) => repo.path === nextRepoPath)) {
    return [createRepo(nextRepoPath, updates), ...currentRepos];
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createOptimisticUserMessage(content: string): OptimisticUserMessage {
  return {
    id: `optimistic-user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: "user",
    content,
    timestamp: Date.now(),
    optimistic: true,
  };
}

function getStreamingMessage(event: Record<string, unknown>) {
  if (event.message !== undefined) {
    return event.message;
  }

  const assistantEvent = toRecord(event.assistantMessageEvent);

  return assistantEvent.partial ?? assistantEvent.message ?? assistantEvent.error;
}

function createLiveToolExecutionMessage(event: Record<string, unknown>, eventType: string): LiveToolExecutionMessage | undefined {
  const toolCallId = getString(event.toolCallId);

  if (!toolCallId) {
    return undefined;
  }

  const partialResult = toRecord(event.partialResult);
  const result = toRecord(event.result);
  const isError = event.isError === true;
  const content = eventType === "tool_execution_update" ? partialResult.content : eventType === "tool_execution_end" ? result.content : [];
  const errorText = getString(event.errorText) ?? getString(result.errorText) ?? getString(result.errorMessage);

  return {
    id: `live-tool-${toolCallId}`,
    role: "toolExecution",
    toolCallId,
    toolName: getString(event.toolName) ?? "tool",
    content: errorText ? [{ type: "text", text: errorText }] : (content ?? []),
    args: event.args,
    isError,
    state: getToolExecutionState(eventType, isError),
    timestamp: Date.now(),
  };
}

function getToolExecutionState(eventType: string, isError: boolean): LiveToolExecutionMessage["state"] {
  if (eventType === "tool_execution_start") {
    return "input-available";
  }

  if (eventType === "tool_execution_update") {
    return "input-available";
  }

  return isError ? "output-error" : "output-available";
}

function cloneForState(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  return Array.isArray(value) ? [...value] : { ...(value as Record<string, unknown>) };
}

function getString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMessageRole(message: unknown) {
  const record = toRecord(message);
  const role = record.role ?? record.type;
  return typeof role === "string" ? role : "message";
}

export function formatMessageText(message: unknown): string {
  const record = toRecord(message);
  const content = record.content ?? record.text ?? record.message;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const partRecord = toRecord(part);
        return typeof partRecord.text === "string" ? partRecord.text : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return JSON.stringify(message, null, 2);
}

function formatActivity(event: unknown): ActivityItem {
  const record = toRecord(event);
  const type = typeof record.type === "string" ? record.type : "event";
  const toolName = typeof record.toolName === "string" ? record.toolName : undefined;
  const message = typeof record.message === "string" ? record.message : undefined;

  return {
    type,
    detail: toolName ?? message ?? type,
  };
}

function getStreamingErrorMessage(event: Record<string, unknown>) {
  const assistantEvent = toRecord(event.assistantMessageEvent);

  if (assistantEvent.type !== "error") {
    return undefined;
  }

  const error = assistantEvent.error;

  if (typeof error === "string") {
    return error;
  }

  const errorRecord = toRecord(error);
  const errorMessage = errorRecord.errorMessage ?? errorRecord.message;

  return typeof errorMessage === "string" ? errorMessage : "PI streaming failed.";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
