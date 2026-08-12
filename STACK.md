# H3Code — Stack Guidance

<!-- agentkit:start stack -->
H3Code is an npm workspace with one current application: `apps/desktop`. The first runtime package will be added as `packages/runtime-pi` when the Pi execution slice begins; do not scaffold integrations for other Agent Runtimes yet.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Desktop host | Electron 39, TypeScript | Window lifecycle, OS dialogs, and runtime supervision |
| Renderer | SvelteKit 2, Svelte 5, Vite 7 | Product UI |
| First runtime path | Pinned Pi SDK in a dedicated Node bridge process | Native Pi sessions, resources, controls, and event translation |
| Styling | Tailwind CSS 4 | Semantic utility styling from CSS variables |
| Components | shadcn-svelte, Mira style | Upstream-owned UI primitives copied into the repository |
| Theme | `apps/desktop/src/app.css` | Light/dark OKLCH colors, radius, shadows, and Tailwind mappings |
| Package manager | npm 11 workspaces | Root and desktop dependency management |
| Initial platform | macOS | First supported process, packaging, and release target |

## Runtime Boundary

```text
Svelte renderer
  -> typed preload API
    -> Electron main
      -> packages/runtime-pi
        -> Pi Thread supervisor
          -> dedicated Pi bridge process
            -> pinned Pi SDK
              -> canonical Pi sessions
```

- Keep filesystem, child-process, and Electron APIs in `apps/desktop/electron/`.
- Keep the preload API narrow and declare it in `apps/desktop/src/app.d.ts`.
- Keep Svelte routes browser-safe.
- Keep live Thread ownership outside renderer component and route lifecycles so navigation and reloads do not stop Active Turns.
- Let `runtime-pi` own the bridge lifecycle, Pi Thread objects, streams, abort controllers, and resume handles. Electron main owns application lifecycle and exposes product-safe commands and events through preload.
- Host a pinned Pi SDK in one dedicated Node bridge process. Keep Pi SDK code and native event translation out of Electron main and the renderer.
- Use Pi's configured services and resource loading rather than reconstructing authentication, models, settings, packages, extensions, skills, prompts, themes, or context files in H3Code.
- Keep exactly one canonical Pi SDK session per Thread. H3Code may store local indexes and resume references, but never a competing conversation history.
- Store H3Code-created Pi sessions at deterministic H3Code-owned paths keyed by Thread identity. Discover and import existing terminal-created Pi sessions by reference without copying them.
- Report the embedded Pi SDK version and Pi configuration errors through Settings. Never install a global Pi CLI or store provider credentials.
- Run against the validated local Git worktree using real local filesystem and command behavior.
- Expose only the renderer contract proven by Pi: identity, lifecycle and attention state, presentation events, prompt, abort, and explicit flags for optional capabilities.
- Add no shared runtime package or additional Runtime Integration until a second concrete Agent Runtime proves further common behavior.
- Keep one canonical Pi JSONL file per Thread regardless of whether it lives at an H3Code-owned path or an imported native Pi path.

## Source Layout

- `apps/desktop/electron/main.ts`: Electron startup and IPC handlers.
- `apps/desktop/electron/preload.ts`: context-isolated renderer bridge.
- `apps/desktop/src/routes/`: renderer pages and layouts.
- `apps/desktop/src/lib/components/ui/`: shadcn-svelte generated source only.
- `apps/desktop/src/lib/utils.ts`: shadcn class utilities and component helper types.
- `apps/desktop/src/app.css`: canonical Tailwind/theme file.
- `apps/desktop/components.json`: shadcn-svelte registry configuration.
- `packages/runtime-pi/`: planned Pi Runtime Integration, bridge entrypoint, native event translation, and live Thread supervision boundary; create it with the first Pi execution implementation.

## Validation

```bash
npm run check
npm run lint
npm run build
```

No test runner is configured in the clean baseline. Add focused tests with the first non-trivial Pi lifecycle module rather than creating an empty test scaffold.
<!-- agentkit:end stack -->
