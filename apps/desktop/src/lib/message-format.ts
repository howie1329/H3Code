export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function formatMessageRole(message: unknown) {
  const record = toRecord(message);
  const role = record.role ?? record.type;
  return typeof role === "string" ? role : "message";
}

export function formatMessageText(message: unknown): string {
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
