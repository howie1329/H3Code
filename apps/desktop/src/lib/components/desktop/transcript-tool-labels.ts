function truncate(value: string, max = 48) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1)}…`;
}

function basename(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getStringField(record: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function getTranscriptToolLabel(type: string, input?: unknown): string {
  const normalizedType = type.toLowerCase();
  const record = getRecord(input);
  const path =
    getStringField(record, "path", "file", "filePath", "filepath") ??
    getStringField(getRecord(record?.arguments), "path", "file", "filePath");
  const command = getStringField(record, "command", "cmd");
  const query = getStringField(record, "query", "pattern");

  switch (normalizedType) {
    case "read":
      return path ? `Read ${truncate(basename(path))}` : "Read file";
    case "write":
    case "edit":
      return path ? `Edited ${truncate(basename(path))}` : "Edited file";
    case "bash":
    case "shell":
      return command ? `Ran ${truncate(command, 40)}` : "Ran command";
    case "grep":
      return query ? `Searched for ${truncate(query, 32)}` : "Searched codebase";
    case "glob":
      return query ? `Found files matching ${truncate(query, 32)}` : "Found files";
    case "todo":
      return "Updated task list";
    case "list":
      return path ? `Listed ${truncate(basename(path))}` : "Listed directory";
    default:
      return type.replace(/[_-]/g, " ");
  }
}

export function summarizeWork(thinkingCount: number, tools: { state: string }[]) {
  const toolSummary = summarizeActivity(tools);

  if (thinkingCount === 0) {
    return toolSummary;
  }

  if (tools.length === 0) {
    return thinkingCount === 1 ? "Reasoning" : `${thinkingCount} reasoning notes`;
  }

  return `${toolSummary} · reasoning`;
}

export function summarizeActivity(tools: { state: string }[]) {
  const total = tools.length;
  const errors = tools.filter((tool) => tool.state === "output-error").length;
  const running = tools.filter((tool) => tool.state === "input-available" || tool.state === "input-streaming").length;

  if (total === 0) {
    return "No steps";
  }

  const parts = [`${total} step${total === 1 ? "" : "s"}`];

  if (running > 0) {
    parts.push(`${running} running`);
  }

  if (errors > 0) {
    parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  }

  return parts.join(" · ");
}
