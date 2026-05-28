import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PiSdkProvider } from "../dist/index.js";

const cwd = process.env.PI_PROVIDER_SMOKE_CWD ?? path.join(tmpdir(), "h3code-pi-provider-smoke");
const prompt = process.env.PI_PROVIDER_SMOKE_PROMPT ?? "Reply with one short sentence confirming the PI SDK provider works.";

await mkdir(cwd, { recursive: true });

const provider = new PiSdkProvider({ cwd, session: { mode: "create" } });
provider.subscribe((event) => {
  console.log(JSON.stringify({ type: event.type, event }));
});

try {
  const snapshot = await provider.start();
  console.log(`Started PI session: ${snapshot.sessionFile ?? snapshot.sessionId}`);
  await provider.prompt({ text: prompt });
  await provider.newSession(snapshot.sessionFile);
  await provider.dispose();
  console.log("PI provider smoke completed.");
} catch (error) {
  await provider.dispose();
  throw error;
}
