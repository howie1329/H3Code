import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { piExtensionUiResponseToProvider, providerUiToPiRequest, sessionSummaryToPiSessionSummary, snapshotToPiSessionState, } from "./agent-adapters.js";
describe("agent-adapters", () => {
    it("maps session summaries for the sidebar", () => {
        const summary = sessionSummaryToPiSessionSummary({
            providerId: "pi",
            sessionRef: "/tmp/repo/.pi/sessions/demo.jsonl",
            status: "idle",
            title: "Demo",
            preview: "Hello",
            repoPath: "/tmp/repo",
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_100_000,
            messageCount: 3,
        });
        assert.equal(summary.path, "/tmp/repo/.pi/sessions/demo.jsonl");
        assert.equal(summary.id, "demo");
        assert.equal(summary.firstMessage, "Hello");
        assert.equal(summary.messageCount, 3);
    });
    it("maps snapshots into Pi session state", () => {
        const state = snapshotToPiSessionState({
            summary: {
                providerId: "pi",
                sessionRef: "/tmp/repo/.pi/sessions/demo.jsonl",
                status: "idle",
            },
            cwd: "/tmp/repo",
            messages: [{ role: "user" }],
            isStreaming: true,
            isCompacting: false,
            steering: [],
            followUp: [],
            activeTools: [],
            tools: [],
            diagnostics: [],
            thinkingLevel: "low",
        });
        assert.equal(state.sessionFile, "/tmp/repo/.pi/sessions/demo.jsonl");
        assert.equal(state.isStreaming, true);
        assert.equal(state.thinkingLevel, "low");
        assert.equal(state.messageCount, 1);
    });
    it("preserves extension UI response kinds", () => {
        assert.deepEqual(piExtensionUiResponseToProvider({
            type: "extension_ui_response",
            id: "select-1",
            method: "select",
            value: "Allow",
        }), { requestId: "select-1", kind: "select", value: "Allow" });
        assert.deepEqual(piExtensionUiResponseToProvider({
            type: "extension_ui_response",
            id: "editor-1",
            method: "editor",
            value: "Updated text",
        }), { requestId: "editor-1", kind: "editor", value: "Updated text" });
        assert.deepEqual(piExtensionUiResponseToProvider({
            type: "extension_ui_response",
            id: "input-1",
            method: "input",
            cancelled: true,
        }), { requestId: "input-1", kind: "input", canceled: true });
    });
    it("round-trips custom extension UI requests and responses", () => {
        const request = providerUiToPiRequest("agent-1", {
            id: "custom-1",
            kind: "custom",
            componentId: "rpiv:ask-user:prompt",
            payload: { questions: [{ question: "Go?", header: "Plan", options: [] }] },
            overlay: { anchor: "bottom-center", width: "100%" },
        });
        assert.deepEqual(request, {
            type: "extension_ui_request",
            id: "custom-1",
            agentId: "agent-1",
            method: "custom",
            componentId: "rpiv:ask-user:prompt",
            payload: { questions: [{ question: "Go?", header: "Plan", options: [] }] },
            overlay: { anchor: "bottom-center", width: "100%" },
        });
        assert.deepEqual(piExtensionUiResponseToProvider({
            type: "extension_ui_response",
            id: "custom-1",
            method: "custom",
            value: { answers: [], cancelled: false },
        }), { requestId: "custom-1", kind: "custom", value: { answers: [], cancelled: false } });
        assert.deepEqual(piExtensionUiResponseToProvider({
            type: "extension_ui_response",
            id: "custom-1",
            method: "custom",
            cancelled: true,
        }), { requestId: "custom-1", kind: "custom", canceled: true });
    });
});
//# sourceMappingURL=agent-adapters.test.js.map