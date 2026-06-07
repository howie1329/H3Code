# H3Code — Agent Guidance

<!-- agentkit:start agents -->
H3Code is a local desktop workbench for coding agents: an Electron + SvelteKit UI that talks to a local Agent Server over WebSocket. PI Agent is the current provider; the Agent Server exposes one H3Code-owned protocol that can grow to support multiple providers.

Read `STACK.md` before stack-specific changes. Read companion docs only when the task touches that area.

## Project Map

```txt
apps/
  desktop/        # Primary product — Electron + SvelteKit desktop workbench
  desktop-zero/   # Experimental Zig desktop shell
  web/            # SvelteKit marketing site
  cloud/          # TanStack React Start + Convex + Clerk SaaS path
packages/
  agent-core/     # Provider-neutral H3Code protocol and contracts
  agent-server/   # Local Node/WebSocket server
  agent-metadata/ # Local metadata, preferences, SQLite index
  pi-provider/    # In-process PI SDK provider
docs/             # Product specs, architecture, implementation notes
DESIGN.md         # UI/design tokens and component guidance (Linear baseline)
```

Key product docs:

- `docs/h3code-agent-server-product.md` — Agent Server product direction
- `docs/h3code-desktop-mvp.md` — current desktop MVP boundary
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
npm run check --workspace @h3code/agent-core
npm run check --workspace @h3code/agent-server
npm run test --workspace @h3code/agent-server
```

Desktop app also has targeted Node test scripts (`test:pi-session`, `test:agent-lib`, etc.) under `apps/desktop`.

## Workflow Expectations

- Prefer existing repository patterns over generic generated patterns.
- Keep changes scoped and reviewable; match the style of surrounding code.
- H3Code owns the local experience; providers own sessions, transcripts, and runtime behavior. Do not persist provider-owned transcripts in H3Code.
- Do not change foundational architecture, schema, dependencies, or theme primitives without explicit approval.
- Read relevant docs in `docs/` before large feature or boundary changes.
- For UI work, follow `DESIGN.md` and existing shadcn-svelte / Bits UI patterns in `apps/desktop/src/lib/components/`.

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
