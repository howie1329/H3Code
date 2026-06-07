export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function getString(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

export function nowMs(): number {
  return Date.now();
}

export function messageIdentity(message: unknown, fallback: string): string {
  return explicitMessageIdentity(message) ?? fallback;
}

export function explicitMessageIdentity(message: unknown): string | undefined {
  const record = toRecord(message);
  const rawId = record.id ?? record.messageId ?? record.uuid;

  if (typeof rawId === "string" || typeof rawId === "number") {
    return String(rawId);
  }

  return undefined;
}

export function messageContentSignature(message: unknown): string | undefined {
  const record = toRecord(message);
  const role = record.role;
  const text = extractMessageText(record);

  if ((typeof role !== "string" && typeof role !== "number") || !text.trim()) {
    return undefined;
  }

  return `${String(role)}:${text}`;
}

function extractMessageText(record: Record<string, unknown>): string {
  const direct = record.text ?? record.content;

  if (typeof direct === "string") {
    return direct;
  }

  if (Array.isArray(direct)) {
    return direct
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        const partRecord = toRecord(part);
        return typeof partRecord.text === "string" ? partRecord.text : "";
      })
      .join("\n");
  }

  return "";
}

export function cloneValue(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return [...value];
  }

  return { ...(value as Record<string, unknown>) };
}
