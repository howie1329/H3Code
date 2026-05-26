const MAX_TITLE_LENGTH = 48;

export function getSessionDisplayTitle(session: PiSessionSummary): string {
  const name = session.name?.trim();
  if (name) {
    return name;
  }

  const fromFirst = sanitizeFirstMessage(session.firstMessage);
  if (fromFirst) {
    return fromFirst;
  }

  return "Untitled session";
}

export function formatSessionModified(modified: string): string {
  const date = new Date(modified);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function sanitizeFirstMessage(raw: string): string {
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
