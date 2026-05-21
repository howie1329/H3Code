# H3Code

H3Code is an MVP-stage local desktop UI shell for PI Agent in RPC mode.

The desktop app is being rewritten from scratch. The previous desktop implementation has been intentionally removed so the new Electron and SvelteKit app can be rebuilt around a thin PI RPC integration instead of older app-owned session behavior.

The web and marketing app are preserved.

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

The canonical MVP brief lives in [docs/h3code-desktop-mvp.md](docs/h3code-desktop-mvp.md).

## MVP Focus

The first desktop rebuild should prove one loop:

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
  web/            # SvelteKit marketing site
docs/
  h3code-desktop-mvp.md
```

`apps/desktop` is intentionally absent until the clean desktop rebuild is scaffolded.

## Planned Desktop Stack

- Electron
- SvelteKit
- TypeScript
- Tailwind CSS
- PI Agent RPC over stdin/stdout JSONL
- Minimal local JSON preferences for desktop settings

## Local Development

Install dependencies:

```bash
npm install
```

Run all workspace dev tasks:

```bash
npm run dev
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

Desktop commands will be added back when the new desktop app is scaffolded.
