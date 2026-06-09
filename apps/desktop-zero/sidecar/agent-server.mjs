import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { startH3CodeRuntimeServer } from "@h3code/agent-runtime-server";

const [, , dataDirArg, stateFileArg] = process.argv;

if (!dataDirArg || !stateFileArg) {
  console.error("[desktop-zero] missing sidecar dataDir/stateFile args");
  process.exit(1);
}

const dataDir = path.resolve(dataDirArg);
const stateFile = path.resolve(stateFileArg);
const server = await startH3CodeRuntimeServer({
  host: "127.0.0.1",
  port: 0,
  dataDir,
});
const url = `ws://127.0.0.1:${server.port}`;

await mkdir(path.dirname(stateFile), { recursive: true });
await writeFile(stateFile, JSON.stringify({ url }), "utf8");

console.log(`[desktop-zero] runtime server listening at ${url}`);

async function shutdown() {
  await server.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

process.stdin.resume();
