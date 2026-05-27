export interface WorkspaceDiffFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  additions?: number;
  deletions?: number;
}

export interface WorkspaceDiffSummary {
  files: WorkspaceDiffFile[];
  summary?: string;
  updatedAt: number;
}
