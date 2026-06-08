export type DesktopSettings = {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  preferDiffPanel: boolean;
  autoConnectOnLaunch: boolean;
};

export type RecentRepoPreference = {
  path: string;
  name: string;
  addedAt: string;
  lastOpenedAt: string;
  lastSessionPath?: string;
  sessionsIndexedAt?: string;
};

export type IndexedSessionPreference = {
  path: string;
  repoPath: string;
  worktreePath?: string;
  id: string;
  name?: string;
  created: string;
  modified: string;
  lastOpenedAt?: string;
  messageCount: number;
  firstMessage: string;
};

export type PreferencesSnapshot = {
  recentRepos: RecentRepoPreference[];
  indexedSessions: IndexedSessionPreference[];
  lastSelectedRepoPath?: string;
  lastSelectedSessionPath?: string;
  desktopSettings: DesktopSettings;
  databasePath: string;
  piExecutablePath: string;
};

export type SessionMessageCacheSyncStatus = "fresh" | "stale" | "syncing" | "error";

export type SessionMessageCacheState = {
  isStreaming?: boolean;
  isCompacting?: boolean;
  sessionRef?: string;
  sessionId?: string;
};

export type SessionMessageCacheEntry = {
  sessionRef: string;
  repoPath: string;
  providerId?: string;
  messages: unknown[];
  sessionState?: SessionMessageCacheState;
  messageCount: number;
  sourceMtimeMs?: number;
  sourceSizeBytes?: number;
  contentHash: string;
  cachedAt: string;
  syncedAt?: string;
  lastOpenedAt: string;
  syncStatus?: SessionMessageCacheSyncStatus;
};

export type SessionMessageCacheUpsert = Omit<
  SessionMessageCacheEntry,
  "contentHash" | "cachedAt" | "messageCount" | "lastOpenedAt"
> & {
  messageCount?: number;
  lastOpenedAt?: string;
  contentHash?: string;
  cachedAt?: string;
};
