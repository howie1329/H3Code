const noopCapabilities = {
    sessions: {
        list: false,
        create: false,
        switch: false,
        snapshot: true,
        fork: false,
        import: false,
    },
    runs: {
        stream: true,
        abort: true,
        steer: false,
        followUp: false,
        retry: false,
    },
    ui: {
        model: false,
        thinkingLevel: false,
        extensionUi: false,
        compaction: false,
        commands: false,
        modelsList: false,
        queueSettings: false,
    },
    workspace: {
        localCwd: true,
    },
};
export class NoopProvider {
    id = "noop";
    capabilities = noopCapabilities;
    #listeners = new WeakMap();
    async connect(ctx) {
        return {
            providerId: this.id,
            repoPath: ctx.repoPath,
            sessionRef: ctx.sessionRef ?? "noop-session",
        };
    }
    async disconnect(connection) {
        this.#listeners.delete(connection);
    }
    async sendMessage(connection, input) {
        const now = Date.now();
        this.emit(connection, { type: "run.started", occurredAt: now });
        this.emit(connection, {
            type: "message.streaming",
            phase: "end",
            message: { role: "assistant", content: `Noop provider received ${input.mode}: ${input.text}` },
            occurredAt: now,
        });
        this.emit(connection, {
            type: "run.ended",
            occurredAt: Date.now(),
        });
    }
    async abort(connection) {
        this.emit(connection, {
            type: "provider.diagnostic",
            level: "info",
            message: "Noop provider has no active run to abort.",
            occurredAt: Date.now(),
        });
    }
    async getSnapshot(connection) {
        return {
            summary: {
                providerId: this.id,
                sessionRef: connection.sessionRef ?? "noop-session",
                status: "idle",
                title: "Noop session",
            },
            cwd: connection.repoPath ?? "",
            messages: [],
            isStreaming: false,
            isCompacting: false,
            steering: [],
            followUp: [],
            activeTools: [],
            tools: [],
            diagnostics: [],
        };
    }
    subscribe(connection, onEvent) {
        const listeners = this.#listeners.get(connection) ?? new Set();
        listeners.add(onEvent);
        this.#listeners.set(connection, listeners);
        return () => {
            listeners.delete(onEvent);
        };
    }
    emit(connection, event) {
        for (const listener of this.#listeners.get(connection) ?? []) {
            listener(event);
        }
    }
}
//# sourceMappingURL=noop-provider.js.map