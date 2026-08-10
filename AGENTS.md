# H3Code — Agent Guidance

<!-- agentkit:start agents -->
H3Code is a desktop workbench for PI sessions against local repositories. The active product scope is intentionally narrow: Electron + SvelteKit, PI only, and local repositories only. Read `PRODUCT.md` before changing product boundaries and `STACK.md` before stack-specific work.

## Project Map

```text
apps/desktop/
  electron/               Electron main process and preload bridge
  src/routes/             SvelteKit renderer routes
  src/lib/components/ui/  Upstream shadcn-svelte component source
  src/app.css             Tailwind CSS imports and semantic theme tokens
docs/archive/             Historical pre-reset reference only
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install the root workspace and desktop dependencies |
| `npm run dev` | Run the Electron desktop app |
| `npm run dev:desktop` | Run the Electron desktop app explicitly |
| `npm run check` | Run Svelte and TypeScript validation |
| `npm run lint` | Run the configured desktop static checks |
| `npm run build` | Build the renderer and Electron main process |

Run shadcn-svelte CLI commands from `apps/desktop`. Add only the components needed by the current feature and review generated source before use.

## Architecture Boundaries

- PI owns the agent loop, tools, authentication, provider/model behavior, canonical sessions, and canonical transcripts.
- Electron main owns PI process lifecycle, filesystem access, and operating-system integration.
- Preload exposes a small typed API. The renderer receives product-safe data and never imports Node or Electron APIs directly.
- The renderer owns presentation and ephemeral UI state.
- Introduce persistence only when a concrete product slice requires it. Keep it to preferences and indexes; PI remains canonical for agent state.
- Build PI behavior directly. Do not add provider-neutral protocols or abstractions for hypothetical runtimes.

## UI Rules

- Follow `DESIGN.md` and use semantic Tailwind classes backed by `apps/desktop/src/app.css`.
- Use the fresh shadcn-svelte primitives in `apps/desktop/src/lib/components/ui/` before creating custom UI.
- Treat generated shadcn files as upstream source. Keep product composition outside the `ui` directory.
- Preserve the current theme variables unless the user explicitly approves a palette change.

## Companion Docs

| File | Read when |
| --- | --- |
| `PRODUCT.md` | Scope, ownership, milestones, or product decisions |
| `STACK.md` | Framework boundaries, paths, dependencies, or validation |
| `DESIGN.md` | UI, styling, layout, typography, or components |
| `CODE-QUALITY.md` | Review, refactor, test, or maintainability work |
| `CHANGE-EXPLANATION.md` | Substantive implementation handoff |
| `docs/archive/h3code-current-state-2026-08-10.md` | Historical context about the deleted system only |

## Safety

- Keep credentials and provider authentication out of the renderer and repository.
- Validate repository paths before using them as a process working directory.
- Do not invent scripts; use commands defined in `package.json`.
- Preserve user content outside AgentKit managed blocks.

## Before Finishing

- Run the narrowest relevant check and build commands.
- Add tests when behavior extends beyond simple presentation or framework wiring.
- Summarize changed files, checks run, skipped checks, risks, and the next product slice.
<!-- agentkit:end agents -->
