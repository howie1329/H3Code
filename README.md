# H3Code

H3Code is a local desktop workbench for coding agents. Today it is an Electron and SvelteKit desktop UI around PI Agent in RPC mode. The architecture is evolving toward a local Agent Server that gives the UI one H3Code-owned protocol for multiple providers.

PI remains the current working provider and the source of truth for sessions, messages, tool execution, model behavior, queueing, compaction, and retry. H3Code owns the local experience around that runtime: repo selection, process lifecycle, connection diagnostics, UI state, rendering, metadata indexing, and preferences.

The web and marketing app are preserved in `apps/web`.

Start with:

- [docs/h3code-agent-server-product.md](docs/h3code-agent-server-product.md) — product direction for the Agent Server architecture.
- [docs/agent-server-architecture.html.html](docs/agent-server-architecture.html.html) — visual/reference architecture proposal.
- [docs/h3code-desktop-mvp.md](docs/h3code-desktop-mvp.md) — current PI desktop MVP boundary.

## Current State vs Direction

Current desktop path:

```txt
Svelte renderer
  -> preload IPC bridge
    -> Electron main process
      -> pi --mode rpc subprocess
```

Target direction:

```txt
Svelte renderer
  -> local Agent Server WebSocket
    -> AgentProvider interface
      -> PiProvider / CodexProvider / CursorProvider
        -> actual provider runtime
```

The first server packages now exist:

- `@h3code/agent-core` defines provider-neutral H3Code protocol and provider contracts.
- `@h3code/agent-server` provides a local Node/WebSocket server skeleton with a temporary noop provider.

The desktop app still uses the existing PI IPC path until PI provider extraction and UI WebSocket migration are complete.

## Product Boundary

Providers own:

- Sessions and canonical message history.
- Agent runtime behavior, tools, models, queueing, compaction, and retry.
- Provider-native IDs, files, authentication, and execution details.

H3Code owns:

- Desktop and future local-client UI.
- Local Agent Server orchestration.
- Provider selection and capability-gated UI.
- Repo/workspace context, git diff, worktree inventory, and metadata indexing.
- Minimal local preferences.

H3Code should not persist transcripts or become the source of truth for provider-owned sessions.

## Current Desktop Status

The desktop app currently implements the core PI RPC loop:

- Select a local repo with the native directory picker.
- Launch `pi --mode rpc` with that repo as the subprocess working directory.
- List PI sessions for repos.
- Switch sessions and create new PI-owned sessions.
- Load PI state, messages, and session stats.
- Send prompts, steer, and follow-up messages through PI RPC.
- Abort active runs.
- Render transcript messages, streaming assistant output, tool blocks, runtime diagnostics, extension UI, and recent tool activity.

Still planned:

- Extract PI subprocess/RPC handling into `PiProvider`.
- Switch desktop UI commands/events from preload IPC to local Agent Server WebSocket.
- Add Codex App Server and Cursor providers behind the same H3Code protocol.

## Repository Shape

```txt
apps/
  desktop/       # Electron + SvelteKit desktop app
  web/           # SvelteKit marketing site
packages/
  agent-core/    # H3Code protocol, domain events, provider contracts
  agent-server/  # Local Node/WebSocket server skeleton
docs/
  h3code-agent-server-product.md
  agent-server-architecture.html.html
  h3code-desktop-mvp.md
  SvelteKitAiElements.md
  SvelteKitShadcn.md
```

## Stack

- Electron
- SvelteKit
- TypeScript
- Tailwind CSS
- shadcn-svelte / Bits UI
- Node.js + `ws` for the local Agent Server
- PI Agent RPC over stdin/stdout JSONL for the current provider path
- SQLite metadata index and desktop settings (`apps/desktop/electron/preferences.ts`)

## Local Development

Install dependencies:

```bash
npm install
```

Run all workspace dev tasks:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run dev:desktop
```

Run the web app:

```bash
npm run dev:web
```

Run checks:

```bash
npm run check
npm run lint
npm run build
```

Package-specific checks:

```bash
npm run check --workspace @h3code/agent-core
npm run check --workspace @h3code/agent-server
npm run test --workspace @h3code/agent-server
```
