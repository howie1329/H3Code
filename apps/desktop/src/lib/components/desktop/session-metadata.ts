import type { MetadataEntry } from "$lib/components/desktop/transcript-metadata.js";

export function getMetadataValue(entries: MetadataEntry[], ...labels: string[]) {
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));

  for (const entry of entries) {
    if (normalizedLabels.has(entry.label.toLowerCase())) {
      return entry.value;
    }
  }

  return undefined;
}

export function formatGitContextChip(entries: MetadataEntry[]) {
  const branch = getMetadataValue(entries, "Branch", "branch");
  const commit = getMetadataValue(entries, "Commit", "commit");

  if (!branch && !commit) {
    return undefined;
  }

  const shortCommit = commit ? commit.slice(0, 7) : undefined;

  if (branch && shortCommit) {
    return `${branch} · ${shortCommit}`;
  }

  return branch ?? shortCommit;
}
