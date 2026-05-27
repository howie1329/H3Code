# H3Code Agent Server Product Brief

## Summary

H3Code is moving from a PI-specific desktop shell toward a local agent workbench. The desktop UI will talk to a local Agent Server over WebSocket. The Agent Server will orchestrate local workspace concerns and delegate agent behavior to provider implementations through the H3Code `AgentProvider` interface.

PI Agent remains the first provider and the current working runtime. Codex App Server is the next planned provider. Cursor can follow after the abstraction proves itself with PI and Codex.

The visual architecture proposal remains in [agent-server-architecture.html.html](agent-server-architecture.html.html).

## Product Direction

The target product shape is:

```txt
H3Code UI
  -> local Agent Server WebSocket
    -> AgentProvider interface
      -> PiProvider / CodexProvider / CursorProvider
        -> provider runtime
```

The UI should speak H3Code names and concepts, not PI, Codex, or Cursor wire formats. The server owns provider selection, connection lifecycle, platform services, and capability-gated routing. Providers translate their native APIs into H3Code domain events and snapshots.

## Product Boundary

Providers own:

- Sessions and canonical message history.
- Tool execution and runtime behavior.
- Model behavior, queueing, compaction, retry, and provider-specific control flow.
- Provider-native IDs, files, auth, and configuration.

H3Code owns:

- Desktop UI and future local clients.
- Local Agent Server orchestration.
- Workspace/repo context.
- Provider registry and capability-gated controls.
- SQLite metadata index for discovery, not transcripts.
- Git diff, worktree inventory, and desktop preferences.

H3Code must not become the canonical transcript store. It can cache display state and index metadata for discovery, but provider-native sessions and messages remain provider-owned.

## Current Implementation State

Current desktop runtime:

```txt
Svelte renderer
  -> preload IPC bridge
    -> Electron main process
      -> pi --mode rpc subprocess
```

Implemented foundation:

- `@h3code/agent-core` defines shared H3Code contracts for protocol messages, sessions, runs, capabilities, provider UI prompts, workspace diff summaries, and `AgentProvider`.
- `@h3code/agent-server` provides a local Node.js and `ws` server skeleton with WebSocket handshake, command routing, connection management, provider registry, and a temporary noop provider.
- The desktop app still uses its existing PI IPC path until the PI provider extraction and UI WebSocket migration are complete.

## Migration Phases

1. Finish the Agent Server skeleton with stable local startup, shutdown, routing, and verification.
2. Extract PI subprocess and JSONL RPC handling from Electron main into `PiProvider`.
3. Move platform services that belong in the server: session metadata merge, git diff, worktree inventory, and preferences where appropriate.
4. Switch the desktop renderer from PI-specific preload IPC to the H3Code WebSocket protocol.
5. Add Codex App Server as a second provider behind the same `AgentProvider` interface.
6. Add Cursor after PI and Codex validate the abstraction.

During transition, a short-lived dual path is acceptable. Long-term duplicate IPC and WebSocket agent paths should be avoided.

## Provider Strategy

PI is the parity provider. It should prove the architecture can preserve the current desktop loop: connect repo, list and switch sessions, create sessions, prompt, steer, follow up, abort, model controls, slash commands, extension UI, compaction, retry, and tool activity.

Codex should be added through Codex App Server, mapped into H3Code sessions, runs, messages, tools, approvals, and provider notices. Codex-specific thread/turn/item details should stay inside `CodexProvider`.

Cursor should be mapped through its supported SDK or API surface. Any weaker feature parity should be expressed with provider capabilities, not hard-coded provider checks in the UI.

## Non-Goals

- Cloud sync, accounts, teams, or remote multi-user deployment.
- H3Code-owned transcript or message persistence.
- Forcing Codex or Cursor into PI-shaped parity.
- Full-text transcript indexing in SQLite.
- Provider SDK or wire-format types leaking into the UI.

## Near-Term Acceptance

- `@h3code/agent-core` remains provider-neutral and dependency-light.
- `@h3code/agent-server` starts locally, accepts `/ws`, and routes commands through providers.
- `PiProvider` reaches parity with the current Electron PI path before Codex work begins.
- The desktop UI can eventually switch to WebSocket without learning provider-native protocols.
