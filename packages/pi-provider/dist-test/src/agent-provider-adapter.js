import { PiSdkProvider } from "./pi-provider.js";
const piCapabilities = {
    sessions: {
        list: false,
        create: true,
        switch: true,
        snapshot: true,
        fork: true,
        import: true,
    },
    runs: {
        stream: true,
        abort: true,
        steer: true,
        followUp: true,
        retry: true,
    },
    ui: {
        model: true,
        thinkingLevel: true,
        extensionUi: true,
        compaction: true,
        commands: true,
        modelsList: true,
        queueSettings: true,
    },
    workspace: {
        localCwd: true,
    },
};
export class PiAgentProvider {
    id = "pi";
    capabilities = piCapabilities;
    #providerFactory;
    #providerOptions;
    constructor(options = {}) {
        this.#providerFactory = options.providerFactory ?? ((providerOptions) => new PiSdkProvider(providerOptions));
        const { providerFactory: _providerFactory, ...providerOptions } = options;
        void _providerFactory;
        this.#providerOptions = providerOptions;
    }
    async connect(ctx) {
        const provider = this.#providerFactory({
            ...this.#providerOptions,
            cwd: ctx.repoPath,
            session: ctx.sessionRef ? { mode: "open", sessionPath: ctx.sessionRef } : { mode: "create" },
        });
        const snapshot = await provider.start();
        return {
            providerId: this.id,
            sessionRef: snapshot.sessionFile ?? snapshot.sessionId,
            provider,
            repoPath: ctx.repoPath,
        };
    }
    async disconnect(connection) {
        await getPiConnection(connection).provider.dispose();
    }
    async sendMessage(connection, input) {
        const provider = getPiConnection(connection).provider;
        if (input.mode === "steer") {
            await provider.steer({ text: input.text, images: input.images });
            return;
        }
        if (input.mode === "followUp") {
            await provider.followUp({ text: input.text, images: input.images });
            return;
        }
        await provider.prompt({
            text: input.text,
            images: input.images,
            source: mapSendSource(input.source),
            expandPromptTemplates: input.expandPromptTemplates,
            streamingBehavior: input.streamingBehavior,
        });
    }
    async abort(connection) {
        await getPiConnection(connection).provider.abort();
    }
    async setModel(connection, model) {
        await getPiConnection(connection).provider.setModel(model);
    }
    async setThinkingLevel(connection, level) {
        getPiConnection(connection).provider.setThinkingLevel(level);
    }
    async listCommands(connection) {
        return getPiConnection(connection).provider.listCommands();
    }
    async listModels(connection) {
        return getPiConnection(connection).provider.listModels();
    }
    async setSteeringMode(connection, mode) {
        getPiConnection(connection).provider.setSteeringMode(mode);
    }
    async setFollowUpMode(connection, mode) {
        getPiConnection(connection).provider.setFollowUpMode(mode);
    }
    async setAutoCompaction(connection, enabled) {
        getPiConnection(connection).provider.setAutoCompactionEnabled(enabled);
    }
    async respondToUiRequest(connection, response) {
        getPiConnection(connection).provider.respondToUiRequest(response);
    }
    async switchSession(connection, sessionRef) {
        const piConnection = getPiConnection(connection);
        const result = await piConnection.provider.switchSession(sessionRef);
        piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
        return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
    }
    async createSession(connection, options) {
        const piConnection = getPiConnection(connection);
        const result = await piConnection.provider.newSession(options?.parentSession);
        piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
        return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
    }
    async forkSession(connection, entryId, position) {
        const piConnection = getPiConnection(connection);
        const result = await piConnection.provider.fork(entryId, position);
        piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
        return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
    }
    async importSession(connection, inputPath, cwdOverride) {
        const piConnection = getPiConnection(connection);
        const result = await piConnection.provider.importFromJsonl(inputPath, cwdOverride);
        piConnection.sessionRef = result.snapshot.sessionFile ?? result.snapshot.sessionId;
        return mapSnapshot(this.id, piConnection.repoPath, result.snapshot);
    }
    async getSnapshot(connection) {
        const piConnection = getPiConnection(connection);
        return mapSnapshot(this.id, piConnection.repoPath, piConnection.provider.snapshot());
    }
    subscribe(connection, onEvent) {
        const piConnection = getPiConnection(connection);
        return piConnection.provider.subscribe((event) => {
            onEvent(mapEvent(this.id, piConnection.repoPath, event));
        });
    }
}
export function mapPiSnapshotToCore(providerId, repoPath, snapshot) {
    return mapSnapshot(providerId, repoPath, snapshot);
}
export function mapPiEventToCore(providerId, repoPath, event) {
    return mapEvent(providerId, repoPath, event);
}
function mapSnapshot(providerId, repoPath, snapshot) {
    const sessionRef = snapshot.sessionFile ?? snapshot.sessionId;
    return {
        summary: {
            providerId,
            sessionRef,
            status: snapshot.isStreaming || snapshot.isCompacting ? "running" : "idle",
            title: snapshot.sessionName,
            repoPath,
        },
        cwd: snapshot.cwd,
        messages: snapshot.messages,
        streamingMessage: snapshot.streamingMessage,
        isStreaming: snapshot.isStreaming,
        isCompacting: snapshot.isCompacting,
        model: snapshot.model,
        thinkingLevel: snapshot.thinkingLevel,
        steeringMode: snapshot.steeringMode,
        followUpMode: snapshot.followUpMode,
        autoCompactionEnabled: snapshot.autoCompactionEnabled,
        steering: snapshot.steering,
        followUp: snapshot.followUp,
        activeTools: snapshot.activeTools,
        tools: snapshot.tools,
        stats: snapshot.stats,
        diagnostics: snapshot.diagnostics,
        modelFallbackMessage: snapshot.modelFallbackMessage,
    };
}
function mapEvent(providerId, repoPath, event) {
    if (event.type === "session.changed") {
        return {
            type: "session.changed",
            snapshot: mapSnapshot(providerId, repoPath, event.snapshot),
            occurredAt: event.occurredAt,
        };
    }
    if (event.type === "extension.ui.request") {
        return {
            type: "extension.ui.request",
            request: mapUiRequest(event.request),
            occurredAt: event.occurredAt,
        };
    }
    return event;
}
function mapUiRequest(request) {
    switch (request.kind) {
        case "select":
            return {
                id: request.id,
                kind: request.kind,
                title: request.title,
                message: request.message,
                options: request.options ?? [],
            };
        case "confirm":
            return {
                id: request.id,
                kind: request.kind,
                title: request.title,
                message: request.message,
            };
        case "input":
            return {
                id: request.id,
                kind: request.kind,
                title: request.title,
                message: request.message,
                placeholder: request.placeholder,
                value: request.value,
            };
        case "editor":
            return {
                id: request.id,
                kind: request.kind,
                title: request.title,
                message: request.message,
                value: request.value,
            };
    }
}
function mapSendSource(source) {
    switch (source) {
        case "extension":
            return "extension";
        case "prompt":
            return "prompt";
        case "skill":
            return "skill";
        case "interactive":
            return "interactive";
        default:
            return undefined;
    }
}
function getPiConnection(connection) {
    if (!("provider" in connection) || !(connection.provider instanceof PiSdkProvider)) {
        throw new Error("Invalid PI provider connection.");
    }
    return connection;
}
//# sourceMappingURL=agent-provider-adapter.js.map