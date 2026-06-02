export type SessionSqlCacheState = {
  isStreaming?: boolean;
  isCompacting?: boolean;
  sessionFile?: string;
  sessionId?: string;
};

export type SessionSqlCacheEntry = {
  sessionPath: string;
  repoPath: string;
  providerId?: string;
  messages: unknown[];
  sessionState?: SessionSqlCacheState;
  messageCount: number;
  syncStatus?: "fresh" | "stale" | "syncing" | "error";
};

export type SessionSqlCacheUpsert = {
  sessionPath: string;
  repoPath: string;
  providerId?: string;
  messages: unknown[];
  sessionState?: SessionSqlCacheState;
  messageCount?: number;
  syncStatus?: "fresh" | "stale" | "syncing" | "error";
};

function getH3codeApi() {
  return typeof window !== "undefined" ? window.h3code : undefined;
}

export async function loadSessionSqlCache(sessionPath: string): Promise<SessionSqlCacheEntry | undefined> {
  const api = getH3codeApi();

  if (!api?.getSessionMessageCache) {
    return undefined;
  }

  const entry = await api.getSessionMessageCache(sessionPath);

  if (!entry) {
    return undefined;
  }

  return {
    sessionPath: entry.sessionPath,
    repoPath: entry.repoPath,
    providerId: entry.providerId,
    messages: entry.messages,
    sessionState: entry.sessionState,
    messageCount: entry.messageCount,
    syncStatus: entry.syncStatus,
  };
}

export async function saveSessionSqlCache(input: SessionSqlCacheUpsert): Promise<void> {
  const api = getH3codeApi();

  if (!api?.upsertSessionMessageCache) {
    return;
  }

  await api.upsertSessionMessageCache({
    sessionPath: input.sessionPath,
    repoPath: input.repoPath,
    providerId: input.providerId ?? "pi",
    messages: input.messages,
    sessionState: input.sessionState,
    messageCount: input.messageCount,
    syncStatus: input.syncStatus ?? "fresh",
    syncedAt: new Date().toISOString(),
  });
}

export async function removeSessionSqlCache(sessionPath: string): Promise<void> {
  const api = getH3codeApi();

  if (!api?.deleteSessionMessageCache) {
    return;
  }

  await api.deleteSessionMessageCache(sessionPath);
}
