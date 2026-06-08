# H3Code Runtime Read Model Architecture

> Status: Draft. This document describes the target architecture as if H3Code is being designed from first principles.
>
> Related: [h3code-agent-server-product.md](./h3code-agent-server-product.md), [h3code-unified-client.md](./h3code-unified-client.md), [h3code-cloud-saas-prd.md](./h3code-cloud-saas-prd.md).

## Goal

H3Code is a provider-neutral workbench for coding agents.

The product should have one app-level session model that can be rendered by desktop and cloud surfaces, while provider SDKs keep ownership of their own sessions, transcripts, tools, and runtime behavior.

The core architecture is:

```txt
Provider SDK
  -> Provider adapter
    -> H3Code runtime events
      -> Agent Server runtime ingestion
        -> Server session read model
          -> Desktop / cloud UI
```

The UI should not learn PI, Codex, Cursor, or any provider-native event format. It should render H3Code session state.

## Ownership Model

Provider SDKs own provider truth:

- Native provider sessions and resume handles.
- Canonical provider message history.
- Streaming mechanics.
- Tool execution and provider-native tool lifecycle.
- Queueing, steering, follow-up behavior, retry, and compaction.
- Provider-native IDs, configuration, auth, and model behavior.

Provider adapters own translation:

- Provider-native events to H3Code runtime events.
- H3Code commands to provider-native SDK calls.
- Provider-specific edge cases, feature detection, and capability reporting.
- Provider-native request/response correlation for approvals and interactive input.

Agent Server owns H3Code runtime state:

- Provider registry and capability-gated routing.
- H3Code session IDs and provider runtime bindings.
- Runtime event ingestion.
- Server-side session read model projection.
- WebSocket or IPC transport to clients.
- Workspace services such as git diff, repo metadata, preferences, and local indexing.
- Non-canonical display cache for fast reloads.

UI clients own presentation:

- Rendering the session read model.
- Composer input and local interaction state.
- Layout, navigation, selection, and visual affordances.
- A stable client-side mirror of server read model updates.

## Key Principle

The provider adapter answers:

```txt
What happened in the provider runtime?
```

The Agent Server answers:

```txt
What is the H3Code session now?
```

The UI answers:

```txt
How should that session look and feel on screen?
```

This distinction keeps provider behavior out of the UI and keeps display projection out of individual components.

## Runtime Events vs UI Read Model Events

H3Code has two event vocabularies.

Runtime events are produced by provider adapters and consumed by the Agent Server. They describe provider execution facts.

Examples:

```ts
type RuntimeEvent =
  | {
      type: "turn.started";
      sessionId: string;
      turnId: string;
      providerId: string;
      model?: string;
      occurredAt: number;
    }
  | {
      type: "item.started";
      sessionId: string;
      turnId: string;
      itemId: string;
      itemType:
        | "assistant_message"
        | "reasoning"
        | "command_execution"
        | "file_change"
        | "dynamic_tool_call"
        | "web_search"
        | "plan"
        | "error";
      title?: string;
      occurredAt: number;
    }
  | {
      type: "content.delta";
      sessionId: string;
      turnId: string;
      itemId: string;
      stream: "assistant_text" | "reasoning_text" | "tool_output";
      delta: string;
      occurredAt: number;
    }
  | {
      type: "tool.updated";
      sessionId: string;
      turnId: string;
      itemId: string;
      toolName: string;
      status: "pending" | "running" | "completed" | "failed";
      input?: unknown;
      output?: unknown;
      errorText?: string;
      occurredAt: number;
    }
  | {
      type: "approval.requested";
      sessionId: string;
      requestId: string;
      payload: unknown;
      occurredAt: number;
    }
  | {
      type: "user_input.requested";
      sessionId: string;
      requestId: string;
      payload: unknown;
      occurredAt: number;
    }
  | {
      type: "turn.completed";
      sessionId: string;
      turnId: string;
      status: "completed" | "failed" | "cancelled" | "interrupted";
      usage?: unknown;
      occurredAt: number;
    };
```

UI read model events are produced by the Agent Server and consumed by UI clients. They describe app-level state changes.

Examples:

```ts
type UiSessionEvent =
  | {
      type: "session.snapshot";
      session: SessionReadModel;
    }
  | {
      type: "session.patch";
      sessionId: string;
      patch: SessionReadModelPatch;
    }
  | {
      type: "thread.message.upserted";
      sessionId: string;
      message: UiMessage;
    }
  | {
      type: "thread.activity.upserted";
      sessionId: string;
      activity: UiActivity;
    }
  | {
      type: "interaction.requested";
      sessionId: string;
      request: PendingInteraction;
    }
  | {
      type: "interaction.resolved";
      sessionId: string;
      requestId: string;
    };
```

Runtime events may contain thread, session, turn, and item IDs. The difference is not whether events have IDs. The difference is who applies those events to build the current session state.

In this architecture, the Agent Server applies runtime events and owns the current H3Code session read model.

## Session Read Model

The session read model is the shape the UI renders.

```ts
type SessionReadModel = {
  id: string;
  providerId: string;
  repoPath: string;
  providerSessionRef?: string;
  status: "idle" | "running" | "error";
  activeTurnId?: string;
  title?: string;

  messages: UiMessage[];
  activities: UiActivity[];
  pendingInteractions: PendingInteraction[];

  model?: UiModelState;
  tokenUsage?: TokenUsageSnapshot;
  diffSummary?: WorkspaceDiffSummary;

  updatedAt: number;
};
```

The read model is not the canonical provider transcript. It is H3Code's display model. It can be cached and rebuilt, but provider SDKs remain the source of truth for provider-native history.

## Runtime Binding

The server stores a binding between an H3Code session and a provider runtime.

```ts
type RuntimeBinding = {
  sessionId: string;
  providerId: string;
  repoPath: string;

  providerSessionRef?: string;
  resumeCursor?: unknown;
  providerOptions?: unknown;

  status: "starting" | "running" | "stopped" | "error";
  activeTurnId?: string;
  lastEvent?: string;
  lastEventAt?: number;
};
```

The binding lets the server route commands, recover sessions, reconnect after reloads, and keep UI state separate from provider-native session handles.

## Session Creation and Routing

The Agent Server knows which repo, thread, and provider a runtime belongs to because it creates or records a runtime binding before provider execution starts.

Desktop session creation:

```txt
UI
  -> session.create({ repoPath, providerId })
    -> Agent Server creates H3Code sessionId
      -> Agent Server calls provider.startSession({ repoPath })
        -> Provider SDK creates or opens provider-native session
          -> Provider adapter returns providerSessionRef / resumeCursor
            -> Agent Server stores RuntimeBinding
```

Example binding:

```ts
const binding: RuntimeBinding = {
  sessionId: "h3-session-123",
  providerId: "pi",
  repoPath: "/Users/me/project",
  providerSessionRef: "/Users/me/.pi/sessions/session.jsonl",
  status: "running",
  lastEventAt: Date.now(),
};
```

Every later command routes through that binding:

```txt
turn.send({ sessionId: "h3-session-123", input })
  -> Agent Server loads RuntimeBinding
    -> providerId = "pi"
    -> repoPath = "/Users/me/project"
    -> providerSessionRef = "/Users/me/.pi/sessions/session.jsonl"
    -> Agent Server calls PI adapter
      -> PI adapter calls PI SDK
```

Runtime events also carry H3Code IDs where possible:

```ts
{
  type: "content.delta",
  sessionId: "h3-session-123",
  turnId: "turn-456",
  itemId: "assistant-1",
  delta: "hello",
  occurredAt: Date.now(),
}
```

If a provider emits only provider-native IDs, the adapter or server resolves them through the runtime binding before projecting them into H3Code session state.

Cloud uses the same concept with different location fields. A cloud binding may point to a workspace repository, Daytona sandbox, work branch, and provider-native thread:

```ts
type CloudRuntimeBinding = RuntimeBinding & {
  workspaceRepositoryId: string;
  sandboxId: string;
  workBranch: string;
};
```

## Command Flow

UI clients send H3Code commands, not provider-native calls.

```txt
UI
  -> turn.send
    -> Agent Server routes by session binding
      -> Provider adapter maps command to provider SDK call
        -> Provider SDK executes
```

Example command:

```ts
type SendTurnCommand = {
  type: "turn.send";
  sessionId: string;
  input: {
    text?: string;
    attachments?: ChatAttachment[];
    mode?: "default" | "plan";
  };
};
```

The PI adapter may translate this into `session.prompt(...)`. A Codex adapter may translate it into a Codex App Server request. The UI does not know the difference.

## Provider Flow

When a provider streams, the flow is:

```txt
Provider SDK native event
  -> Provider adapter
    -> RuntimeEvent
      -> Agent Server ingestion
        -> SessionReadModel update
          -> UiSessionEvent
            -> UI store
              -> Components
```

Example:

```txt
PI text delta
  -> { type: "content.delta", itemId, delta }
  -> server appends delta to message item
  -> { type: "thread.message.upserted", message }
  -> transcript renders updated message
```

If the UI disconnects or remounts, it can request the current `SessionReadModel` snapshot from the server.

## Desktop Runtime

Desktop uses a local Agent Server.

```txt
Electron main
  -> starts local Agent Server
    -> starts/registers local provider adapters
      -> PI SDK / Codex App Server / Cursor runtime

Svelte renderer
  -> connects to local Agent Server
    -> subscribes to session read model updates
```

The desktop UI should not contain PI-specific session projection code. It should render the same `SessionReadModel` that cloud renders.

## Cloud Runtime

Cloud uses the same product model with different infrastructure.

```txt
Cloud UI
  -> Convex queries/subscriptions or server routes
    -> cloud runtime session
      -> Daytona sandbox
        -> provider runtime
```

Cloud persistence can store read model snapshots, runtime events, or normalized messages in Convex. Provider credentials and GitHub OAuth tokens remain server-side only.

The cloud runtime should still emit or ingest the same H3Code runtime event vocabulary so the session read model stays shared across desktop and cloud.

## Client Store

The UI should receive server-projected read model updates into a stable client store.

```txt
UiSessionEvent
  -> client session store
    -> selectors
      -> components
```

Components should not own stream application logic. Route changes, remounts, split views, and reconnects should not lose active stream state.

The client store mirrors server state and owns only presentation-local concerns such as selection, scroll, composer draft, and panel layout.

## Package Boundaries

Target package responsibilities:

```txt
packages/agent-core
  RuntimeEvent
  SessionReadModel
  command types
  capability types
  provider contract
  transport protocol types

packages/agent-server
  provider registry
  runtime binding store
  runtime event ingestion
  session read model projector
  session store/cache
  WebSocket/IPC transport
  workspace platform services

packages/pi-provider
  PI SDK lifecycle wrapper
  PI event -> RuntimeEvent mapper
  H3Code command -> PI SDK call mapper
  PI capability declaration

apps/desktop
  Electron host
  Svelte UI
  local client store
  rendering only

apps/cloud
  cloud UI
  Convex-backed session subscriptions
  Daytona-backed provider runtime
```

## Non-Goals

- H3Code does not become the canonical provider transcript store.
- The UI does not import or interpret provider SDK event formats.
- Provider adapters do not own H3Code product read models.
- The server does not force every provider into PI feature parity.
- Transport technology is not the architecture. WebSocket, IPC, or Convex subscriptions can all carry the same model.

## Current vs Target Boundary

The important change is not that H3Code has a server. H3Code already has one. The important change is what the server owns.

Current desktop shape:

```txt
PI SDK
  -> PI provider wrapper
    -> H3Code-ish session events and snapshots
      -> Agent Server forwards over WebSocket
        -> Desktop PI/session projector builds display state
          -> UI renders
```

Target shape:

```txt
Provider SDK
  -> Provider adapter emits runtime events
    -> Agent Server projects runtime events into SessionReadModel
      -> UI store mirrors SessionReadModel
        -> UI renders
```

The target moves H3Code session interpretation from the desktop renderer into the Agent Server. The UI remains provider-neutral, but it also becomes runtime-event-neutral: it renders server-projected session state instead of applying low-level stream mechanics itself.

## Acceptance Criteria

- A provider can be added by implementing the provider contract and emitting `RuntimeEvent`s.
- The Agent Server can build a complete `SessionReadModel` from runtime events plus provider snapshots.
- The desktop UI can render a session without PI-specific projection code.
- The cloud UI can consume the same session read model shape as desktop.
- A disconnected UI can reconnect and request the current session snapshot.
- Provider-specific controls are capability-gated.
- Runtime event mapping and server projection are covered by focused tests.

## Migration Direction

The current desktop implementation can migrate in phases:

1. Define `RuntimeEvent`, `RuntimeBinding`, and `SessionReadModel` in `@h3code/agent-core`.
2. Update `@h3code/pi-provider` to emit runtime events internally.
3. Add server runtime ingestion that projects runtime events into the existing desktop session shape.
4. Move transcript/session projection out of `apps/desktop/src/lib/pi-session` and into server/shared read model code.
5. Update the desktop client store to consume server read model snapshots and patches.
6. Add the next provider against the runtime event contract instead of the current PI-shaped snapshot contract.
7. Reuse the same read model for cloud sessions before wiring Daytona execution.
