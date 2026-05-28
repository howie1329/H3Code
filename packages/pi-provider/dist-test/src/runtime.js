import { createAgentSessionFromServices, createAgentSessionRuntime, createAgentSessionServices, getAgentDir, SessionManager, } from "@earendil-works/pi-coding-agent";
export const createRealPiRuntime = async (options) => {
    const agentDir = options.agentDir;
    let runtimeServices;
    const createRuntime = async ({ cwd, sessionManager, sessionStartEvent }) => {
        const services = await createAgentSessionServices({
            cwd,
            agentDir,
            authStorage: options.authStorage,
            modelRegistry: options.modelRegistry,
            settingsManager: options.settingsManager,
        });
        if (options.resourceLoader) {
            services.resourceLoader = options.resourceLoader;
        }
        runtimeServices = {
            modelRegistry: services.modelRegistry,
            resourceLoader: services.resourceLoader,
        };
        const created = await createAgentSessionFromServices({
            services,
            sessionManager,
            sessionStartEvent,
        });
        return {
            ...created,
            services,
            diagnostics: services.diagnostics,
        };
    };
    const runtime = await createAgentSessionRuntime(createRuntime, {
        cwd: options.cwd,
        agentDir,
        sessionManager: createSessionManager(options),
    });
    return { ...runtime, services: runtimeServices };
};
export function withRuntimeDefaults(options) {
    return {
        ...options,
        agentDir: options.agentDir || getAgentDir(),
    };
}
function createSessionManager(options) {
    if (options.session.mode === "open") {
        if (!options.session.sessionPath) {
            throw new Error("sessionPath is required when opening a PI session.");
        }
        return SessionManager.open(options.session.sessionPath);
    }
    if (options.session.mode === "continueRecent") {
        return SessionManager.continueRecent(options.cwd);
    }
    return SessionManager.create(options.cwd);
}
//# sourceMappingURL=runtime.js.map