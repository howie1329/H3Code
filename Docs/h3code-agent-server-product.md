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
- SQLite metadata index for discovery and a non-canonical session message display cache.
- Git diff, worktree inventory, and desktop preferences.

H3Code must not become the canonical transcript store. It can cache display state (including SQLite message blobs for instant UI paint) and index metadata for discovery, but provider-native sessions and messages remain provider-owned. The desktop reconciles cached transcripts against Pi in the background.

## Current Implementation State

Current desktop runtime:

```txt
Svelte renderer
  -> AgentClient (WebSocket)
    -> @h3code/agent-server
      -> PiAgentProvider (@h3code/pi-provider)
```

Implemented foundation:

- `@h3code/agent-core` defines shared H3Code contracts for protocol messages, sessions, runs, capabilities, provider UI prompts, workspace diff summaries, and `AgentProvider`.
- `@h3code/agent-server` provides a local Node.js and `ws` server with WebSocket handshake, command routing, connection management, provider registry, and platform services.
- `@h3code/pi-provider` implements `PiAgentProvider` using the in-process PI SDK.
- The desktop renderer uses WebSocket only; Electron main supervises the server and native shell affordances.

## Migration Phases

Completed for PI:

1. Agent Server skeleton with local startup, shutdown, routing, and verification.
2. PI provider via `@h3code/pi-provider` (in-process SDK, not Electron subprocess RPC).
3. Platform services in the server: session metadata merge, git diff, preferences.
4. Desktop renderer on the H3Code WebSocket protocol (legacy PI IPC path removed).

Remaining:

5. Add Codex App Server as a second provider behind the same `AgentProvider` interface.
6. Add Cursor after PI and Codex validate the abstraction.

## Provider Strategy

PI is the parity provider. It should prove the architecture can preserve the current desktop loop: connect repo, list and switch sessions, create sessions, prompt, steer, follow up, abort, model controls, slash commands, extension UI, compaction, retry, and tool activity.

Codex should be added through Codex App Server, mapped into H3Code sessions, runs, messages, tools, approvals, and provider notices. Codex-specific thread/turn/item details should stay inside `CodexProvider`.

Cursor should be mapped through its supported SDK or API surface. Any weaker feature parity should be expressed with provider capabilities, not hard-coded provider checks in the UI.

## Non-Goals

- Cloud sync, accounts, teams, or remote multi-user deployment.
- H3Code-owned canonical transcript or message persistence (display cache is allowed).
- Forcing Codex or Cursor into PI-shaped parity.
- Full-text transcript indexing in SQLite.
- Provider SDK or wire-format types leaking into the UI.

## Near-Term Acceptance

- `@h3code/agent-core` remains provider-neutral and dependency-light.
- `@h3code/agent-server` starts locally, accepts `/ws`, and routes commands through providers.
- `PiProvider` reaches parity with the current Electron PI path before Codex work begins.
- The desktop UI uses WebSocket without learning provider-native protocols.
