export function groupBlocksForRender(blocks) {
    const grouped = [];
    let pendingThinking = [];
    let pendingTools = [];
    function flushWork() {
        if (pendingThinking.length === 0 && pendingTools.length === 0) {
            return;
        }
        const anchor = pendingThinking[0] ?? pendingTools[0];
        grouped.push({
            kind: "work",
            id: `work-${anchor.id}`,
            thinking: pendingThinking,
            tools: pendingTools,
        });
        pendingThinking = [];
        pendingTools = [];
    }
    for (const block of blocks) {
        if (block.kind === "thinking") {
            pendingThinking.push(block);
            continue;
        }
        if (block.kind === "tool") {
            pendingTools.push(block);
            continue;
        }
        flushWork();
        if (block.kind === "metadata") {
            continue;
        }
        grouped.push(block);
    }
    flushWork();
    return grouped;
}
export function extractStreamingThinkingText(message) {
    const record = message && typeof message === "object" ? message : {};
    if (!Array.isArray(record.content)) {
        return "";
    }
    return record.content
        .map((part) => {
        const partRecord = part && typeof part === "object" ? part : {};
        if (partRecord.type === "thinking" && typeof partRecord.thinking === "string") {
            return partRecord.thinking;
        }
        return "";
    })
        .filter(Boolean)
        .join("\n\n");
}
//# sourceMappingURL=transcript-render.js.map