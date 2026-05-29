export function toRecord(value) {
    return value && typeof value === "object" ? value : {};
}
export function formatMessageRole(message) {
    const record = toRecord(message);
    const role = record.role ?? record.type;
    return typeof role === "string" ? role : "message";
}
export function formatMessageText(message) {
    const record = toRecord(message);
    const content = record.content ?? record.text ?? record.message;
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
    return JSON.stringify(message, null, 2);
}
//# sourceMappingURL=message-format.js.map