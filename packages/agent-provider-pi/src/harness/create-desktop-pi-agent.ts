import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createPi, type PiAuthOptions } from "@ai-sdk/harness-pi";
import { createJustBashSandbox } from "@ai-sdk/sandbox-just-bash";
import { OverlayFs, Sandbox } from "just-bash";

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
  const overlay = new OverlayFs({ root: options.repoPath });
  const sandboxMountPoint = overlay.getMountPoint();
  const justBashInstance = await Sandbox.create({
    fs: overlay,
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
      // from the overlay root where the real repo files are readable.
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
