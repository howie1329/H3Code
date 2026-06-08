# H3Code Runtime Persistence

> Status: Draft. This document describes the target split between local app metadata and durable runtime read-model persistence.
>
> Related: [h3code-runtime-read-model-architecture.md](./h3code-runtime-read-model-architecture.md), [h3code-agent-server-product.md](./h3code-agent-server-product.md), [h3code-unified-client.md](./h3code-unified-client.md).

## Goal

H3Code should restore desktop sessions quickly after app restart without making the renderer, provider adapter, or SQLite database the owner of live agent state.

The target model is:

```txt
Provider SDK
  -> Provider adapter
    -> RuntimeEvent
      -> Agent runtime projector
        -> SessionReadModel
          -> Runtime persistence cache
            -> Desktop / cloud UI
```

Runtime persistence exists to make cold starts fast and deterministic. It does not replace provider-owned history or the server-owned read-model projector.

## Decision

Create a dedicated runtime persistence package instead of expanding or renaming `@h3code/agent-metadata`.

```txt
packages/
  agent-metadata/
    app metadata, preferences, recent repos, local indexes

  agent-runtime-persistence/
    durable SessionReadModel projections and runtime bindings
```

This keeps two separate concerns separate:

- `agent-metadata` stores desktop/app metadata.
- `agent-runtime-persistence` stores projected runtime state for cold start and resume.

Do not replace `agent-metadata` wholesale until its remaining responsibilities are clearly empty or non-runtime.

## Ownership

Provider SDKs own provider truth:

- Native session handles.
- Canonical provider transcript/history.
- Provider-native streaming, compaction, tools, queueing, retry, and model behavior.

Provider adapters own translation:

- Provider events to H3Code `RuntimeEvent`s.
- H3Code commands to provider SDK calls.
- Provider-specific resume and snapshot edge cases.

Agent runtime owns H3Code state:

- Runtime bindings.
- Runtime event ingestion.
- `SessionReadModel` projection.
- Status, active turns, messages, activities, pending interactions, and model/control state.
- Persistence writes for the projected read model.

Desktop owns presentation:

- Rendering the read model.
- Composer text and local interaction state.
- Layout, navigation, selection, and visual state.

The desktop renderer should not write canonical transcript rows, project provider events, or repair provider-specific state.

## Cold Start Flow

On app/server startup:

```txt
Agent server boots
  -> opens runtime persistence database
  -> runs migrations
  -> loads persisted SessionReadModel projections
  -> exposes session snapshots to connected clients
  -> resumes/reconciles provider sessions in the background
  -> applies new RuntimeEvents through the same projector
```

The user should see the last known session state immediately. Provider reconciliation may later patch the model, but it must flow through provider-neutral runtime events and the read-model projector.

## Package Boundary

`@h3code/agent-runtime-persistence` should depend on:

- `@h3code/agent-protocol` for read-model and runtime binding types.
- A SQLite client already compatible with the local desktop server environment.

It should not depend on:

- Svelte, Electron renderer code, or desktop UI stores.
- PI SDK or any provider-native package.
- Provider adapter internals.

The package should expose a small API:

```ts
type RuntimePersistence = {
  loadSessions(): Promise<SessionReadModel[]>;
  loadSession(sessionId: string): Promise<SessionReadModel | undefined>;
  saveSession(session: SessionReadModel): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  loadBindings(): Promise<RuntimeBinding[]>;
  saveBinding(binding: RuntimeBinding): Promise<void>;
  deleteBinding(sessionId: string): Promise<void>;
};
```

The concrete API can evolve, but it should stay storage-shaped. Projection logic belongs in the runtime/read-model layer, not in SQL repositories.

## Suggested Tables

Start with projected state, not a full event store:

```txt
runtime_sessions
  session_id primary key
  provider_id
  repo_path
  provider_session_ref
  status
  active_turn_id
  title
  model_json
  token_usage_json
  diff_summary_json
  updated_at

runtime_messages
  message_id primary key
  session_id
  role
  content
  status
  turn_id
  item_id
  metadata_json
  created_at
  updated_at

runtime_activities
  activity_id primary key
  session_id
  turn_id
  kind
  status
  title
  summary
  payload_json
  created_at
  updated_at

runtime_pending_interactions
  request_id primary key
  session_id
  kind
  payload_json
  created_at

runtime_bindings
  session_id primary key
  provider_id
  repo_path
  provider_session_ref
  resume_cursor_json
  provider_options_json
  status
  active_turn_id
  last_event_at
```

Keep the first version simple. A durable event store can be added later if the product needs replay, auditability, sync, or cross-device conflict resolution.

## Identity Model

`SessionId` (`h3code_session_id`) is H3Code’s canonical session identifier across runtime persistence, the session registry, sidebar rows, and runtime commands.

Provider-owned handles (`providerSessionRef`, PI internal ids) live on `RuntimeBinding` and as denormalized metadata in `repo_sessions`. They are never primary keys and are not accepted from the client for switch/delete.

## Session Registry

`@h3code/agent-metadata` stores H3Code-registered sessions in `repo_sessions` keyed by `h3code_session_id`.

- Registration happens on `session.create` only.
- `listSessions` reads the registry; it does not scan provider filesystems.
- Legacy `session_message_cache` has been removed; use `@h3code/agent-runtime-persistence` for transcript paint on cold start.

## Relationship To `agent-metadata`

`@h3code/agent-metadata` should remain responsible for app-level local data:

- Known repositories.
- H3Code session registry (`repo_sessions` by `SessionId`).
- User preferences.
- Workspace metadata.
- Non-runtime app settings.

It should not own:

- `SessionReadModel.messages`.
- Active turn state.
- Streaming assistant state.
- Runtime activities.
- Pending provider interactions.
- Provider session resume bindings.

Those belong in `@h3code/agent-runtime-persistence`.

## Why Not Zustand

Zustand can be useful inside a frontend renderer as a convenient client-side mirror, but it does not solve cold starts by itself.

Cold start is a server persistence problem:

```txt
Server starts with no process memory
  -> load durable projected state
  -> send snapshot to UI
```

A UI store can render the snapshot after it arrives, but it should not be the durable source of truth for runtime state.

## Migration Plan

1. Add `@h3code/agent-runtime-persistence` with SQLite migrations and repository tests.
2. Wire `@h3code/agent-runtime` to load persisted sessions on startup.
3. Persist projected `SessionReadModel` updates after runtime events are applied.
4. Persist runtime bindings when sessions are created, resumed, switched, or deleted.
5. Keep desktop unchanged except for consuming normal server snapshots.
6. Move any runtime-shaped storage out of `@h3code/agent-metadata`.
7. Leave true app metadata in `@h3code/agent-metadata`.

## Non-Goals

- Do not persist provider-owned canonical transcripts as H3Code-owned truth.
- Do not let provider adapters emit UI read-model events.
- Do not let desktop renderer repair runtime status or transcript state.
- Do not introduce a frontend state library as the runtime persistence layer.
- Do not add a durable event store until projected snapshots are proven insufficient.

## Validation

Minimum coverage for the first implementation:

- Runtime persistence can save and load a complete idle session read model.
- Runtime persistence can save and load a running session without losing `activeTurnId`.
- Cold startup loads previous messages and idle status before provider reconciliation.
- Provider reconciliation updates the same read model through runtime events.
- Deleting a session removes its projected messages, activities, interactions, and binding.

Relevant checks:

```bash
npm run test --workspace @h3code/agent-runtime-persistence
npm run test --workspace @h3code/agent-runtime
npm run check --workspace @h3code/desktop
```
