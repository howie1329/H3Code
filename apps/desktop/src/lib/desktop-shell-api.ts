export type DesktopShellApi = {
  getAppVersion: () => Promise<string>;
  selectRepo: () => Promise<{ path: string } | null>;
  revealPath: (targetPath: string) => Promise<string>;
  revealPreferencesDatabase: () => Promise<string>;
};

function requireH3Code() {
  if (!window.h3code) {
    throw new Error("Desktop API is unavailable.");
  }

  return window.h3code;
}

export function getDesktopShellApi(): DesktopShellApi {
  const api = requireH3Code();

  return {
    getAppVersion: () => api.getAppVersion(),
    selectRepo: () => api.selectRepo(),
    revealPath: (targetPath) => api.revealPath(targetPath),
    revealPreferencesDatabase: () => api.revealPreferencesDatabase(),
  };
}
