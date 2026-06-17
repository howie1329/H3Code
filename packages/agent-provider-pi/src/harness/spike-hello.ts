import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDesktopPiAgent } from "./create-desktop-pi-agent.js";
import { resolveSpikeConfig } from "./resolve-spike-config.js";

// Avoid Pi's `ls` builtin — harness-pi runs `ls -1Ap`, which just-bash does not support.
const defaultPrompt =
  "Read the repository root package.json and report the npm name field. Use the read tool, not ls.";

const resumeProbePath = ".h3-harness-spike-probe.txt";

type StreamSummary = {
  textDeltas: number;
  toolCalls: number;
  toolResults: number;
  toolParts: string[];
  dynamicTools: string[];
  errors: string[];
};

function resolveRepoPath(): string {
  const fromEnv = process.env.REPO_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  return path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
}

function formatStreamError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function consumeStream(
  stream: AsyncIterable<unknown>,
  label: string,
): Promise<StreamSummary> {
  const summary: StreamSummary = {
    textDeltas: 0,
    toolCalls: 0,
    toolResults: 0,
    toolParts: [],
    dynamicTools: [],
    errors: [],
  };

  console.log(`\n--- ${label}: stream parts ---`);

  for await (const part of stream) {
    const typed = part as {
      type?: string;
      text?: string;
      toolName?: string;
      error?: unknown;
    };
    const partType = typed.type ?? "unknown";

    if (partType === "text-delta" && typed.text) {
      summary.textDeltas += 1;
      process.stdout.write(typed.text);
      continue;
    }

    if (partType === "tool-call") {
      summary.toolCalls += 1;
      if (typed.toolName) {
        summary.toolParts.push(`tool-call:${typed.toolName}`);
      }
      console.log(`\n[${partType}]`, JSON.stringify(part, null, 2));
      continue;
    }

    if (partType === "tool-result") {
      summary.toolResults += 1;
      if (typed.toolName) {
        summary.toolParts.push(`tool-result:${typed.toolName}`);
      }
      console.log(`\n[${partType}]`, JSON.stringify(part, null, 2));
      continue;
    }

    if (partType.startsWith("tool-") || partType === "dynamic-tool") {
      if (partType === "dynamic-tool" && typed.toolName) {
        summary.dynamicTools.push(typed.toolName);
      } else if (partType.startsWith("tool-")) {
        summary.toolParts.push(partType);
      }
      console.log(`\n[${partType}]`, JSON.stringify(part, null, 2));
      continue;
    }

    if (partType === "error") {
      const message = formatStreamError(typed.error);
      summary.errors.push(message);
      console.log(`\n[error]`, message);
      continue;
    }

    if (partType !== "step-start" && partType !== "step-finish") {
      console.log(`\n[${partType}]`, JSON.stringify(part, null, 2));
    }
  }

  console.log(`\n--- ${label}: stream end ---`);
  return summary;
}

function isGatewayRateLimit(message: string): boolean {
  return /429|rate_limit|RateLimitExceeded/i.test(message);
}

function assertTurn1(summary: StreamSummary): "rate_limited" | "ok" {
  const hasToolActivity =
    summary.toolCalls > 0 ||
    summary.toolResults > 0 ||
    summary.toolParts.length > 0 ||
    summary.dynamicTools.length > 0;

  if (!hasToolActivity) {
    throw new Error("Turn 1 produced no tool activity.");
  }

  if (summary.textDeltas === 0 && summary.errors.length > 0) {
    if (summary.errors.every(isGatewayRateLimit)) {
      return "rate_limited";
    }

    throw new Error(`Turn 1 failed with stream errors:\n${summary.errors.join("\n")}`);
  }

  return "ok";
}

function assertFollowUpTurn(summary: StreamSummary) {
  if (summary.textDeltas === 0) {
    throw new Error("Follow-up turn produced no text-delta parts.");
  }
}

async function probeOverlayWriteBehavior(repoPath: string) {
  const diskProbePath = path.join(repoPath, resumeProbePath);

  try {
    await readFile(diskProbePath, "utf8");
    console.log(
      `\nOverlay probe: ${resumeProbePath} exists on disk (unexpected before agent write).`,
    );
  } catch {
    console.log(`\nOverlay probe: ${resumeProbePath} not on disk before agent turn (expected).`);
  }
}

async function maybeTestCrossSessionResume(options: {
  agent: Awaited<ReturnType<typeof createDesktopPiAgent>>;
  sessionId: string;
  resumeState: unknown;
  resumeStatePath: string;
}) {
  if (process.env.H3_SPIKE_TEST_RESUME !== "1") {
    console.log(
      "\nSkipping cross-session resume: just-bash-sandbox has no resumeSession.",
    );
    console.log("Desktop Phase 1 should keep a live session in Electron main between turns.");
    console.log("Set H3_SPIKE_TEST_RESUME=1 to reproduce the expected harness resume failure.");
    return;
  }

  try {
    const resumedSession = await options.agent.createSession({
      sessionId: options.sessionId,
      resumeFrom: options.resumeState as never,
    });
    await resumedSession.destroy();
    console.log("\nUnexpected: cross-session resume succeeded.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\nCross-session resume failed as expected: ${message}`);
    console.log(`Resume blob still saved at ${options.resumeStatePath} for future work.`);
  }
}

export async function runHarnessSpike() {
  const repoPath = resolveRepoPath();
  const prompt = process.env.H3_SPIKE_PROMPT?.trim() || defaultPrompt;
  const sessionId = "h3-harness-spike-1";
  const resumeStatePath = path.join(
    process.env.H3_SPIKE_RESUME_DIR?.trim() || "/tmp",
    "h3-harness-resume.json",
  );

  console.log("H3Code harness spike");
  console.log(`repoPath: ${repoPath}`);
  console.log(`sessionId: ${sessionId}`);
  console.log(`resumeStatePath: ${resumeStatePath}`);

  if (process.env.H3_SPIKE_SMOKE_ONLY === "1") {
    const agent = await createDesktopPiAgent({ repoPath });
    const session = await agent.createSession({ sessionId: "smoke" });
    await session.destroy();
    console.log("\nSmoke-only: HarnessAgent + just-bash session created and destroyed.");
    return;
  }

  const spikeConfig = resolveSpikeConfig();
  console.log(`authMode: ${spikeConfig.authMode}`);
  console.log(`model: ${spikeConfig.model}`);
  console.log(`thinkingLevel: ${spikeConfig.thinkingLevel}`);

  const agent = await createDesktopPiAgent({
    repoPath,
    auth: spikeConfig.auth,
    model: spikeConfig.model,
    thinkingLevel: spikeConfig.thinkingLevel,
  });

  await probeOverlayWriteBehavior(repoPath);

  const session = await agent.createSession({ sessionId });

  try {
    const firstTurn = await agent.stream({
      session,
      prompt,
    });

    const firstSummary = await consumeStream(firstTurn.stream, "turn-1");
    const turn1Status = assertTurn1(firstSummary);

    if (turn1Status === "rate_limited") {
      console.log("\n=== spike summary (rate limited) ===");
      console.log(
        JSON.stringify(
          {
            turn1: firstSummary,
            gatewayRateLimited: true,
            validated: {
              gatewayAuth: true,
              piToolsInvoked: true,
              followUpSkipped: true,
            },
          },
          null,
          2,
        ),
      );
      console.log(
        "\nHarness spike partially validated: gateway + Pi tools work.",
      );
      console.log(
        "AI Gateway free tier rate-limited the model before text/follow-up.",
      );
      console.log("Add credits at Vercel AI Gateway or retry later, then re-run.");
      return;
    }

    const secondTurn = await agent.stream({
      session,
      prompt: "What was my original question? Answer in one short sentence.",
    });

    const secondSummary = await consumeStream(secondTurn.stream, "turn-2-same-session");
    assertFollowUpTurn(secondSummary);

    try {
      await readFile(path.join(repoPath, resumeProbePath), "utf8");
      console.log(
        `Overlay probe: agent may have written ${resumeProbePath} to real disk (check tool paths).`,
      );
    } catch {
      console.log(
        `Overlay probe: no ${resumeProbePath} on real disk after turns (OverlayFs writes likely in-memory only).`,
      );
    }

    const resumeState = await session.stop();
    await mkdir(path.dirname(resumeStatePath), { recursive: true });
    await writeFile(resumeStatePath, JSON.stringify(resumeState, null, 2), "utf8");
    console.log(`\nSaved resume state to ${resumeStatePath}`);

    await maybeTestCrossSessionResume({
      agent,
      sessionId,
      resumeState,
      resumeStatePath,
    });

    console.log("\n=== spike summary ===");
    console.log(
      JSON.stringify(
        {
          turn1: firstSummary,
          turn2: secondSummary,
          success: {
            turn1ToolActivity: firstSummary.toolCalls > 0 || firstSummary.toolResults > 0,
            turn1Text: firstSummary.textDeltas > 0,
            turn2Text: secondSummary.textDeltas > 0,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      await session.destroy();
    } catch {
      // stop() may already have ended the local handle
    }
  }

  console.log("\nHarness spike completed successfully.");
}
