import type { SessionSummary } from "$lib/session-types.js";

export function getSessionDisplayTitle(session: SessionSummary): string {
  const title = session.title?.trim();
  if (title) {
    return title;
  }

  const preview = session.preview?.trim();
  if (preview) {
    return preview.length > 48 ? `${preview.slice(0, 48)}…` : preview;
  }

  return session.sessionRef.split(/[/\\]/).pop()?.replace(/\.jsonl$/i, "") ?? "Untitled session";
}
