# H3Code

H3Code is a local desktop workbench for coding agents. Today it is an Electron and SvelteKit desktop UI that talks to a local Agent Server over WebSocket. PI Agent is the current working provider; the Agent Server gives the UI one H3Code-owned protocol that can grow to support multiple providers.

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
  -> AgentClient (WebSocket)
    -> @h3code/agent-server (localhost)
      -> PiAgentProvider (@h3code/pi-provider, in-process PI SDK)
```

Provider direction:

```txt
Svelte renderer
  -> local Agent Server WebSocket
    -> AgentProvider interface
      -> PiProvider / CodexProvider / CursorProvider
        -> actual provider runtime
```

The server packages now exist:

- `@h3code/agent-core` defines provider-neutral H3Code protocol and provider contracts.
- `@h3code/agent-server` provides the local Node/WebSocket server, routing, connection management, provider registry, and platform services.
- `@h3code/pi-provider` implements the current PI provider with the in-process PI SDK.
- `@h3code/agent-metadata` stores recent repos, indexed session metadata, desktop settings, and related local metadata.

Electron main now supervises the local server and native shell affordances. The legacy PI IPC path has been removed.

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

The desktop app currently implements the core PI provider loop through the Agent Server:

- Select a local repo with the native directory picker.
- Start the local Agent Server and connect the renderer over WebSocket.
- Create an in-process PI SDK provider session for the selected repo.
- List PI sessions for repos.
- Switch sessions and create new PI-owned sessions.
- Load PI state, messages, and session stats.
- Send prompts, steer, and follow-up messages through the H3Code WebSocket protocol.
- Abort active runs.
- Render transcript messages, streaming assistant output, tool blocks, runtime diagnostics, extension UI, and recent tool activity.

Still planned:

- Harden the local WebSocket boundary with startup auth and fuller payload validation.
- Continue removing PI-shaped renderer types above the provider-neutral protocol.
- Add Codex Server and Cursor providers behind the same H3Code protocol.

## Repository Shape

```txt
apps/
  desktop/       # Electron + SvelteKit desktop app
  web/           # SvelteKit marketing site
packages/
  agent-core/    # H3Code protocol, domain events, provider contracts
  agent-server/  # Local Node/WebSocket server
  agent-metadata/# Local metadata and desktop preferences
  pi-provider/   # In-process PI SDK provider
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
- In-process PI SDK provider for the current provider path
- SQLite metadata index and desktop settings (`@h3code/agent-metadata`)

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
