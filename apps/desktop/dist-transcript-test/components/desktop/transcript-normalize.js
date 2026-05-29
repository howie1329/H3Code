import { formatMessageRole, formatMessageText } from "$lib/message-format.js";
import { isMetadataRole, parseMetadataText, } from "$lib/components/desktop/transcript-metadata.js";
const messageRoles = new Set(["user", "assistant", "system", "function", "data", "tool"]);
export function buildTranscriptViewModel(messages) {
    const sessionMetadata = extractSessionMetadata(messages);
    const rawMessages = buildTranscriptMessages(messages);
    const mergedMessages = mergeConsecutiveAssistantActivity(rawMessages);
    return {
        messages: mergedMessages.filter((message) => !isMetadataOnlyMessage(message)),
        sessionMetadata,
    };
}
export function extractSessionMetadata(messages) {
    for (const [index, message] of messages.entries()) {
        const record = toRecord(message);
        const roleLabel = formatMessageRole(message);
        if (!isMetadataRole(roleLabel)) {
            continue;
        }
        const text = formatMessageText(message);
        if (!text.trim()) {
            continue;
        }
        const entries = parseMetadataText(text);
        if (entries.length > 0) {
            return entries;
        }
        const blocks = normalizeMessageBlocks(record, index, new Map());
        for (const block of blocks) {
            if (block.kind === "metadata" && block.entries.length > 0) {
                return block.entries;
            }
        }
    }
    return [];
}
function buildTranscriptMessages(messages) {
    const normalizedMessages = [];
    const pendingTools = new Map();
    for (const [index, message] of messages.entries()) {
        const record = toRecord(message);
        if (isToolResultMessage(record)) {
            const toolResult = normalizeToolResult(record, index);
            const pendingTool = pendingTools.get(toolResult.toolCallId);
            if (pendingTool) {
                pendingTool.state = toolResult.state;
                pendingTool.output = toolResult.output;
                pendingTool.errorText = toolResult.errorText;
                continue;
            }
            const attached = attachOrphanToolResult(normalizedMessages, toolResult);
            if (!attached) {
                normalizedMessages.push({
                    id: `tool-result-${toolResult.toolCallId}-${index}`,
                    role: "assistant",
                    roleLabel: "Assistant",
                    blocks: [toolResult],
                });
            }
            continue;
        }
        const normalizedMessage = normalizeTranscriptMessage(message, index, pendingTools);
        if (normalizedMessage.blocks.length > 0) {
            normalizedMessages.push(normalizedMessage);
        }
    }
    return normalizedMessages;
}
function attachOrphanToolResult(messages, toolResult) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role === "user" || message.role === "tool") {
            continue;
        }
        message.blocks.push(toolResult);
        return true;
    }
    return false;
}
function mergeConsecutiveAssistantActivity(messages) {
    if (messages.length === 0) {
        return messages;
    }
    const merged = [];
    for (const message of messages) {
        const previous = merged.at(-1);
        if (previous && canMergeAssistantActivity(previous, message)) {
            previous.blocks.push(...message.blocks);
            continue;
        }
        merged.push({
            ...message,
            blocks: [...message.blocks],
        });
    }
    return merged;
}
function canMergeAssistantActivity(previous, next) {
    if (previous.role !== "assistant" || next.role !== "assistant") {
        return false;
    }
    return isActivityOnlyBlocks(previous.blocks) && isActivityOnlyBlocks(next.blocks);
}
function isActivityOnlyBlocks(blocks) {
    return blocks.length > 0 && blocks.every((block) => block.kind === "tool" || block.kind === "thinking");
}
function isMetadataOnlyMessage(message) {
    return message.blocks.length > 0 && message.blocks.every((block) => block.kind === "metadata");
}
function normalizeTranscriptMessage(message, index, pendingTools) {
    const record = toRecord(message);
    const rawId = record.id ?? record.messageId ?? record.uuid;
    const roleLabel = formatMessageRole(message);
    const blocks = normalizeMessageBlocks(record, index, pendingTools);
    if (blocks.length === 0) {
        const text = formatMessageText(message);
        if (text.trim()) {
            if (isMetadataRole(roleLabel)) {
                blocks.push({
                    kind: "metadata",
                    id: `message-${index}-metadata`,
                    title: formatRoleLabel(roleLabel),
                    entries: parseMetadataText(text),
                });
            }
            else {
                blocks.push({
                    kind: "text",
                    id: `message-${index}-text`,
                    text,
                });
            }
        }
    }
    return {
        id: typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : `message-${index}`,
        role: normalizeMessageRole(roleLabel),
        roleLabel: formatRoleLabel(roleLabel),
        blocks,
    };
}
function normalizeMessageBlocks(record, messageIndex, pendingTools) {
    if (!Array.isArray(record.content)) {
        return [];
    }
    const blocks = [];
    for (const [partIndex, part] of record.content.entries()) {
        const partRecord = toRecord(part);
        const partType = typeof partRecord.type === "string" ? partRecord.type : undefined;
        if (partType === "text" && typeof partRecord.text === "string" && partRecord.text.trim()) {
            blocks.push({
                kind: "text",
                id: `message-${messageIndex}-text-${partIndex}`,
                text: partRecord.text,
            });
            continue;
        }
        if (partType === "thinking" && typeof partRecord.thinking === "string" && partRecord.thinking.trim()) {
            blocks.push({
                kind: "thinking",
                id: `message-${messageIndex}-thinking-${partIndex}`,
                text: partRecord.thinking,
            });
            continue;
        }
        if (partType === "toolCall") {
            const toolCallId = getString(partRecord.id) ?? `message-${messageIndex}-tool-${partIndex}`;
            const toolBlock = {
                kind: "tool",
                id: `tool-call-${toolCallId}`,
                toolCallId,
                type: getString(partRecord.name) ?? "tool",
                state: "input-available",
                input: partRecord.arguments,
            };
            pendingTools.set(toolCallId, toolBlock);
            blocks.push(toolBlock);
        }
    }
    return blocks;
}
function isToolResultMessage(record) {
    return record.role === "toolResult" || record.role === "toolExecution";
}
function normalizeToolResult(record, index) {
    const toolCallId = getString(record.toolCallId) ?? `tool-result-${index}`;
    const outputText = extractTextContent(record.content);
    const isError = record.isError === true;
    const state = normalizeToolState(record.state, isError);
    return {
        kind: "tool",
        id: `tool-result-${toolCallId}`,
        toolCallId,
        type: getString(record.toolName) ?? "tool",
        state,
        input: record.args,
        output: isError ? undefined : outputText,
        errorText: isError ? outputText || "Tool execution failed." : undefined,
    };
}
function normalizeToolState(value, isError) {
    if (value === "input-streaming" || value === "input-available" || value === "output-available" || value === "output-error") {
        return value;
    }
    return isError ? "output-error" : "output-available";
}
function extractTextContent(content) {
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .map((part) => {
            const partRecord = toRecord(part);
            return typeof partRecord.text === "string" ? partRecord.text : "";
        })
            .filter(Boolean)
            .join("\n");
    }
    if (content === undefined || content === null) {
        return "";
    }
    return JSON.stringify(content, null, 2);
}
function normalizeMessageRole(role) {
    const normalizedRole = role.toLowerCase();
    if (messageRoles.has(normalizedRole)) {
        return normalizedRole;
    }
    if (normalizedRole.includes("user")) {
        return "user";
    }
    if (normalizedRole.includes("tool")) {
        return "tool";
    }
    if (normalizedRole.includes("system")) {
        return "system";
    }
    if (normalizedRole.includes("data")) {
        return "data";
    }
    if (normalizedRole.includes("function")) {
        return "function";
    }
    return "assistant";
}
function formatRoleLabel(role) {
    return role
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
function getString(value) {
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}
function toRecord(value) {
    return value && typeof value === "object" ? value : {};
}
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
    const record = toRecord(message);
    if (!Array.isArray(record.content)) {
        return "";
    }
    return record.content
        .map((part) => {
        const partRecord = toRecord(part);
        if (partRecord.type === "thinking" && typeof partRecord.thinking === "string") {
            return partRecord.thinking;
        }
        return "";
    })
        .filter(Boolean)
        .join("\n\n");
}
export function formatToolValue(value) {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
//# sourceMappingURL=transcript-normalize.js.map