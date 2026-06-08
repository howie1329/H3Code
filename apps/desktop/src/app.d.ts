declare global {
  interface Window {
    h3code?: {
      platform: NodeJS.Platform;
      getAgentServerUrl: () => Promise<string | undefined>;
      getAppVersion: () => Promise<string>;
      selectRepo: () => Promise<{ path: string } | null>;
      revealPath: (targetPath: string) => Promise<string>;
      revealPreferencesDatabase: () => Promise<string>;
    };
  }
}

export {};
