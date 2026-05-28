const uiCapabilities = {
    sessions: {
        list: false,
        create: false,
        switch: false,
        snapshot: true,
        fork: false,
        import: false,
    },
    runs: { stream: false, abort: false, steer: false, followUp: false, retry: false },
    ui: { model: false, thinkingLevel: false, extensionUi: true, compaction: false },
    workspace: { localCwd: true },
};
export class FakeUiProvider {
    id = "fake-ui";
    capabilities = uiCapabilities;
    #listeners = new WeakMap();
    async connect(ctx) {
        return { providerId: this.id, sessionRef: ctx.sessionRef ?? "fake-ui-session" };
    }
    async disconnect(connection) {
        this.#listeners.delete(connection);
    }
    async abort(_connection) { }
    async sendMessage(connection) {
        this.emit(connection, {
            type: "extension.ui.request",
            request: {
                id: "ui-test-1",
                kind: "input",
                title: "Test",
                message: "Enter value",
            },
            occurredAt: Date.now(),
        });
    }
    subscribe(connection, onEvent) {
        const listeners = this.#listeners.get(connection) ?? new Set();
        listeners.add(onEvent);
        this.#listeners.set(connection, listeners);
        return () => listeners.delete(onEvent);
    }
    emit(connection, event) {
        for (const listener of this.#listeners.get(connection) ?? []) {
            listener(event);
        }
    }
}
//# sourceMappingURL=fake-ui-provider.js.map