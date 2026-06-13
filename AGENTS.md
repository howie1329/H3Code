# H3Code — Agent Guidance

<!-- agentkit:start agents -->
H3Code is a coding-agent **workbench** with two surfaces: **desktop** (Electron + SvelteKit, migrating to AI SDK Harness) and **cloud** (`apps/cloud`: TanStack React Start + Clerk + Convex). **Target agent stack:** AI SDK `HarnessAgent` + `@ai-sdk/harness-pi`; UI boundary is `UIMessage` from the `ai` package—not `@h3code/agent-protocol` / `SessionReadModel`. Read `Docs/h3code-ai-sdk-harness-architecture.md` before agent or package work. Legacy `agent-runtime*` packages exist only until desktop migrates.

Read `STACK.md` before stack-specific changes. Read companion docs only when the task touches that area.

## Project Map

```txt
apps/
  desktop/        # Primary product — Electron + SvelteKit desktop workbench
  desktop-zero/   # Experimental Zig desktop shell
  web/            # SvelteKit marketing site
  cloud/          # TanStack React Start + Clerk + Convex cloud workbench
packages/
  agent-provider-pi/         # Target: HarnessAgent + Pi + sandbox factories
  agent-metadata/            # Local SQLite: repos, prefs, session index, optional UIMessage cache
  sandbox-daytona/           # Planned: Daytona HarnessV1SandboxProvider (cloud)
  agent-protocol/            # Legacy — do not extend
  agent-runtime/             # Legacy — do not extend
  agent-runtime-ws/            # Legacy — do not extend
  agent-runtime-persistence/   # Legacy — do not extend
  agent-runtime-server/      # Legacy — do not extend
docs/             # Product specs, architecture, implementation notes
DESIGN.md         # UI/design tokens and component guidance (Linear baseline)
```

Key product docs:

- `Docs/h3code-ai-sdk-harness-architecture.md` — target agent stack (Harness + UIMessage)
- `Docs/h3code-platform-vision.md` — platform-wide direction
- `Docs/h3code-unified-client.md` — shared client (desktop vs cloud)
- `Docs/h3code-cloud-saas-prd.md` — cloud SaaS scope
- `Docs/h3code-convex-schema.md` — Convex data model
- `Docs/h3code-desktop-mvp.md` — desktop MVP boundary
- `Docs/h3code-agent-server-product.md` — legacy runtime server (superseded)
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
- **Desktop:** H3Code owns the workbench and `agent-metadata`; harness sessions own live agent state. Optional SQLite `UIMessage` snapshots for fast reload only—not a canonical transcript store.
- **Cloud:** Convex owns durable session rows and `UIMessage` transcript persistence (see `Docs/h3code-cloud-saas-prd.md`). Harness `resumeFrom` blobs live server-side. Clerk OAuth tokens and GitHub API access stay server-side only.
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
