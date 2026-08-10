# H3Code — Stack Guidance

<!-- agentkit:start stack -->
H3Code is an npm workspace with one application: `apps/desktop`.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Desktop host | Electron 39, TypeScript | Window lifecycle, OS dialogs, future PI process supervision |
| Renderer | SvelteKit 2, Svelte 5, Vite 7 | Product UI |
| Styling | Tailwind CSS 4 | Semantic utility styling from CSS variables |
| Components | shadcn-svelte, Mira style | Upstream-owned UI primitives copied into the repository |
| Theme | `apps/desktop/src/app.css` | Light/dark OKLCH colors, radius, shadows, and Tailwind mappings |
| Package manager | npm 11 workspaces | Root and desktop dependency management |

## Runtime Boundary

```text
Svelte renderer
  -> typed preload API
    -> Electron main
      -> PI process or supported PI programmatic boundary (next slice)
```

- Keep filesystem, child-process, and Electron APIs in `apps/desktop/electron/`.
- Keep the preload API narrow and declare it in `apps/desktop/src/app.d.ts`.
- Keep Svelte routes browser-safe.
- PI integration should preserve PI's native sessions and authentication rather than wrapping them in a new runtime framework.

## Source Layout

- `apps/desktop/electron/main.ts`: Electron startup and IPC handlers.
- `apps/desktop/electron/preload.ts`: context-isolated renderer bridge.
- `apps/desktop/src/routes/`: renderer pages and layouts.
- `apps/desktop/src/lib/components/ui/`: shadcn-svelte generated source only.
- `apps/desktop/src/lib/utils.ts`: shadcn class utilities and component helper types.
- `apps/desktop/src/app.css`: canonical Tailwind/theme file.
- `apps/desktop/components.json`: shadcn-svelte registry configuration.

## Validation

```bash
npm run check
npm run lint
npm run build
```

No test runner is configured in the clean baseline. Add focused tests with the first non-trivial PI lifecycle module rather than creating an empty test scaffold.
<!-- agentkit:end stack -->
