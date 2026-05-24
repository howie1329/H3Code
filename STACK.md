# H3 Code Stack

Concise stack and architecture reference for agents and contributors. Operating rules live in `AGENTS.md`.

## Repository Layout

```txt
apps/
  desktop/       # Electron + SvelteKit desktop app (@h3code/desktop)
  web/           # SvelteKit marketing site (@h3code/web)
docs/
  h3code-desktop-mvp.md
Docs/
  SvelteKitShadcn.md
  SvelteKitAiElements.md
```

Turborepo orchestrates workspace scripts from the repo root (`package.json` workspaces: `apps/*`, `packages/*`).

## Product Boundary

**PI Agent** owns sessions, messages, tools, models, queueing, compaction, and retry.

**H3Code** owns the local desktop experience: Electron lifecycle, PI RPC connection, repo selection, UI state/rendering, and minimal preferences.

The web app (`apps/web`) is a marketing site, not the agent runtime.

## Desktop Architecture

```txt
Svelte renderer
  -> preload IPC bridge
    -> Electron main process
      -> pi --mode rpc subprocess
```

PI communicates over stdin/stdout JSONL RPC. The MVP does not use app-owned SQL, custom session storage, or multi-provider routing.

## Key Desktop Files

| Path | Role |
| --- | --- |
| `apps/desktop/electron/main.ts` | Window, PI subprocess lifecycle, JSONL RPC framing, IPC handlers |
| `apps/desktop/electron/preload.ts` | Renderer-facing desktop API |
| `apps/desktop/src/lib/desktop-state.svelte.ts` | Central renderer state (repos, sessions, messages, status, activity) |
| `apps/desktop/src/lib/components/desktop/` | Shell, sidebar, transcript, composer, context panel |
| `apps/desktop/src/routes/` | SvelteKit routes (workspace, repos, sessions, activity, settings) |

## Frameworks And Libraries

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron 39 |
| UI framework | SvelteKit 2, Svelte 5 |
| Language | TypeScript 5.9 |
| Build | Vite 7, Turborepo |
| Styling | Tailwind CSS v4, shadcn-svelte, Bits UI, Hugeicons |
| Agent integration | PI Agent RPC (`pi --mode rpc`); `@earendil-works/pi-coding-agent` in desktop deps |
| Transcript UI | Vercel AI SDK (`ai`), Streamdown, Shiki |
| Verification | `svelte-check` via `npm run check` / `npm run lint` |

No automated unit or e2e test runner is configured at the repo root yet.

## Local Development

```bash
npm install
npm run dev              # all workspaces
npm run dev:desktop      # desktop only
npm run dev:web          # web only (port 5174)
npm run check
npm run lint
npm run build
```

## Environment And External Tools

- `VITE_DEV_SERVER_URL` — desktop dev only; Electron loads the Vite dev server URL.
- `pi` on `PATH` — required for `pi --mode rpc` (configurable executable path is planned).
- Model/API credentials — configured in PI Agent, not in H3Code `.env` files.

## Further Reading

- [README.md](README.md) — product direction and current desktop status
- [docs/h3code-desktop-mvp.md](docs/h3code-desktop-mvp.md) — canonical MVP brief
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — UI tokens, layout, and per-app paths
- [Docs/SvelteKitShadcn.md](Docs/SvelteKitShadcn.md) — shadcn-svelte usage in this repo
