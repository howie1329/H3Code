import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input/index.js";

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
  messages = $state<unknown[]>([]);
  piStatus = $state<PiStatus>({ state: "disconnected" });
  activity = $state<ActivityItem[]>([]);
  isBusy = $state(false);
  errorMessage = $state<string | undefined>();

  selectedSession = $derived(this.sessions.find((session) => session.path === this.selectedSessionPath));
  canUseSession = $derived(this.piStatus.state === "connected" && Boolean(this.selectedSessionPath || this.sessionState?.sessionFile));
  canSubmit = $derived(this.canUseSession && !this.isBusy && this.promptValue.trim().length > 0);
  repoName = $derived(this.repoPath ? basename(this.repoPath) : "No repo selected");
  selectedRepo = $derived(this.repoPath ? this.repos.find((repo) => repo.path === this.repoPath) : undefined);

  initializeListeners() {
    const removeEventListener = window.h3code?.onPiEvent((event) => {
      const item = formatActivity(event);
      this.activity = [item, ...this.activity].slice(0, 8);

      if (item.type === "agent_end") {
        void this.refreshActiveSessionData();
      }
    });

    const removeStatusListener = window.h3code?.onPiStatus((status) => {
      this.piStatus = status;

      if (status.diagnostic) {
        this.errorMessage = status.diagnostic;
      }
    });

    return () => {
      removeEventListener?.();
      removeStatusListener?.();
    };
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
    await this.loadRepoSessions(nextRepoPath);
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

  async loadRepoSessions(nextRepoPath: string) {
    this.repos = updateRepo(this.repos, nextRepoPath, {
      sessionsLoading: true,
      sessionsError: undefined,
    });

    try {
      const sessions = await this.requireApi().listRepoSessions(nextRepoPath);
      this.repos = updateRepo(this.repos, nextRepoPath, {
        sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });
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
    this.messages = result.messages ?? [];
    await this.refreshSessionStats();
  }

  async handleSwitchSession(sessionPath: string, repoPath = this.repoPath) {
    if (!repoPath) {
      return;
    }

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
      this.messages = result.messages;
      await this.refreshSessionStats();
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
      this.messages = result.messages;
      this.sessions = await this.requireApi().listSessions();
      this.repos = upsertRepo(this.repos, repoPath, {
        expanded: true,
        sessions: this.sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        sessionsError: undefined,
      });
      await this.refreshSessionStats();
    });
  }

  async handlePromptSubmit(message: PromptInputMessage, event: SubmitEvent) {
    event.preventDefault();

    const text = message.text?.trim();

    if (!text || !this.canUseSession) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await this.requireApi().sendPrompt(text, this.sessionState?.isStreaming ? "followUp" : undefined);
      this.promptValue = "";
      await this.refreshActiveSessionData();
    });
  }

  async handleAbort() {
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await this.requireApi().abort();
      await this.refreshActiveSessionData();
    });
  }

  async refreshActiveSessionData() {
    await this.refreshActiveMessages();
    await this.refreshSessionStats();
  }

  async refreshActiveMessages() {
    if (!this.selectedSessionPath) {
      return;
    }

    try {
      const result = await this.requireApi().switchSession(this.selectedSessionPath);
      this.sessionState = result.state;
      this.messages = result.messages;
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

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
