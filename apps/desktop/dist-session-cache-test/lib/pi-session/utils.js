export function toRecord(value) {
    return value && typeof value === "object" ? value : {};
}
export function getString(value) {
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}
export function nowMs() {
    return Date.now();
}
export function messageIdentity(message, fallback) {
    const record = toRecord(message);
    const rawId = record.id ?? record.messageId ?? record.uuid;
    if (typeof rawId === "string" || typeof rawId === "number") {
        return String(rawId);
    }
    return fallback;
}
export function cloneValue(value) {
    if (!value || typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        return [...value];
    }
    return { ...value };
}
//# sourceMappingURL=utils.js.map