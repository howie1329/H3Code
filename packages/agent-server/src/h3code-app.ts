import { PiAgentProvider } from "@h3code/pi-provider";
import { type AgentServerHandle, type AgentServerOptions, startAgentServer } from "./server.js";

export async function startH3CodeAgentServer(
  options: Omit<AgentServerOptions, "providers"> = {},
): Promise<AgentServerHandle> {
  return startAgentServer({
    ...options,
    providers: [new PiAgentProvider()],
  });
}
