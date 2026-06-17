import path from "node:path";
import { fileURLToPath } from "node:url";

import { HarnessSessionManager } from "../dist-electron/electron/harness/harness-session-manager.js";
import { createHarnessHttpServer } from "../dist-electron/electron/harness/harness-http-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

function hasProviderCredentials() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.ANTHROPIC_API_KEY?.trim(),
  );
}

async function consumeSseStream(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is missing.");
  }

  const decoder = new TextDecoder();
  let chunkCount = 0;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) {
        continue;
      }

      chunkCount += 1;
      const payload = dataLine.slice("data: ".length);
      if (payload === "[DONE]") {
        continue;
      }

      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === "text-delta" && parsed.delta) {
          process.stdout.write(parsed.delta);
        }
      } catch {
        // ignore malformed chunks in smoke output
      }
    }
  }

  return chunkCount;
}

async function postChat(chatUrl, body) {
  const response = await fetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed (${response.status}): ${await response.text()}`);
  }

  return response;
}

async function main() {
  const sessionManager = new HarnessSessionManager();
  const http = await createHarnessHttpServer(sessionManager);

  try {
    const health = await fetch(`http://127.0.0.1:${http.port}/health`);
    if (!health.ok) {
      throw new Error(`Health check failed (${health.status}).`);
    }

    console.log(`harness health ok on port ${http.port}`);

    if (!hasProviderCredentials()) {
      console.log("No provider credentials set; skipping streaming chat smoke.");
      console.log("Set AI_GATEWAY_API_KEY or OPENAI_API_KEY to run full stream validation.");
      return;
    }

    const sessionId = "h3-harness-chat-smoke";
    const repoPath = process.env.REPO_PATH?.trim() || repoRoot;
    const prompt =
      process.env.H3_HARNESS_SMOKE_PROMPT?.trim() ||
      "Read the repository root package.json with the read tool (not ls) and report the npm name field.";

    const firstBody = {
      id: sessionId,
      repoPath,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: prompt }],
        },
      ],
    };

    console.log("\n--- turn 1 ---");
    const firstResponse = await postChat(http.chatUrl, firstBody);
    const firstChunks = await consumeSseStream(firstResponse);
    console.log(`\n\nturn 1 chunks: ${firstChunks}`);

    if (firstChunks === 0) {
      throw new Error("Turn 1 produced no SSE chunks.");
    }

    const secondBody = {
      id: sessionId,
      repoPath,
      messages: [
        ...firstBody.messages,
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "I read package.json." }],
        },
        {
          id: "user-2",
          role: "user",
          parts: [
            {
              type: "text",
              text: "What was my original question? Reply in one short sentence.",
            },
          ],
        },
      ],
    };

    console.log("\n--- turn 2 ---");
    const secondResponse = await postChat(http.chatUrl, secondBody);
    const secondChunks = await consumeSseStream(secondResponse);
    console.log(`\n\nturn 2 chunks: ${secondChunks}`);

    if (secondChunks === 0) {
      throw new Error("Turn 2 produced no SSE chunks.");
    }

    console.log("\nHarness HTTP chat smoke passed.");
  } finally {
    await sessionManager.closeAll();
    await http.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
