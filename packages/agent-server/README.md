# @h3code/agent-server

`@h3code/agent-server` is the local Agent Server for H3Code. It exposes a localhost HTTP/WebSocket boundary that uses `@h3code/agent-core` protocol types.

The current implementation is a server skeleton: HTTP health, WebSocket handshake, message parsing, command routing, connection management, provider registry, and a temporary noop provider for verification.

## Current Role

- Start a local Node.js server bound to `127.0.0.1`.
- Accept WebSocket clients at `/ws`.
- Send `server.ready` with provider descriptors.
- Route basic workspace/session/run commands through a provider registry.
- Verify the protocol with a noop provider before extracting PI from Electron.

## Future Role

- Host `PiProvider`, extracted from the current Electron main process PI RPC logic.
- Own platform services that should not live in providers: metadata index, git diff, worktree inventory, and provider selection.
- Let the desktop UI replace PI-specific preload IPC with the H3Code WebSocket protocol.

## Boundaries

This package should not import provider SDKs directly except through provider implementations. It should not persist transcripts or become the source of truth for sessions.

## Checks

```bash
npm run check --workspace @h3code/agent-server
npm run build --workspace @h3code/agent-server
npm run test --workspace @h3code/agent-server
```
