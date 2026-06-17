import type { DesktopPreferences, DesktopSettings, IndexedSessionPreference, SessionUiMessage } from "@h3code/agent-metadata";

export type { DesktopPreferences, DesktopSettings, IndexedSessionPreference, SessionUiMessage };

export async function getPreferences(): Promise<DesktopPreferences> {
  return window.h3code!.getPreferences();
}

export async function updateDesktopSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings> {
  return window.h3code!.updateDesktopSettings(settings);
}

export async function removeIndexedRepo(repoPath: string): Promise<DesktopPreferences> {
  return window.h3code!.removeIndexedRepo(repoPath);
}

export async function removeIndexedSession(sessionId: string): Promise<DesktopPreferences> {
  return window.h3code!.removeIndexedSession(sessionId);
}

export async function getSessionUiMessages(sessionId: string): Promise<SessionUiMessage[] | undefined> {
  return window.h3code!.getSessionUiMessages(sessionId);
}

export async function saveSessionUiMessages(sessionId: string, messages: SessionUiMessage[]): Promise<void> {
  return window.h3code!.saveSessionUiMessages(sessionId, messages);
}

export async function clearAllIndexedData(): Promise<DesktopPreferences> {
  return window.h3code!.clearAllIndexedData();
}

export async function setPiExecutablePath(path: string): Promise<DesktopPreferences> {
  return window.h3code!.setPiExecutablePath(path);
}
