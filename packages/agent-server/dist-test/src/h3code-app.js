import { PiAgentProvider } from "@h3code/pi-provider";
import { startAgentServer } from "./server.js";
export async function startH3CodeAgentServer(options = {}) {
    return startAgentServer({
        ...options,
        providers: [new PiAgentProvider()],
    });
}
//# sourceMappingURL=h3code-app.js.map