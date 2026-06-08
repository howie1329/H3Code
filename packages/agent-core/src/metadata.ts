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
  id: string;
  providerSessionRef: string;
  repoPath: string;
  providerId: string;
  worktreePath?: string;
  providerSessionId?: string;
  name?: string;
  created: string;
  modified: string;
  lastOpenedAt?: string;
  messageCount: number;
  firstMessage: string;
  /** @deprecated Use providerSessionRef */
  path?: string;
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

