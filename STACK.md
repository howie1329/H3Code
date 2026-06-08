# H3Code — Stack Guidance

<!-- agentkit:start stack -->
Monorepo managed with npm workspaces and Turborepo. Primary product is the Electron desktop app; cloud and web apps are secondary surfaces sharing `@h3code/agent-protocol`.

## Workspace Layout

| Path | Stack | Role |
| --- | --- | --- |
| `apps/desktop` | Electron, SvelteKit 2, Svelte 5, Vite, Tailwind 4, shadcn-svelte | Primary desktop workbench |
| `apps/web` | SvelteKit, Vite, Tailwind 4, shadcn-svelte | Marketing site |
| `apps/cloud` | TanStack React Start, React 19, Convex, Clerk, Tailwind 4, Vitest | Cloud workbench (GitHub sync live; agent sessions planned) |
| `apps/desktop-zero` | Zig | Experimental native shell |
| `packages/agent-protocol` | TypeScript | Protocol, runtime events, read models, provider contracts |
| `packages/agent-runtime` | TypeScript | Runtime bindings, event ingestion, read-model projection |
| `packages/agent-runtime-ws` | Node, `ws`, TypeScript | Runtime WebSocket transport |
| `packages/agent-runtime-persistence` | TypeScript, SQLite | Runtime read-model and binding persistence |
| `packages/agent-runtime-server` | Node, `ws`, TypeScript | Local runtime server composition |
| `packages/agent-metadata` | TypeScript, SQLite | Local metadata and preferences |
| `packages/agent-provider-pi` | TypeScript | In-process PI SDK provider adapter |

## Architecture Boundaries

Desktop data flow:

```txt
Svelte renderer → RuntimeClient (WebSocket) → @h3code/agent-runtime-server → AgentRuntime → PiProviderAdapter
```

- **Providers** own sessions, message history, tools, models, queueing, compaction, and retry.
- **H3Code** owns desktop UI, local server orchestration, repo/workspace context, metadata indexing, and preferences.
- Keep renderer types provider-neutral above the H3Code WebSocket protocol; render server-projected `SessionReadModel` state instead of provider-native shapes.

Cloud app (`apps/cloud`):

- Frontend in `apps/cloud/src/` (TanStack Router/Start, React 19).
- Backend in `apps/cloud/convex/` (`auth.config.ts`, `schema.ts`, `github.ts`, `workspaceRepositories.ts`, `sessions.ts`, `users.ts`).
- Auth: `@clerk/tanstack-react-start` + `ConvexProviderWithClerk`; JWT validated via `CLERK_JWT_ISSUER_DOMAIN` in Convex env.
- GitHub (MVP): Clerk OAuth token retrieved server-side in `src/integrations/github/server.ts`; connection metadata in `githubConnections`; workspace repos in `workspaceRepositories`; GitHub catalog fetched on demand for the add-repository dialog.
- Convex tables today: `users`, `githubConnections`, `workspaceRepositories`, `sessions`, `messages`. Deferred: `runs`, `control`, `diffs`, `usageEvents` — see `docs/h3code-convex-schema.md`.
- Env template: `apps/cloud/.env.example` (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `VITE_CONVEX_URL`).

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

**Cloud (`apps/cloud`)**

- Routes: `apps/cloud/src/routes/` (`/sign-in`, `/app`, `/app/settings`, `/app/sessions/$sessionId`)
- Integrations: `apps/cloud/src/integrations/clerk/`, `convex/`, `github/`
- Shared UI: `apps/cloud/src/components/ui/` (shadcn-compatible)
- AI elements: `apps/cloud/src/components/ai-elements/`
- App shell: `apps/cloud/src/components/app-shell/`, `workspace/`

**Packages**

- Build with `tsc`; exports from `src/`, compiled output in `dist/`
- Runtime package tests compile to `dist-test/` and run with Node's test runner

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
npm run test --workspace @h3code/agent-runtime-server
```

Desktop targeted tests (from `apps/desktop` workspace):

```bash
npm run test:agent-lib --workspace @h3code/desktop
npm run test:transcript-normalize --workspace @h3code/desktop
npm run test:runtime-client --workspace @h3code/desktop
```

Run checks for the narrowest workspace you touched before handoff.

## Stack Notes

- Package manager: npm (`packageManager: npm@11.11.0`).
- UI styling: Tailwind CSS v4; desktop/web use shadcn-svelte and Bits UI.
- Design tokens and component rules: see root `DESIGN.md`.
- Config lists `preset: next`, but this repo has no Next.js app. Treat it as a multi-app fullstack monorepo (SvelteKit desktop/web, TanStack + Convex cloud).
<!-- agentkit:end stack -->
