# H3Code — Stack Guidance

<!-- agentkit:start stack -->
Monorepo managed with npm workspaces and Turborepo. Primary product is the Electron desktop app; cloud and web apps are secondary surfaces sharing `@h3code/agent-core`.

## Workspace Layout

| Path | Stack | Role |
| --- | --- | --- |
| `apps/desktop` | Electron, SvelteKit 2, Svelte 5, Vite, Tailwind 4, shadcn-svelte | Primary desktop workbench |
| `apps/web` | SvelteKit, Vite, Tailwind 4, shadcn-svelte | Marketing site |
| `apps/cloud` | TanStack React Start, React 19, Convex, Clerk, Tailwind 4, Vitest | Cloud SaaS path |
| `apps/desktop-zero` | Zig | Experimental native shell |
| `packages/agent-core` | TypeScript | Protocol, domain events, provider contracts |
| `packages/agent-server` | Node, `ws`, TypeScript | Local WebSocket server |
| `packages/agent-metadata` | TypeScript, SQLite | Local metadata and preferences |
| `packages/pi-provider` | TypeScript | In-process PI SDK provider |

## Architecture Boundaries

Desktop data flow:

```txt
Svelte renderer → AgentClient (WebSocket) → @h3code/agent-server → PiAgentProvider
```

- **Providers** own sessions, message history, tools, models, queueing, compaction, and retry.
- **H3Code** owns desktop UI, local server orchestration, repo/workspace context, metadata indexing, and preferences.
- Keep renderer types provider-neutral above the H3Code WebSocket protocol; avoid reintroducing PI-shaped types in the UI layer.

Cloud app (`apps/cloud`):

- Frontend in `apps/cloud/src/` (TanStack Router/Start, React).
- Backend in `apps/cloud/convex/` (schema, auth config, functions).
- Clerk handles auth; Convex handles data and server functions.

## Source Conventions

**Desktop (`apps/desktop`)**

- Routes: `apps/desktop/src/routes/`
- Shared UI: `apps/desktop/src/lib/components/ui/` (shadcn-svelte)
- Desktop features: `apps/desktop/src/lib/components/desktop/`
- AI elements: `apps/desktop/src/lib/components/ai-elements/`
- Agent transport: `apps/desktop/src/lib/agent-client.ts`, `agent-transport.ts`
- Electron main: `apps/desktop/electron/`

**Web (`apps/web`)**

- SvelteKit routes and components under `apps/web/src/`

**Packages**

- Build with `tsc`; exports from `src/`, compiled output in `dist/`
- `@h3code/agent-server` tests compile to `dist-test/` and run with Node's test runner

## Validation

Root (all workspaces):

```bash
npm run check
npm run lint
npm run build
```

By surface:

```bash
npm run dev:desktop          # desktop development
npm run dev:web              # marketing site
npm run dev:cloud            # cloud + convex dev
npm run check:cloud          # cloud formatting/check
npm run test --workspace @h3code/cloud   # cloud vitest
npm run test --workspace @h3code/agent-server
```

Desktop targeted tests (from `apps/desktop` workspace):

```bash
npm run test:pi-session --workspace @h3code/desktop
npm run test:agent-lib --workspace @h3code/desktop
npm run test:transcript-normalize --workspace @h3code/desktop
npm run test:session-cache --workspace @h3code/desktop
```

Run checks for the narrowest workspace you touched before handoff.

## Stack Notes

- Package manager: npm (`packageManager: npm@11.11.0`).
- UI styling: Tailwind CSS v4; desktop/web use shadcn-svelte and Bits UI.
- Design tokens and component rules: see root `DESIGN.md`.
- Config lists `preset: next`, but this repo has no Next.js app. Treat it as a multi-app fullstack monorepo (SvelteKit desktop/web, TanStack + Convex cloud).
<!-- agentkit:end stack -->
