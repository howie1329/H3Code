# @h3code/agent-server

`@h3code/agent-server` is the local Agent Server for H3Code. It exposes a localhost HTTP/WebSocket boundary that uses `@h3code/agent-core` protocol types.

The server provides HTTP health, WebSocket handshake, message parsing, command routing, connection management, and an injectable provider registry.

## Starting the server

**Product startup** registers the SDK-backed PI provider via `@h3code/pi-provider` (not the legacy Electron `pi --mode rpc` path):

```ts
import { startH3CodeAgentServer } from "@h3code/agent-server";

const server = await startH3CodeAgentServer();
// server.ready.providers includes { id: "pi", ... }
```

**Generic startup** requires an explicit non-empty provider list (used by tests and future multi-provider setups):

```ts
import { startAgentServer } from "@h3code/agent-server";

const server = await startAgentServer({
  providers: [provider],
  dataDir: "/path/to/user-data", // optional; defaults via H3CODE_DATA_DIR or OS app data dir
});
```

`startAgentServer` throws at startup if `providers` is missing or empty.

Platform metadata (SQLite index, recent repos, desktop settings) is provided by `@h3code/agent-metadata` and configured via `dataDir` on server startup. Electron uses the same store when configured with `app.getPath("userData")`.

## WebSocket protocol

- Clients connect at `/ws` and receive `server.ready` with registered provider descriptors.
- `workspace.connect` with `providerId: "pi"` delegates to `PiAgentProvider` when using `startH3CodeAgentServer`.
- Provider events are sent as `session.event`, except `extension.ui.request`, which is uplifted to `provider.ui.request`.
- Inbound `provider.ui.respond` is routed to the connected provider when supported.
- Platform commands: `session.list`, `session.delete`, `workspace.diff`, `preferences.get`, `preferences.updateDesktopSettings`, `preferences.setPiExecutablePath`, `preferences.removeRepo`, `preferences.clearIndexed`.

## Boundaries

Provider SDKs are imported only through provider packages (for example `@h3code/pi-provider`). The server owns WebSocket routing, connection management, and platform command orchestration; provider packages own provider-specific SDK calls such as PI session discovery and deletion. This package does not persist transcripts or own canonical session history.

## Checks

```bash
npm run check --workspace @h3code/agent-server
npm run build --workspace @h3code/agent-server
npm run test --workspace @h3code/agent-server
```
