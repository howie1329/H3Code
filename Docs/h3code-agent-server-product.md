# H3Code Runtime Server Product Brief

> **Superseded** by [h3code-ai-sdk-harness-architecture.md](./h3code-ai-sdk-harness-architecture.md). The WebSocket + `ProviderAdapter` + `SessionReadModel` direction is retired.
>
> Status: Historical. Local agent workbench brief prior to AI SDK Harness adoption. The desktop UI talks to a local runtime server over WebSocket. The runtime server composes workspace concerns, persistence, transport, and provider adapters through the H3Code `ProviderAdapter` interface.

PI Agent remains the first provider and the current working runtime. Codex App Server is the next planned provider. Cursor can follow after the abstraction proves itself with PI and Codex.

The older visual architecture proposal remains in [agent-server-architecture.html.html](agent-server-architecture.html.html).

## Product Direction

The target product shape is:

```txt
H3Code UI
  -> local runtime WebSocket
    -> AgentRuntime
      -> ProviderAdapter interface
        -> PiProviderAdapter / CodexProviderAdapter / CursorProviderAdapter
        -> provider runtime
```

The UI should speak H3Code names and concepts, not PI, Codex, or Cursor wire formats. The runtime owns provider selection, bindings, read-model projection, and capability-gated routing. Provider adapters translate their native APIs into H3Code runtime events.

## Product Boundary

Providers own:

- Sessions and canonical message history.
- Tool execution and runtime behavior.
- Model behavior, queueing, compaction, retry, and provider-specific control flow.
- Provider-native IDs, files, auth, and configuration.

H3Code owns:

- Desktop UI and future local clients.
- Local runtime server orchestration.
- Workspace/repo context.
- Provider registry and capability-gated controls.
- SQLite metadata index for discovery and projected runtime read-model persistence.
- Git diff, worktree inventory, and desktop preferences.

H3Code must not become the canonical transcript store. It can persist projected display state for instant UI paint and index metadata for discovery, but provider-native sessions and messages remain provider-owned. Reconciliation flows through provider adapters and runtime events.

## Current Implementation State

Current desktop runtime:

```txt
Svelte renderer
  -> RuntimeClient (WebSocket)
    -> @h3code/agent-runtime-server
      -> AgentRuntime
        -> PiProviderAdapter (@h3code/agent-provider-pi)
```

Implemented foundation:

- `@h3code/agent-protocol` defines shared H3Code contracts for protocol messages, commands, runtime events, read models, capabilities, workspace summaries, and `ProviderAdapter`.
- `@h3code/agent-runtime` owns provider registration, runtime bindings, event ingestion, and read-model projection.
- `@h3code/agent-runtime-ws` provides the local Node.js and `ws` transport.
- `@h3code/agent-runtime-persistence` stores projected runtime state and bindings.
- `@h3code/agent-runtime-server` composes metadata, persistence, runtime, WebSocket transport, and provider adapters.
- `@h3code/agent-provider-pi` implements `PiProviderAdapter` using the in-process PI SDK.
- The desktop renderer uses WebSocket only; Electron main supervises the server and native shell affordances.

## Migration Phases

Completed for PI:

1. Runtime server skeleton with local startup, shutdown, routing, and verification.
2. PI provider via `@h3code/agent-provider-pi` (in-process SDK, not Electron subprocess RPC).
3. Platform services in the server: session metadata registry, git diff, preferences.
4. Desktop renderer on the H3Code WebSocket protocol (legacy PI IPC path removed).

Remaining:

5. Add Codex App Server as a second provider behind the same `ProviderAdapter` interface.
6. Add Cursor after PI and Codex validate the abstraction.

## Provider Strategy

PI is the parity provider. It should prove the architecture can preserve the current desktop loop: connect repo, list and switch sessions, create sessions, prompt, steer, follow up, abort, model controls, slash commands, extension UI, compaction, retry, and tool activity.

Codex should be added through Codex App Server, mapped into H3Code sessions, runs, messages, tools, approvals, and provider notices. Codex-specific thread/turn/item details should stay inside `CodexProviderAdapter`.

Cursor should be mapped through its supported SDK or API surface. Any weaker feature parity should be expressed with provider capabilities, not hard-coded provider checks in the UI.

## Non-Goals

- Cloud sync, accounts, teams, or remote multi-user deployment.
- H3Code-owned canonical transcript or message persistence (display cache is allowed).
- Forcing Codex or Cursor into PI-shaped parity.
- Full-text transcript indexing in SQLite.
- Provider SDK or wire-format types leaking into the UI.

## Near-Term Acceptance

- `@h3code/agent-protocol` remains provider-neutral and dependency-light.
- `@h3code/agent-runtime-server` starts locally, accepts WebSocket clients, and routes commands through the runtime.
- `PiProviderAdapter` reaches parity with the current Electron PI path before Codex work begins.
- The desktop UI uses WebSocket without learning provider-native protocols.
