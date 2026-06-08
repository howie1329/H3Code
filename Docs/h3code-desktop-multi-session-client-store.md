# H3Code Desktop Multi-Session Client Store

> Status: Draft. This document describes the target desktop client-store shape for running multiple sessions while showing one session at a time.
>
> Related: [h3code-runtime-read-model-architecture.md](./h3code-runtime-read-model-architecture.md), [h3code-runtime-persistence.md](./h3code-runtime-persistence.md), [h3code-desktop-mvp.md](./h3code-desktop-mvp.md).

## Goal

Users should be able to start work in session A, switch to session B, start work there, and return to session A while both sessions continue running in the Agent Server.

The desktop UI does not need to show multiple transcripts at once. It needs to keep multiple live session mirrors and choose one visible session.

```txt
Agent runtime
  -> session-scoped UiSessionEvent stream
    -> desktop multi-session client store
      -> one visible SessionReadModel
        -> transcript, composer, controls
```

## Current Constraint

The current desktop state is shaped around one active session:

```txt
activeSessionId
sessionReadModel
sessionUnsubscribe
connectionStatus
composer -> activeSessionId
```

That makes session switching act like replacing the current workspace session. It is fine for a single active workflow, but it does not preserve active UI subscriptions for background sessions.

The runtime already uses session IDs for bindings, provider runtimes, read models, and WebSocket subscriptions. The missing piece is a desktop client store that mirrors more than one session.

## Decision

Use a small Svelte 5 runes store/module for the first implementation.

Do not add Zustand for the desktop MVP. The desktop app already uses Svelte runes, and the required state is simple:

```txt
liveSessions: Map<sessionId, SessionReadModel>
visibleSessionId: string | undefined
subscriptions: Map<sessionId, unsubscribe>
```

The desktop may later extract framework-neutral reducer helpers into a package if cloud and desktop need to share behavior:

```txt
@h3code/agent-client-store
  applyUiSessionEvent()
  session map reducer
  selectors

apps/desktop
  Svelte runes wrapper

apps/cloud
  React wrapper
```

Do not start with that package unless duplication appears.

## Ownership

Agent runtime owns canonical H3Code session state:

- Projects provider `RuntimeEvent`s into `SessionReadModel`.
- Emits provider-neutral `UiSessionEvent`s.
- Holds provider runtimes and runtime bindings.
- Persists read models through runtime persistence when available.

Desktop client store owns local presentation mirrors:

- Subscribes to session-scoped UI events.
- Keeps the latest `SessionReadModel` per opened session.
- Tracks which session is visible.
- Tracks local composer/control state.
- Presents attention indicators for background sessions.

Desktop client store must not:

- Project provider-native events.
- Repair runtime status.
- Persist canonical transcript state.
- Reach into provider adapters.

## Target Store Shape

```ts
class DesktopSessionStore {
  liveSessions = $state(new Map<string, SessionReadModel>());
  visibleSessionId = $state<string | undefined>();
  subscriptions = new Map<string, () => void>();

  visibleSession = $derived(
    this.visibleSessionId
      ? this.liveSessions.get(this.visibleSessionId)
      : undefined,
  );
}
```

Keep one visible session. Keep many live sessions.

```txt
Session A: running in background
Session B: visible and running
Session C: idle
```

## Core Operations

### Open Session

Opening a session means:

1. Store the returned `SessionReadModel` in `liveSessions`.
2. Mark it as `visibleSessionId`.
3. Subscribe to its UI event stream if not already subscribed.
4. Merge its live status into the sidebar session list.

```ts
async openSession(session: SessionReadModel) {
  this.liveSessions.set(session.id, session);
  this.visibleSessionId = session.id;

  if (!this.subscriptions.has(session.id)) {
    const unsubscribe = await runtime.subscribeSession(session.id, (event) => {
      this.applySessionEvent(session.id, event);
    });
    this.subscriptions.set(session.id, unsubscribe);
  }
}
```

### Show Session

Showing a session changes the visible pointer. It should not stop, unsubscribe, or delete other live sessions.

```ts
showSession(sessionId: string) {
  this.visibleSessionId = sessionId;
}
```

If the session is not in `liveSessions`, request a snapshot from the runtime first.

### Apply Session Event

Incoming events are applied by event session ID:

```txt
UiSessionEvent(sessionId=A) -> liveSessions[A]
UiSessionEvent(sessionId=B) -> liveSessions[B]
```

The handler must not assume the event belongs to the currently visible session.

```ts
applySessionEvent(sessionId: string, event: UiSessionEvent) {
  const current = this.liveSessions.get(sessionId);
  const next = applySessionEvent(current, event);
  this.liveSessions.set(sessionId, next);
}
```

### Send Prompt

The composer sends to the visible session:

```ts
async sendPrompt(text: string) {
  const sessionId = this.visibleSessionId;
  if (!sessionId) return;
  await runtime.sendTurn(sessionId, text);
}
```

The store should not block sending to B because A is running, unless a later product policy says only one active session may write to a worktree.

## Sidebar Requirements

The session list should combine persisted session summaries with live read-model state.

For each session row, show:

- Idle, running, error, or needs input.
- Whether the session is currently visible.
- Whether the session has a live runtime attached.
- Last update time when available.

Background sessions should surface attention without stealing focus:

- Running indicator.
- Needs approval/input indicator.
- Error indicator.
- Optional notification badge.

## Composer And Controls

Composer state should be scoped to the visible session.

At minimum:

```txt
draftBySessionId: Map<sessionId, string>
```

Provider controls should target `visibleSessionId`:

- Abort.
- Model picker.
- Thinking level.
- Queue settings.
- Auto-compaction.
- Approval responses.
- User-input responses.

If a background session requests input, selecting that session should reveal the request in the same transcript/control surface.

## Runtime Policy

The UI store enables multiple live sessions. It does not decide whether concurrent sessions may safely edit the same worktree.

That policy belongs in the Agent Server/runtime layer.

Initial policy can be permissive:

```txt
Multiple sessions may run at once.
The UI routes commands by session ID.
```

Recommended follow-up policy:

```txt
Allow multiple sessions across repos.
Warn or block multiple active writer sessions in the same worktree.
Prefer separate worktrees for truly concurrent coding sessions.
```

## Migration Plan

1. Add a desktop multi-session store module using Svelte runes.
2. Move session subscription management from `DesktopState.attachSession()` into the store.
3. Replace single `sessionReadModel` writes with `liveSessions[sessionId]` updates.
4. Derive the visible session from `visibleSessionId`.
5. Change switching sessions to update visibility instead of unsubscribing from the previous session.
6. Scope composer drafts and provider controls to `visibleSessionId`.
7. Merge live session status into sidebar rows.
8. Add lifecycle actions for closing a local view and stopping a runtime session.

## Non-Goals

- Do not build split-pane or tabbed transcript UI in the first pass.
- Do not add Zustand for the desktop implementation.
- Do not move server read-model projection into the renderer.
- Do not persist provider-owned transcripts from the renderer.
- Do not solve same-worktree write conflicts in the client store.

## Validation

Minimum coverage:

- Opening session A subscribes once and stores its read model.
- Opening session B leaves session A subscribed.
- Events for A update A while B is visible.
- Events for B update B while B is visible.
- Switching visible sessions does not stop provider runtimes.
- Composer sends to the visible session ID.
- Sidebar status updates for background running/error/needs-input sessions.

Relevant checks:

```bash
npm run test:runtime-client --workspace @h3code/desktop
npm run check --workspace @h3code/desktop
```
