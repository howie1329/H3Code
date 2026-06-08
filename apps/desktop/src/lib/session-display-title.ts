import type { SessionSummary } from "@h3code/agent-core";

const MAX_TITLE_LENGTH = 48;

export function getSessionDisplayTitle(session: SessionSummary): string {
  const title = session.title?.trim();
  if (title) {
    return capitalizeFirstLetter(title);
  }

  const fromPreview = sanitizePreview(session.preview ?? "");
  if (fromPreview) {
    return capitalizeFirstLetter(fromPreview);
  }

  return "Untitled session";
}

function capitalizeFirstLetter(value: string): string {
  if (!value) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}

function sanitizePreview(raw: string): string {
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return "";
  }

  if (text.length <= MAX_TITLE_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}
