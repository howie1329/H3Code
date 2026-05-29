const metadataCapabilities = {
    sessions: {
        list: false,
        create: false,
        switch: false,
        snapshot: true,
        fork: false,
        import: false,
    },
    runs: { stream: false, abort: false, steer: false, followUp: false, retry: false },
    ui: {
        model: false,
        thinkingLevel: false,
        extensionUi: false,
        compaction: true,
        commands: true,
        modelsList: true,
        queueSettings: true,
    },
    workspace: { localCwd: true },
};
const sampleCommands = [{ name: "help", description: "Help", source: "extension" }];
const sampleModels = [{ id: "gpt-test", provider: "openai", name: "Test" }];
export class FakeMetadataProvider {
    id = "fake-metadata";
    capabilities = metadataCapabilities;
    steeringMode = "one-at-a-time";
    followUpMode = "one-at-a-time";
    autoCompactionEnabled = true;
    async connect(ctx) {
        return { providerId: this.id, sessionRef: ctx.sessionRef ?? "fake-metadata-session" };
    }
    async disconnect(_connection) { }
    async abort(_connection) { }
    async sendMessage(_connection) { }
    subscribe(_connection, _onEvent) {
        return () => { };
    }
    async getSnapshot(connection) {
        return {
            summary: {
                providerId: this.id,
                sessionRef: connection.sessionRef ?? "fake-metadata-session",
                status: "idle",
                title: "Metadata test session",
            },
            cwd: "",
            messages: [],
            isStreaming: false,
            isCompacting: false,
            steering: [],
            followUp: [],
            steeringMode: this.steeringMode,
            followUpMode: this.followUpMode,
            autoCompactionEnabled: this.autoCompactionEnabled,
            activeTools: [],
            tools: [],
            diagnostics: [],
        };
    }
    async listCommands() {
        return sampleCommands;
    }
    async listModels() {
        return sampleModels;
    }
    async setSteeringMode(_connection, mode) {
        this.steeringMode = mode;
    }
    async setFollowUpMode(_connection, mode) {
        this.followUpMode = mode;
    }
    async setAutoCompaction(_connection, enabled) {
        this.autoCompactionEnabled = enabled;
    }
}
//# sourceMappingURL=fake-metadata-provider.js.map