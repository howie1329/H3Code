# @h3code/agent-core

`@h3code/agent-core` defines H3Code-owned contracts shared by the desktop UI, local Agent Server, and provider implementations.

It is intentionally small and type-focused. It does not run providers, open sockets, spawn processes, store transcripts, or import PI/Codex/Cursor SDK types.

## Owns

- Provider-neutral IDs and status types.
- Session, run, message, tool, approval, and workspace diff shapes.
- UI to Agent Server WebSocket message unions.
- Provider capability flags used as UI metadata.
- The explicit `AgentProvider` interface used by the Agent Server.

## Does Not Own

- WebSocket server implementation.
- Electron IPC or native dialogs.
- PI SDK event mapping.
- Codex Server client code.
- Cursor SDK client code.
- SQLite preferences or metadata indexing.
- Transcript persistence.

## Provider Contract

`AgentProvider` is intentionally explicit: providers registered with the Agent Server implement the current H3Code session, run, metadata, queue, compaction, and extension UI operations directly. Capability flags describe what the UI should show; they are not the runtime dispatch contract.

## Checks

```bash
npm run check --workspace @h3code/agent-core
npm run build --workspace @h3code/agent-core
```
