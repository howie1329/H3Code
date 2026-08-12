# H3Code — Agent Guidance

<!-- agentkit:start agents -->
H3Code is a local Electron + SvelteKit workbench for supervising concurrent coding-agent Threads across local Git repositories. Pi is the only Agent Runtime currently in scope; additional Runtime Integrations wait until the Pi loop is dependable. Read `PRODUCT.md` before changing product boundaries, `CONTEXT.md` for canonical vocabulary, and `STACK.md` before stack-specific work.

## Project Map

```text
apps/desktop/
  electron/               Electron main process and preload bridge
  src/routes/             SvelteKit renderer routes
  src/lib/components/ui/  Upstream shadcn-svelte component source
  src/app.css             Tailwind CSS imports and semantic theme tokens
docs/archive/             Historical pre-reset reference only
docs/adr/                 Durable architectural decisions
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

- Pi owns the agent loop, tools, authentication, model-provider behavior, native settings, canonical sessions, and canonical conversation history.
- Follow the BB-inspired Pi boundary: `packages/runtime-pi` hosts a pinned Pi SDK in a dedicated Node bridge process and translates native Pi commands and events.
- Load Pi's normal authentication, settings, packages, extensions, skills, prompts, themes, context files, custom models, and shell configuration through Pi services.
- The planned `packages/runtime-pi` package owns the bridge lifecycle, Pi Thread objects, streams, abort controllers, and resume handles. Electron main owns application lifecycle, filesystem and operating-system integration, and IPC exposure.
- Keep exactly one canonical Pi SDK session per Thread and never copy its conversation into an H3Code transcript.
- Preload exposes a small typed API. The renderer receives product-safe data and never imports Node or Electron APIs directly.
- The renderer owns presentation, selection, and ephemeral UI state; its navigation and component lifecycles never own an Active Turn.
- Keep persistence local and limited to preferences, Repository and Thread indexes, and required resume references. Pi remains canonical for conversation content and agent state.
- Validate a selected directory as part of a normal Git worktree and resolve its worktree root before using it as a runtime working directory.
- Multiple Threads may use one Shared Checkout. Present that risk without claiming per-Thread diff ownership or adding locks and automatic worktrees.
- Use deterministic H3Code-owned paths for H3Code-created Pi sessions. Discover and import existing terminal-created Pi sessions by reference without copying them.
- Treat H3Code's own Repository like any other Repository: Pi may modify it, but checks, development-instance startup, and replacement of the running app remain explicit user actions.
- Keep Follow-up and Steer explicit while a Turn is active. Present Pi-native approvals without inventing a second permission policy.
- Treat retry, compaction, and Follow-up queues as Pi-native behavior. H3Code presents them without creating competing semantics or state.
- Report the embedded Pi SDK version and configuration failures; never install a global Pi CLI or collect provider credentials.
- Keep exactly one canonical Pi JSONL file per Thread, whether it uses an H3Code-owned path or an imported native Pi path.
- Build only the Pi integration now. Keep the renderer contract to Pi-proven identity, state, events, prompt, abort, and capability flags; extract broader shared runtime contracts after a second real integration proves them.

## UI Rules

- Follow `DESIGN.md` and use semantic Tailwind classes backed by `apps/desktop/src/app.css`.
- Use the fresh shadcn-svelte primitives in `apps/desktop/src/lib/components/ui/` before creating custom UI.
- Treat generated shadcn files as upstream source. Keep product composition outside the `ui` directory.
- Preserve the current theme variables unless the user explicitly approves a palette change.

## Companion Docs

| File | Read when |
| --- | --- |
| `PRODUCT.md` | Scope, ownership, milestones, or product decisions |
| `CONTEXT.md` | Canonical domain terms for Runtime, Repository, Thread, and Turn behavior |
| `STACK.md` | Framework boundaries, paths, dependencies, or validation |
| `DESIGN.md` | UI, styling, layout, typography, or components |
| `CODE-QUALITY.md` | Review, refactor, test, or maintainability work |
| `CHANGE-EXPLANATION.md` | Substantive implementation handoff |
| `docs/adr/` | Architectural decisions affecting the changed area |
| `docs/archive/h3code-current-state-2026-08-10.md` | Historical context about the deleted system only |

## Safety

- Keep credentials and runtime/model-provider authentication out of the renderer and repository.
- Validate repository paths before using them as a process working directory.
- Do not invent scripts; use commands defined in `package.json`.
- Preserve user content outside AgentKit managed blocks.

## Before Finishing

- Run the narrowest relevant check and build commands.
- Add tests when behavior extends beyond simple presentation or framework wiring.
- Summarize changed files, checks run, skipped checks, risks, and the next product slice.
<!-- agentkit:end agents -->
