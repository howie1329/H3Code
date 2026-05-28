import os from "node:os";
import path from "node:path";
import { closePreferencesDatabase } from "./preferences.js";
let configuredDataDir;
export function configureMetadataStore(config) {
    configuredDataDir = config.dataDir;
    closePreferencesDatabase();
}
export function getConfiguredDataDir() {
    if (!configuredDataDir) {
        throw new Error("configureMetadataStore must be called before using @h3code/agent-metadata");
    }
    return configuredDataDir;
}
export function defaultMetadataDataDir() {
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
export function resolveMetadataDataDir(explicit) {
    return explicit ?? defaultMetadataDataDir();
}
//# sourceMappingURL=config.js.map