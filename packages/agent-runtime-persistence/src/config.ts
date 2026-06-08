import os from "node:os";
import path from "node:path";

import { closePersistenceDatabase } from "./database.js";

let configuredDataDir: string | undefined;

export type PersistenceStoreConfig = {
  dataDir: string;
};

export function configurePersistenceStore(config: PersistenceStoreConfig) {
  configuredDataDir = config.dataDir;
  closePersistenceDatabase();
}

export function getConfiguredDataDir(): string {
  if (!configuredDataDir) {
    throw new Error("configurePersistenceStore must be called before using @h3code/agent-runtime-persistence");
  }

  return configuredDataDir;
}

export function defaultPersistenceDataDir(): string {
  if (process.env.H3CODE_DATA_DIR) {
    return process.env.H3CODE_DATA_DIR;
  }

  const appName = "desktop";

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName);
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), appName);
  }

  return path.join(os.homedir(), ".config", appName);
}

export function resolvePersistenceDataDir(explicit?: string): string {
  return explicit ?? defaultPersistenceDataDir();
}
