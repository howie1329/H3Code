# H3Code — Agent Guidance

<!-- agentkit:start agents -->
H3Code is a coding-agent platform with two active surfaces: a **desktop workbench** (Electron + SvelteKit + local runtime server over WebSocket) and a **cloud workbench** (`apps/cloud`: TanStack React Start + Clerk + Convex). PI Agent is the current provider on desktop through `@h3code/agent-provider-pi`; `@h3code/agent-protocol` defines the provider-neutral protocol shared across surfaces.

Read `STACK.md` before stack-specific changes. Read companion docs only when the task touches that area.

## Project Map

```txt
apps/
  desktop/        # Primary product — Electron + SvelteKit desktop workbench
  desktop-zero/   # Experimental Zig desktop shell
  web/            # SvelteKit marketing site
  cloud/          # TanStack React Start + Clerk + Convex cloud workbench
packages/
  agent-protocol/            # Provider-neutral H3Code protocol and contracts
  agent-runtime/             # Runtime bindings, event ingestion, read-model projection
  agent-runtime-ws/          # WebSocket transport
  agent-runtime-persistence/ # Runtime read-model persistence
  agent-runtime-server/      # Local runtime server composition
  agent-provider-pi/         # In-process PI SDK provider adapter
  agent-metadata/            # Local metadata, preferences, SQLite index
docs/             # Product specs, architecture, implementation notes
DESIGN.md         # UI/design tokens and component guidance (Linear baseline)
```

Key product docs:

- `docs/h3code-agent-server-product.md` — local runtime server product direction
- `docs/h3code-desktop-mvp.md` — current desktop MVP boundary
- `docs/h3code-cloud-saas-prd.md` — cloud SaaS scope and MVP boundary
- `docs/h3code-convex-schema.md` — Convex data model for cloud sessions
- `docs/h3code-unified-client.md` — shared client/runtime model (desktop vs cloud)
- `docs/h3code-platform-vision.md` — platform-wide direction
- `README.md` — repository overview and local development

## Commands

Root scripts (npm workspaces + Turborepo):

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev` | Run all workspace dev tasks |
| `npm run build` | Build all workspaces |
| `npm run check` | Typecheck / validate all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run dev:desktop` | Desktop app (Electron + SvelteKit renderer) |
| `npm run dev:web` | Marketing SvelteKit site |
| `npm run dev:cloud` | Cloud app + Convex dev |
| `npm run build:cloud` | Build cloud workspace |
| `npm run check:cloud` | Check cloud workspace |
| `npm run dev:desktop-zero` | Zig desktop experiment |
| `npm run build:desktop-zero` | Build desktop-zero |
| `npm run check:desktop-zero` | Test desktop-zero |

Workspace-specific examples:

```bash
npm run check --workspace @h3code/agent-protocol
npm run test --workspace @h3code/agent-runtime
npm run test --workspace @h3code/agent-runtime-server
```

Desktop app also has targeted Node test scripts (`test:runtime-client`, `test:agent-lib`, etc.) under `apps/desktop`.

## Workflow Expectations

- Prefer existing repository patterns over generic generated patterns.
- Keep changes scoped and reviewable; match the style of surrounding code.
- **Desktop:** H3Code owns the local experience; providers own sessions, transcripts, and runtime behavior. Do not persist provider-owned transcripts in the desktop app.
- **Cloud:** Convex owns durable session/transcript persistence for the cloud product (see `docs/h3code-cloud-saas-prd.md`). Clerk OAuth tokens and GitHub API access stay server-side only.
- Do not change foundational architecture, schema, dependencies, or theme primitives without explicit approval.
- Read relevant docs in `docs/` before large feature or boundary changes.
- For **desktop/web UI**, follow `DESIGN.md` and shadcn-svelte / Bits UI in `apps/desktop/src/lib/components/` or `apps/web/src/lib/components/`.
- For **cloud UI**, use shadcn-compatible components in `apps/cloud/src/components/ui/`; add new components from `apps/cloud` (where `components.json` lives).

## Companion Docs

| File | Read when |
| --- | --- |
| `STACK.md` | Framework boundaries, app/package layout, validation |
| `CODE-QUALITY.md` | Review, refactor, maintainability |
| `CHANGE-EXPLANATION.md` | Final handoff and developer-facing summary |
| `DESIGN.md` | UI, styling, layout, components |
| `.github/pull_request_template.md` | Opening or reviewing PRs |

## Safety Rules

- Do not commit secrets, `.env` values, or credentials.
- Do not modify lockfiles, root `package.json`, or CI config unless the task explicitly requires it.
- Do not invent npm scripts; use only scripts defined in workspace `package.json` files.
- Preserve user content outside AgentKit managed blocks in guidance files.

## Before Finishing

- Run the narrowest relevant checks for changed workspaces (`check`, `lint`, `build`, or workspace tests).
- Summarize changed files, checks run, risks, and review focus.
- Call out skipped checks or remaining uncertainty.
- Follow `CHANGE-EXPLANATION.md` for handoff quality when completing substantive work.
<!-- agentkit:end agents -->
