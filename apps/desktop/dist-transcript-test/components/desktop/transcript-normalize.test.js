import assert from "node:assert/strict";
import test from "node:test";
import { extractStreamingThinkingText, groupBlocksForRender, } from "./transcript-normalize.js";
test("groupBlocksForRender merges thinking and tools into one work block", () => {
    const blocks = [
        { kind: "thinking", id: "t1", text: "plan" },
        {
            kind: "tool",
            id: "tool-1",
            toolCallId: "tc1",
            type: "read",
            state: "output-available",
        },
    ];
    const grouped = groupBlocksForRender(blocks);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0]?.kind, "work");
    if (grouped[0]?.kind === "work") {
        assert.equal(grouped[0].thinking.length, 1);
        assert.equal(grouped[0].tools.length, 1);
    }
});
test("groupBlocksForRender splits work blocks around text", () => {
    const blocks = [
        { kind: "thinking", id: "t1", text: "first" },
        { kind: "text", id: "x1", text: "answer" },
        {
            kind: "tool",
            id: "tool-1",
            toolCallId: "tc1",
            type: "bash",
            state: "output-available",
        },
    ];
    const grouped = groupBlocksForRender(blocks);
    assert.equal(grouped.length, 3);
    assert.equal(grouped[0]?.kind, "work");
    assert.equal(grouped[1]?.kind, "text");
    assert.equal(grouped[2]?.kind, "work");
});
test("extractStreamingThinkingText reads thinking parts from message content", () => {
    const text = extractStreamingThinkingText({
        role: "assistant",
        content: [
            { type: "thinking", thinking: "step one" },
            { type: "thinking", thinking: "step two" },
            { type: "text", text: "visible" },
        ],
    });
    assert.equal(text, "step one\n\nstep two");
});
//# sourceMappingURL=transcript-normalize.test.js.map