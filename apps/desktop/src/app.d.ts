import type { DesktopPreferences, DesktopSettings } from "@h3code/agent-metadata";

declare global {
  interface Window {
    h3code?: {
      platform: NodeJS.Platform;
      getAgentServerUrl: () => Promise<string | undefined>;
      getAgentStreamUrl: () => Promise<string | undefined>;
      getAppVersion: () => Promise<string>;
      selectRepo: () => Promise<{ path: string } | null>;
      revealPath: (targetPath: string) => Promise<string>;
      revealPreferencesDatabase: () => Promise<string>;
      getPreferences: () => Promise<DesktopPreferences>;
      updateDesktopSettings: (settings: Partial<DesktopSettings>) => Promise<DesktopSettings>;
      removeIndexedRepo: (repoPath: string) => Promise<DesktopPreferences>;
      clearAllIndexedData: () => Promise<DesktopPreferences>;
      setPiExecutablePath: (path: string) => Promise<DesktopPreferences>;
    };
  }
}

export {};
