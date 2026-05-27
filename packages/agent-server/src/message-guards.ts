import type { ClientToServerMessage } from "@h3code/agent-core";
import { AgentServerError } from "./errors.js";

const commandTypes = new Set([
  "workspace.connect",
  "workspace.disconnect",
  "session.list",
  "session.create",
  "session.switch",
  "session.snapshot",
  "message.send",
  "run.abort",
  "provider.ui.respond",
]);

export function parseClientMessage(data: Buffer | ArrayBuffer | Buffer[]): ClientToServerMessage {
  let value: unknown;

  try {
    value = JSON.parse(data.toString());
  } catch {
    throw new AgentServerError("invalid_json", "Message must be valid JSON.");
  }

  if (!isRecord(value)) {
    throw new AgentServerError("invalid_message", "Message must be a JSON object.");
  }

  if (typeof value.type !== "string" || !commandTypes.has(value.type)) {
    throw new AgentServerError("unknown_command", "Message has an unknown command type.");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new AgentServerError("invalid_message", "Client command must include a string id.");
  }

  return value as ClientToServerMessage;
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AgentServerError("invalid_message", `${field} must be a non-empty string.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
