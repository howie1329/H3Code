# H3Code Desktop Evolution

> Status: Draft. **Not** cloud MVP scope. Describes how the **local** workbench can evolve toward a Cursor-like integrated agent—orthogonal to [cloud PRD](./h3code-cloud-saas-prd.md).
>
> Parent: [h3code-platform-vision.md](./h3code-platform-vision.md). Unified UI: [h3code-unified-client.md](./h3code-unified-client.md).

## Current Desktop Architecture

```txt
Electron main
  ├─ BrowserWindow → SvelteKit renderer (today) / TanStack SPA (future)
  ├─ IPC: folder picker, reveal in Finder, agent-server URL
  └─ startH3CodeAgentServer() → localhost HTTP + WebSocket

Renderer
  → agent-client (WebSocket)
  → @h3code/agent-server
    → PiAgentProvider → PI SDK (in-process)
```

**Harness today:** PI SDK, not H3Code. **`pi-provider`** maps PI events → `agent-core` `SessionDomainEvent`s. **`agent-metadata`** SQLite caches display messages and prefs.

## Cursor Local (Reference)

Cursor’s local agent runs **inside/near the IDE**: own harness, tools call editor APIs and terminal directly. No separate “agent server” product on another port. Cloud agents are the same *chat UX* with execution in a remote VM.

H3Code does **not** need to fork VS Code to approach this—but can move **integration depth** and **tool ownership** over time.

## Gap vs Cursor Local

| Area | H3Code today | Cursor-like target |
|------|--------------|-------------------|
| Transport | WebSocket to separate Node server | In-process or IPC (no TCP) |
| Harness | PI SDK | H3 harness **or** wrapped PI (explicit choice) |
| Tools | PI-owned | Optional H3-owned tools hitting repo/terminal |
| UI | Svelte (today) | Shared TanStack shell with cloud |
| Snappy reload | SQLite message cache | + optional Convex reactive cache |
| Cloud sessions in app | None | Same SPA, `runtime` or “cloud mode” later |

## Evolution Tracks (Independent)

These can be done in order; none blocks cloud MVP.

### Track 1 — In-process agent host (recommended first)

**Goal:** Remove localhost WebSocket; reduce latency and “connection” UX.

```txt
Electron main (or utilityProcess)
  └─ AgentHost — same logic as agent-server, no ws://
       └─ PiAgentProvider

Renderer
  └─ IPC: agent.send, agent.subscribe, agent.abort
```

| Package | Change |
|---------|--------|
| `agent-server` | Extract **core** (`ConnectionManager`, `WsRouter` logic) into **`agent-host`** usable without `ws` |
| `apps/desktop` | Replace `agent-client.ts` WS with preload IPC |
| `electron/agent-server-lifecycle.ts` | Start host in main, not HTTP server |

**Keep:** `agent-core`, `pi-provider`, `agent-metadata` (until Convex cache supersedes message cache).

**Tests:** Existing `@h3code/agent-server` tests → drive `agent-host` API without opening a port.

### Track 2 — Convex as desktop display cache (optional)

**Goal:** Instant transcript on app launch; reactive updates if multi-window later.

- Desktop writes same H3Code-shaped chunks to Convex (`execution: "local"`).
- On load: subscribe to `messages` before PI reconnect completes.
- On send: `ensureProviderConnected(sessionId)` using stored `providerSessionRef`.

Does **not** replace PI as canonical runtime memory while a session is live. See [Convex schema](./h3code-convex-schema.md).

**Product rule (MVP):** Desktop session list filters `execution: "local"` only—no cloud session resume on desktop unless explicitly added.

### Track 3 — Native workspace tools (`h3-tools`)

**Goal:** H3-owned tool implementations (read file, apply patch, run command) for a future harness.

```txt
packages/h3-tools/
  readFile(repoPath, path)
  applyPatch(repoPath, patch)
  runCommand(repoPath, cmd, cwd?)
```

Invoked from Electron main or a trusted Node sidecar with repo boundary checks.

**Blocked for PI-only mode** unless PI exposes custom tool registration—Track 3 pairs with Track 4.

### Track 4 — Own harness (`h3-harness`)

**Goal:** Pattern B—H3 runs the agent loop (e.g. AI SDK `streamText` + tools) in the host process or sidecar.

- Implements `AgentProvider` with `id: "h3"`.
- Uses `h3-tools` for filesystem/terminal.
- PI becomes optional provider alongside `"pi"`, `"claude-code"`, etc.

**Cost:** Owning agent quality, eval, compaction, tool design—only when wrapping PI is insufficient.

### Track 5 — Shell alternatives

| Shell | Notes |
|-------|--------|
| **Electron** (current) | Chromium + Node; heaviest; best known |
| **Tauri 2** | Rust + system WebView; smaller binary; bridge rewrite |
| **zero-native** (`apps/desktop-zero`) | Zig + WebView/CEF; experimental in repo |

Only affects window/IPC layer if SPA is shared—[unified client](./h3code-unified-client.md).

### Track 6 — Desktop cloud client

Electron loads unified SPA with `runtime: "desktop"` for **local** and later a **session mode** toggle:

- **Local** — Track 1 + PI.
- **Cloud** — Convex + Daytona; no local repo (Cursor dropdown parity).

No second UI codebase; cloud backend unchanged.

## Package Map (Target State)

```txt
packages/
  agent-core/       # unchanged contract
  pi-provider/      # PI adapter (local + sandbox)
  agent-metadata/   # prefs, repo index (shrink if Convex cache wins)
  agent-host/       # NEW: in-process routing, no WebSocket (split from agent-server)
  agent-server/     # KEEP for tests, remote clients, or deprecate after migration
  h3-tools/         # NEW (Track 3+): repo-scoped tool impl
  h3-harness/       # NEW (Track 4+): AI SDK loop implementing AgentProvider
  app-shell/        # shared UI (with unified client)
  runtime-desktop/  # IPC + local hooks
```

## What Not to Do Prematurely

- Merge cloud orchestration into Electron main—cloud stays Convex + Daytona.
- Delete `pi-provider` when adding `h3-harness`—wrappers remain valuable.
- Rewrite VS Code fork—out of scope for H3Code product shape.

## Suggested Order

1. Cloud MVP on Vercel (`apps/cloud`, Convex, Daytona, PI in sandbox).
2. TanStack `app-shell` + cloud runtime.
3. Electron hosts SPA + desktop runtime (local folder, Agent Server).
4. Track 1 — IPC / in-process host (snappiness).
5. Track 2 — Convex desktop cache (if reload pain remains).
6. Tracks 3–4 only with clear harness strategy.
7. Track 6 — desktop cloud mode when cloud is stable.

## Acceptance (Track 1 Example)

- [ ] No open TCP port for agent in normal desktop use.
- [ ] Send prompt, stream, steer, abort parity with current WS behavior.
- [ ] Folder picker and session switch unchanged from user perspective.
- [ ] `npm run test --workspace @h3code/agent-server` (or agent-host) still pass.

## Open Questions

- `utilityProcess` vs main-thread host for PI CPU isolation?
- Single-flight lock: one active run per session on desktop when multi-window?
- When to retire Svelte `apps/desktop` renderer entirely?
