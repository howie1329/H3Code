import { runHarnessSpike } from "../dist/harness/spike-hello.js";

try {
  await runHarnessSpike();
} catch (error) {
  console.error("\nHarness spike failed:");
  console.error(error);
  process.exitCode = 1;
}
