export function parseMetadataText(text) {
    const entries = [];
    const lines = text.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        const boldMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
        if (boldMatch) {
            entries.push({ label: boldMatch[1].trim(), value: boldMatch[2].trim() });
            continue;
        }
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > 0 && colonIndex < 40) {
            entries.push({
                label: trimmed.slice(0, colonIndex).trim(),
                value: trimmed.slice(colonIndex + 1).trim(),
            });
            continue;
        }
        const listMatch = trimmed.match(/^[-*]\s+(\S+)\s+(.+)$/);
        if (listMatch) {
            entries.push({ label: listMatch[1].trim(), value: listMatch[2].trim() });
        }
    }
    return entries;
}
export function isMetadataRole(role) {
    const normalized = role.toLowerCase();
    return normalized === "custom" || normalized === "metadata" || normalized.includes("context");
}
//# sourceMappingURL=transcript-metadata.js.map