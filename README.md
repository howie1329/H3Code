# H3Code

H3Code is an MVP-stage local desktop UI shell for PI Agent in RPC mode.

The desktop app is an Electron and SvelteKit wrapper around PI Agent. PI owns the agent runtime, sessions, messages, tool execution, model behavior, queueing, compaction, and retry. H3Code owns the local desktop experience around that runtime: process lifecycle, repo selection, connection diagnostics, UI state, rendering, and minimal preferences.

The web and marketing app are preserved in `apps/web`.

The canonical MVP brief lives in [docs/h3code-desktop-mvp.md](docs/h3code-desktop-mvp.md).

## Product Direction

H3Code Desktop should be a local UI wrapper around PI Agent, not a replacement for it.

PI Agent owns:

- Sessions and canonical message history.
- Agent behavior, tools, model behavior, queueing, compaction, and retry.
- Tool execution state and results.

H3Code owns:

- Electron process lifecycle.
- PI RPC connection state and diagnostics.
- Repo/workspace selection.
- UI state and rendering.
- Minimal local preferences.

## Current Desktop Status

The desktop app currently implements the core PI RPC loop:

- Select a local repo with the native directory picker.
- Launch `pi --mode rpc` with that repo as the subprocess working directory.
- List PI sessions for repos.
- Switch sessions and create new PI-owned sessions.
- Load PI state, messages, and session stats.
- Send prompts and follow-up prompts through PI RPC.
- Abort active runs.
- Render transcript messages, streaming assistant output, tool blocks, runtime diagnostics, and recent tool activity.

Still planned:

- Persist recent repos, last selected repo/session, and desktop preferences.
- Make the PI executable path configurable instead of hardcoded to `pi`.
- Replace placeholder Repos, Sessions, and Activity pages with full product surfaces.
- Wire up global search.
- Improve full live activity/tool timeline rendering.

## Architecture

```txt
Svelte renderer
  -> preload IPC bridge
    -> Electron main process
      -> pi --mode rpc subprocess
```

Important desktop files:

- `apps/desktop/electron/main.ts` — Electron window, PI subprocess lifecycle, JSONL RPC framing, IPC handlers.
- `apps/desktop/electron/preload.ts` — safe renderer-facing desktop API.
- `apps/desktop/src/lib/desktop-state.svelte.ts` — centralized renderer state for repos, sessions, messages, status, activity, and stats.
- `apps/desktop/src/lib/components/desktop/` — desktop shell, sidebar, transcript, composer, context panel, and page primitives.
- `apps/desktop/src/routes/` — SvelteKit routes for workspace, repos, sessions, activity, and settings.

## MVP Focus

The desktop rebuild proves one loop:

1. Select a local repo.
2. Launch or connect to `pi --mode rpc` with that repo as the working directory.
3. Load PI state and messages with `get_state` and `get_messages`.
4. Send prompts through PI RPC.
5. Stream assistant output and tool activity into the UI.
6. Abort active runs and start fresh PI-owned sessions.

The MVP explicitly defers SQL indexing, multi-provider support, Codex support, custom message storage, custom session storage, and app-owned transcript persistence.

## Current Repository Shape

```txt
apps/
  desktop/       # Electron + SvelteKit desktop app
  web/           # SvelteKit marketing site
docs/
  h3code-desktop-mvp.md
  SvelteKitAiElements.md
  SvelteKitShadcn.md
```

## Desktop Stack

- Electron
- SvelteKit
- TypeScript
- Tailwind CSS
- shadcn-svelte / Bits UI
- PI Agent RPC over stdin/stdout JSONL
- Minimal local JSON preferences for desktop settings, planned

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

Desktop-specific scripts are defined in `apps/desktop/package.json`.
