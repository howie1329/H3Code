const noopCapabilities = {
    sessions: {
        list: false,
        create: false,
        switch: false,
        snapshot: true,
        rename: false,
    },
    runs: {
        stream: true,
        abort: true,
        steer: false,
        followUp: false,
        retry: false,
    },
    ui: {
        modelPicker: false,
        slashCommands: false,
        providerPrompts: false,
        approvals: false,
        compaction: false,
    },
    workspace: {
        localCwd: true,
        gitDiff: false,
        worktrees: false,
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
        const runRef = `noop-run-${now}`;
        const messageId = `noop-message-${now}`;
        this.emit(connection, { type: "run.started", run: { runRef, status: "running", startedAt: now }, occurredAt: now });
        this.emit(connection, {
            type: "message.added",
            message: {
                id: messageId,
                role: "assistant",
                content: `Noop provider received ${input.mode}: ${input.text}`,
                createdAt: now,
            },
            occurredAt: now,
        });
        this.emit(connection, {
            type: "run.completed",
            runRef,
            status: "completed",
            occurredAt: Date.now(),
        });
    }
    async abort(connection) {
        this.emit(connection, {
            type: "provider.notice",
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
            messages: [],
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