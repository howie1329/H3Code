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
  const record = toRecord(message);
  const rawId = record.id ?? record.messageId ?? record.uuid;

  if (typeof rawId === "string" || typeof rawId === "number") {
    return String(rawId);
  }

  return fallback;
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
