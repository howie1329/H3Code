import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createPi, type PiAuthOptions } from "@ai-sdk/harness-pi";
import { createJustBashSandbox } from "@ai-sdk/sandbox-just-bash";
import { ReadWriteFs, Sandbox } from "just-bash";
import path from "node:path";

export type CreateDesktopPiAgentOptions = {
  repoPath: string;
  model?: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  auth?: PiAuthOptions;
  instructions?: string;
};

export async function createDesktopPiAgent(
  options: CreateDesktopPiAgentOptions,
): Promise<HarnessAgent> {
  const repoPath = path.resolve(options.repoPath);
  const workspaceFs = new ReadWriteFs({ root: repoPath });
  const sandboxMountPoint = "/";
  const justBashInstance = await Sandbox.create({
    fs: workspaceFs,
    cwd: sandboxMountPoint,
  });

  return new HarnessAgent({
    harness: createPi({
      model: options.model,
      thinkingLevel: options.thinkingLevel ?? "medium",
      auth: options.auth,
    }),
    sandbox: createJustBashSandbox({ sandbox: justBashInstance }),
    permissionMode: "allow-edits",
    instructions:
      options.instructions ??
      "You are a careful coding assistant working in a local repository.",
    onSandboxSession: async ({ session, sessionWorkDir, abortSignal }) => {
      if (sessionWorkDir === sandboxMountPoint) {
        return;
      }

      // Harness creates an empty `${mount}/pi-<sessionId>` workspace. Seed it
      // from the repo root so Pi tools see package.json and siblings.
      const skipDir = sessionWorkDir.slice(sessionWorkDir.lastIndexOf("/") + 1);
      await session.run({
        command: [
          `sh -c 'set -e;`,
          `src=${JSON.stringify(sandboxMountPoint)};`,
          `dst=${JSON.stringify(sessionWorkDir)};`,
          `skip=${JSON.stringify(skipDir)};`,
          `cd "$src";`,
          `for entry in * .[!.]* ..?*; do`,
          `  [ -e "$entry" ] || continue;`,
          `  [ "$entry" = "$skip" ] && continue;`,
          `  cp -R "$entry" "$dst/";`,
          `done'`,
        ].join(" "),
        abortSignal,
      });
    },
  });
}
