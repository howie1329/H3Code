export function mapPiSessionEvent(raw, occurredAt = Date.now()) {
    const event = toRecord(raw);
    const type = getString(event.type);
    if (!type) {
        return [];
    }
    switch (type) {
        case "agent_start":
            return [{ type: "run.started", occurredAt }];
        case "agent_end":
            return [
                {
                    type: "run.ended",
                    messages: Array.isArray(event.messages) ? event.messages : undefined,
                    willRetry: booleanOrUndefined(event.willRetry),
                    occurredAt,
                },
            ];
        case "turn_start":
            return [{ type: "turn.started", occurredAt }];
        case "turn_end":
            return [
                {
                    type: "turn.completed",
                    message: event.message,
                    toolResults: Array.isArray(event.toolResults) ? event.toolResults : undefined,
                    occurredAt,
                },
            ];
        case "message_start":
            return [{ type: "message.streaming", phase: "start", message: event.message, occurredAt }];
        case "message_update": {
            const assistantEvent = toRecord(event.assistantMessageEvent);
            return [
                {
                    type: "message.streaming",
                    phase: "update",
                    message: event.message ?? assistantEvent.partial ?? assistantEvent.message ?? assistantEvent.error,
                    deltaType: getString(assistantEvent.type),
                    errorMessage: assistantEvent.type === "error" ? formatUnknownError(assistantEvent.error) : undefined,
                    occurredAt,
                },
            ];
        }
        case "message_end":
            return [{ type: "message.streaming", phase: "end", message: event.message, occurredAt }];
        case "tool_execution_start":
            return [toolEvent(event, "start", occurredAt)];
        case "tool_execution_update":
            return [toolEvent(event, "update", occurredAt)];
        case "tool_execution_end":
            return [toolEvent(event, "end", occurredAt)];
        case "queue_update":
            return [
                {
                    type: "queue.updated",
                    steering: stringArray(event.steering),
                    followUp: stringArray(event.followUp),
                    occurredAt,
                },
            ];
        case "compaction_start":
            return [
                {
                    type: "compaction.updated",
                    phase: "start",
                    reason: getString(event.reason),
                    occurredAt,
                },
            ];
        case "compaction_end":
            return [
                {
                    type: "compaction.updated",
                    phase: "end",
                    reason: getString(event.reason),
                    aborted: booleanOrUndefined(event.aborted),
                    willRetry: booleanOrUndefined(event.willRetry),
                    errorMessage: getString(event.errorMessage),
                    result: event.result,
                    occurredAt,
                },
            ];
        case "auto_retry_start":
            return [
                {
                    type: "retry.updated",
                    phase: "start",
                    attempt: numberOrUndefined(event.attempt),
                    maxAttempts: numberOrUndefined(event.maxAttempts),
                    delayMs: numberOrUndefined(event.delayMs),
                    errorMessage: getString(event.errorMessage),
                    occurredAt,
                },
            ];
        case "auto_retry_end":
            return [
                {
                    type: "retry.updated",
                    phase: "end",
                    attempt: numberOrUndefined(event.attempt),
                    success: booleanOrUndefined(event.success),
                    errorMessage: getString(event.finalError) ?? getString(event.errorMessage),
                    occurredAt,
                },
            ];
        case "session_info_changed":
            return [
                {
                    type: "provider.diagnostic",
                    level: "info",
                    message: event.name ? `Session renamed to ${String(event.name)}.` : "Session name cleared.",
                    detail: event,
                    occurredAt,
                },
            ];
        case "thinking_level_changed":
            return [
                {
                    type: "provider.diagnostic",
                    level: "info",
                    message: `Thinking level changed to ${String(event.level)}.`,
                    detail: event,
                    occurredAt,
                },
            ];
        case "extension_error":
            return [
                {
                    type: "extension.error",
                    message: formatExtensionError(event),
                    extensionPath: getString(event.extensionPath),
                    event: getString(event.event),
                    occurredAt,
                },
            ];
        default:
            return [];
    }
}
function toolEvent(event, phase, occurredAt) {
    const partialResult = toRecord(event.partialResult);
    const result = toRecord(event.result);
    const errorText = getString(event.errorText) ?? getString(result.errorText) ?? getString(result.errorMessage);
    const content = phase === "update" ? partialResult.content : phase === "end" ? result.content : undefined;
    return {
        type: "tool.updated",
        phase,
        toolCallId: getString(event.toolCallId) ?? `tool-${occurredAt}`,
        toolName: getString(event.toolName) ?? "tool",
        args: event.args,
        content: errorText ? [{ type: "text", text: errorText }] : content,
        isError: event.isError === true || (phase === "end" && result.isError === true),
        errorText,
        occurredAt,
    };
}
function formatExtensionError(event) {
    const error = toRecord(event.error);
    return getString(error.message) ?? getString(event.message) ?? "Extension error";
}
function formatUnknownError(value) {
    if (value instanceof Error) {
        return value.message;
    }
    const record = toRecord(value);
    return getString(record.message) ?? getString(record.error) ?? (value === undefined ? undefined : String(value));
}
function stringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function getString(value) {
    return typeof value === "string" ? value : undefined;
}
function numberOrUndefined(value) {
    return typeof value === "number" ? value : undefined;
}
function booleanOrUndefined(value) {
    return typeof value === "boolean" ? value : undefined;
}
function toRecord(value) {
    return typeof value === "object" && value !== null ? value : {};
}
//# sourceMappingURL=event-mapper.js.map