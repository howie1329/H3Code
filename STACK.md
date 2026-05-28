# H3 Code Stack

Concise stack and architecture reference for agents and contributors. Operating rules live in `AGENTS.md`.

## Repository Layout

```txt
apps/
  desktop/       # Electron + SvelteKit desktop app (@h3code/desktop)
  web/           # SvelteKit marketing site (@h3code/web)
packages/
  agent-core/    # Provider-neutral H3Code protocol and provider contracts
  agent-server/  # Local Node/WebSocket Agent Server skeleton
docs/
  h3code-agent-server-product.md
  agent-server-architecture.html.html
  h3code-desktop-mvp.md
  SvelteKitShadcn.md
  SvelteKitAiElements.md
```

Turborepo orchestrates workspace scripts from the repo root (`package.json` workspaces: `apps/*`, `packages/*`).

## Product Boundary

**Providers** own sessions, messages, tools, models, queueing, compaction, retry, auth, and runtime behavior. PI is the current working provider.

**H3Code** owns the local desktop and server experience: UI, local orchestration, provider selection, repo/workspace context, metadata indexing, git/worktree services, connection diagnostics, and minimal preferences.

H3Code does not own canonical transcripts or provider-native sessions.

The web app (`apps/web`) is a marketing site, not the agent runtime.

## Current Desktop Architecture

Today the desktop app still uses the original PI path:

```txt
Svelte renderer
  -> preload IPC bridge
    -> Electron main process
      -> pi --mode rpc subprocess
```

PI communicates over stdin/stdout JSONL RPC. H3Code stores **session-list metadata** (recent repos, indexed session summaries, UI toggles) in local SQLite (`h3code.sqlite` under Electron user data), not transcripts or messages.

## Target Agent Server Architecture

The target architecture moves agent orchestration behind a local server:

```txt
Svelte renderer
  -> local Agent Server WebSocket
    -> AgentProvider interface
      -> PiProvider / CodexProvider / CursorProvider
        -> actual provider runtime
```

`@h3code/agent-core` owns the H3Code protocol and provider contracts. `@h3code/agent-server` owns the local Node/WebSocket server, connection manager, provider registry, and platform services. Provider packages will translate provider-native protocols into H3Code domain events.

## Key Desktop Files

| Path | Role |
| --- | --- |
| `apps/desktop/electron/main.ts` | Current Electron window, PI subprocess lifecycle, JSONL RPC framing, IPC handlers |
| `apps/desktop/electron/preferences.ts` | SQLite metadata index and desktop settings |
| `apps/desktop/electron/preload.ts` | Current renderer-facing desktop API |
| `apps/desktop/src/lib/desktop-state.svelte.ts` | Central renderer state (repos, sessions, messages, status, activity) |
| `apps/desktop/src/lib/components/desktop/` | Shell, sidebar, transcript, composer, context panel |
| `apps/desktop/src/routes/` | SvelteKit routes (workspace, settings, root redirect) |

## Key Package Files

| Path | Role |
| --- | --- |
| `packages/agent-core/src/` | Shared protocol, IDs, session/run/message types, provider capabilities, provider interface |
| `packages/agent-server/src/server.ts` | Local HTTP/WebSocket server entrypoint |
| `packages/agent-server/src/ws-router.ts` | WebSocket command routing |
| `packages/agent-server/src/connection-manager.ts` | Connection ID to provider connection lifecycle |
| `packages/agent-server/src/noop-provider.ts` | Temporary provider used for server verification |
| `packages/agent-server/src/platform/` | Platform session delete, git diff, preferences |
| `packages/pi-provider/src/` | In-process PI SDK provider (`PiAgentProvider`) for WS mode |

### WS transport (`VITE_H3CODE_AGENT_TRANSPORT=ws`)

Desktop renderer talks to `@h3code/agent-server` over WebSocket (`apps/desktop/src/lib/agent-client.ts`). Provider metadata and platform inventory use additive protocol v1 messages:

- **Provider:** `provider.commands.list`, `provider.models.list`, `provider.queue.set`, `provider.compaction.set`
- **Platform:** `session.delete`, `workspace.diff` (on-demand reply + server push after `run.ended` / tool updates, ~300ms debounce)
- **Capabilities:** `server.ready.providers[].capabilities.ui` gates slash commands, model picker, queue modes, and compaction in the renderer (see `desktop-state.svelte.ts` `supports*` flags)

## Frameworks And Libraries

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron 39 |
| UI framework | SvelteKit 2, Svelte 5 |
| Language | TypeScript 5.9 |
| Build | Vite 7, Turborepo |
| Styling | Tailwind CSS v4, shadcn-svelte, Bits UI, Hugeicons |
| Current agent integration | PI Agent RPC (`pi --mode rpc`); `@earendil-works/pi-coding-agent` in desktop deps |
| Target server integration | Node.js HTTP + `ws`, using `@h3code/agent-core` contracts |
| Transcript UI | Vercel AI SDK (`ai`), Streamdown, Shiki |
| Verification | `svelte-check`, TypeScript package checks, Node tests for `@h3code/agent-server` |

## Local Development

```bash
npm install
npm run dev              # all workspaces
npm run dev:desktop      # desktop only
npm run dev:web          # web only (port 5174)
npm run check
npm run lint
npm run build
```

Package checks:

```bash
npm run check --workspace @h3code/agent-core
npm run check --workspace @h3code/agent-server
npm run test --workspace @h3code/agent-server
```

## Environment And External Tools

- `VITE_DEV_SERVER_URL` — desktop dev only; Electron loads the Vite dev server URL.
- `pi` on `PATH` — default for `pi --mode rpc`; override in desktop Settings (stored in SQLite `app_settings`).
- Model/API credentials — configured in the provider, not in H3Code `.env` files.

## Further Reading

- [README.md](README.md) — product direction and current status
- [docs/h3code-agent-server-product.md](docs/h3code-agent-server-product.md) — Agent Server product brief
- [docs/agent-server-architecture.html.html](docs/agent-server-architecture.html.html) — visual/reference architecture proposal
- [docs/h3code-desktop-mvp.md](docs/h3code-desktop-mvp.md) — current PI desktop MVP brief
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — UI tokens, layout, and per-app paths
- [docs/SvelteKitShadcn.md](docs/SvelteKitShadcn.md) — shadcn-svelte usage in this repo
