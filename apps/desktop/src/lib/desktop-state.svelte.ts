import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input/index.js";

export type ActivityItem = {
  type: string;
  detail: string;
};

export type SidebarRepo = {
  name: string;
  path: string;
};

class DesktopState {
  platform = typeof window === "undefined" ? "desktop" : (window.h3code?.platform ?? "desktop");
  promptValue = $state("");
  repoPath = $state<string | undefined>();
  repos = $state<SidebarRepo[]>([]);
  sessions = $state<PiSessionSummary[]>([]);
  selectedSessionPath = $state<string | undefined>();
  sessionState = $state<PiSessionState | undefined>();
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
        void this.refreshActiveMessages();
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

    await this.connectRepo(selected.path);
  }

  async connectRepo(nextRepoPath: string) {
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      this.activity = [];
      const result = await this.requireApi().connectRepo(nextRepoPath);

      this.repoPath = result.repoPath;
      this.repos = upsertRepo(this.repos, result.repoPath);
      this.sessions = result.sessions;
      this.selectedSessionPath = result.selectedSessionPath;
      this.sessionState = result.state;
      this.messages = result.messages ?? [];
    });
  }

  async handleSwitchSession(sessionPath: string) {
    if (sessionPath === this.selectedSessionPath) {
      return;
    }

    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const result = await this.requireApi().switchSession(sessionPath);
      this.selectedSessionPath = sessionPath;
      this.sessionState = result.state;
      this.messages = result.messages;
    });
  }

  async handleNewSession() {
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      const result = await this.requireApi().newSession(this.selectedSessionPath);
      this.sessionState = result.state;
      this.selectedSessionPath = result.state.sessionFile;
      this.messages = result.messages;
      this.sessions = await this.requireApi().listSessions();
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
      await this.refreshActiveMessages();
    });
  }

  async handleAbort() {
    await this.withBusy(async () => {
      this.errorMessage = undefined;
      await this.requireApi().abort();
      await this.refreshActiveMessages();
    });
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

function upsertRepo(currentRepos: SidebarRepo[], nextRepoPath: string) {
  const nextRepo = { name: basename(nextRepoPath), path: nextRepoPath };
  return [nextRepo, ...currentRepos.filter((repo) => repo.path !== nextRepoPath)];
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
