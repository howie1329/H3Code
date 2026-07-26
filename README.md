# H3Code

H3Code is a coding-agent workbench for developers who want one focused place to work with local repositories first and cloud workspaces later. H3Code owns the workbench: repository context, sessions, transcript presentation, terminals, previews, diffs, Git workflows, and product state. The selected agent runtime owns its own execution behavior and canonical session state.

The project is in an active productization transition:

- The desktop app is usable today with PI through the legacy local WebSocket runtime.
- The cloud app has working authentication, GitHub repository selection, Convex-backed sessions/messages, and asynchronous Daytona sandbox provisioning.
- The next execution boundary is a shared AI SDK-compatible UI stream (`UIMessage` + `useChat`) with thin runtime adapters. The legacy `agent-protocol` / `agent-runtime*` packages are migration-only and should not receive new product features.

## Product surfaces

| Surface | Current state | Direction |
| --- | --- | --- |
| Desktop | Electron + SvelteKit workbench; local folder selection; PI sessions; streaming transcript; tool activity; steer/follow-up; abort; metadata and preferences | Shared workbench with Codex app-server and PI SDK execution paths, then terminal/preview/diff/Git depth |
| Cloud | TanStack Start + React; Clerk auth; GitHub connection and curated repos; Convex sessions/messages; Daytona provisioning | Codex-first remote workspace with durable sessions, terminal/preview, diff, commit, push, and PR workflow |
| Web | SvelteKit marketing site in `apps/web` | Marketing and product education surface |
| Desktop Zero | Experimental Zig/native shell in `apps/desktop-zero` | Explore lighter desktop shells after the flagship desktop workflow is stable |

## Architecture at a glance

Current desktop path:

```txt
Svelte renderer
  -> RuntimeClient (WebSocket)
    -> @h3code/agent-runtime-server (localhost)
      -> AgentRuntime
        -> PI provider adapter
```

Target product boundary:

```txt
Workbench UI (UIMessage + useChat)
  <-> transport / IPC
    <-> thin H3Code execution adapter
      -> Codex app-server | PI SDK | future supported runtime
        -> local repo or cloud sandbox
```

H3Code should not become a second agent loop or canonical transcript store. Local SQLite and Convex may cache product metadata and display messages for reload, while the selected runtime remains authoritative for live continuation.

## Repository map

```txt
apps/
  desktop/        # Primary Electron + SvelteKit desktop workbench
  cloud/          # TanStack React Start + Clerk + Convex cloud workbench
  web/            # SvelteKit marketing site
  desktop-zero/   # Experimental Zig shell
packages/
  agent-provider-pi/         # PI execution wiring; migration target is thin adapter code
  agent-metadata/            # Local SQLite repos, preferences, session index, optional cache
  agent-protocol/            # Legacy protocol; freeze during migration
  agent-runtime/             # Legacy runtime/projector; freeze during migration
  agent-runtime-ws/          # Legacy WebSocket transport; freeze during migration
  agent-runtime-persistence/ # Legacy runtime persistence; freeze during migration
  agent-runtime-server/      # Legacy desktop composition; freeze during migration
PRODUCT.md                   # Product brief and product boundaries
docs/
  h3code-roadmap.md          # Sequenced roadmap and exit criteria
  h3code-product-direction.md # Strategic direction and business-model decisions
```

## Read next

- [Product brief](PRODUCT.md) — who H3Code is for, what it owns, and what success means.
- [Roadmap](docs/h3code-roadmap.md) — current phase, next milestones, and decision gates.
- [Product direction](docs/h3code-product-direction.md) — subscription-first desktop and Codex-first cloud strategy.
- [Platform vision](docs/h3code-platform-vision.md) — desktop/cloud product model and shared client direction.
- [AI SDK and execution architecture](docs/h3code-ai-sdk-harness-architecture.md) — target UI boundary and migration constraints.
- [Desktop MVP](docs/h3code-desktop-mvp.md) — detailed local desktop behavior and acceptance criteria.
- [Cloud PRD](docs/h3code-cloud-saas-prd.md) — cloud workspace scope and implementation notes.

Older runtime architecture documents remain useful for understanding the current implementation, but they are not the target for new work:

- [Legacy runtime/read-model architecture](docs/h3code-runtime-read-model-architecture.md)
- [Legacy agent-server product](docs/h3code-agent-server-product.md)

## Local development

Install dependencies:

```bash
npm install
```

Run the primary surfaces:

```bash
npm run dev:desktop
npm run dev:cloud
npm run dev:web
```

Run repository-wide validation:

```bash
npm run check
npm run lint
npm run build
```

Useful focused checks:

```bash
npm run check:cloud
npm run build:cloud
npm run test:runtime-client --workspace @h3code/desktop
npm run test:agent-lib --workspace @h3code/desktop
npm run test:transcript-normalize --workspace @h3code/desktop
npm run test --workspace @h3code/agent-runtime-server
```

Cloud setup and environment requirements are documented in [apps/cloud/README.md](apps/cloud/README.md). Desktop behavior and runtime migration details are documented under `docs/`.
