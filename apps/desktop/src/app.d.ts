import type { DesktopPreferences, DesktopSettings, SessionUiMessage } from "@h3code/agent-metadata";

declare global {
  interface Window {
    h3code?: {
      platform: NodeJS.Platform;
      getAgentStreamUrl: () => Promise<string | undefined>;
      getAppVersion: () => Promise<string>;
      selectRepo: () => Promise<{ path: string } | null>;
      revealPath: (targetPath: string) => Promise<string>;
      revealPreferencesDatabase: () => Promise<string>;
      getPreferences: () => Promise<DesktopPreferences>;
      updateDesktopSettings: (settings: Partial<DesktopSettings>) => Promise<DesktopSettings>;
      removeIndexedRepo: (repoPath: string) => Promise<DesktopPreferences>;
      removeIndexedSession: (sessionId: string) => Promise<DesktopPreferences>;
      getSessionUiMessages: (sessionId: string) => Promise<SessionUiMessage[] | undefined>;
      saveSessionUiMessages: (sessionId: string, messages: SessionUiMessage[]) => Promise<void>;
      clearAllIndexedData: () => Promise<DesktopPreferences>;
      setPiExecutablePath: (path: string) => Promise<DesktopPreferences>;
    };
  }
}

export {};
