import type { DesktopPreferences, DesktopSettings, IndexedSessionPreference } from "@h3code/agent-metadata";

export type { DesktopPreferences, DesktopSettings, IndexedSessionPreference };

export async function getPreferences(): Promise<DesktopPreferences> {
  return window.h3code!.getPreferences();
}

export async function updateDesktopSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings> {
  return window.h3code!.updateDesktopSettings(settings);
}

export async function removeIndexedRepo(repoPath: string): Promise<DesktopPreferences> {
  return window.h3code!.removeIndexedRepo(repoPath);
}

export async function clearAllIndexedData(): Promise<DesktopPreferences> {
  return window.h3code!.clearAllIndexedData();
}

export async function setPiExecutablePath(path: string): Promise<DesktopPreferences> {
  return window.h3code!.setPiExecutablePath(path);
}
