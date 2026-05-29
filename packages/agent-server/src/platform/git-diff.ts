import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { WorkspaceDiffSummary } from "@h3code/agent-core";

const maxDiffBytes = 2_000_000;

export async function getWorkspaceDiff(cwd: string): Promise<WorkspaceDiffSummary> {
  if (!existsSync(cwd)) {
    return emptyDiff();
  }

  const repoCheck = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);

  if (repoCheck.status !== 0 || repoCheck.stdout.trim() !== "true") {
    return emptyDiff();
  }

  const trackedDiff = await runGit(["diff", "HEAD", "--no-ext-diff", "--no-color", "--binary"], cwd);
  const untrackedFiles = await getUntrackedFiles(cwd);
  const patches: string[] = trackedDiff.stdout ? [trackedDiff.stdout] : [];
  let patchBytes = trackedDiff.stdout.length;

  for (const file of untrackedFiles) {
    const fileDiff = await getUntrackedFileDiff(cwd, file);

    if (fileDiff) {
      patches.push(fileDiff);
      patchBytes += fileDiff.length;
    }

    if (patchBytes > maxDiffBytes) {
      throw new Error("Git diff is too large to display.");
    }
  }

  const patch = patches.join("\n");

  return {
    files: [],
    updatedAt: Date.now(),
    patch,
    changedFiles: countChangedFiles(patch),
  };
}

function emptyDiff(): WorkspaceDiffSummary {
  return {
    files: [],
    updatedAt: Date.now(),
    patch: "",
    changedFiles: 0,
  };
}

async function getUntrackedFiles(repoPath: string) {
  const result = await runGit(["ls-files", "--others", "--exclude-standard", "-z"], repoPath);

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout.split("\0").filter(Boolean);
}

async function getUntrackedFileDiff(repoPath: string, filePath: string) {
  const result = await runGit(["diff", "--no-ext-diff", "--no-color", "--no-index", "--binary", "--", "/dev/null", filePath], repoPath);

  return result.stdout;
}

function countChangedFiles(patch: string) {
  const gitDiffHeaders = patch.split("\n").filter((line) => line.startsWith("diff --git ")).length;

  if (gitDiffHeaders > 0) {
    return gitDiffHeaders;
  }

  return patch.split("\n").filter((line) => line.startsWith("diff ")).length;
}

function runGit(args: string[], cwd: string) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;

      if (stdout.length > maxDiffBytes) {
        settled = true;
        child.kill();
        reject(new Error("Git diff is too large to display."));
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.on("close", (status) => {
      if (!settled) {
        settled = true;
        resolve({ status, stdout, stderr });
      }
    });
  });
}
