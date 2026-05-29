export function createEmptySessionReadModel() {
    return {
        messages: [],
        streamingMessage: null,
        tools: {},
        queue: { steering: [], followUp: [] },
        phase: "idle",
        latestTurn: { state: "idle", startedAt: null },
        isAgentRunning: false,
        isCompacting: false,
        retry: null,
        statusEntries: {},
        widgets: {},
        windowTitle: undefined,
        extensionError: undefined,
        streamingError: undefined,
        activities: [],
        notifications: [],
        needsDiffRefresh: false,
        needsRunHousekeeping: false,
    };
}
//# sourceMappingURL=read-model.js.map