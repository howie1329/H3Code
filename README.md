# H3Code

H3Code is a local Pi development workbench for supervising multiple concurrent coding-agent Threads across local Git repositories. It can open and improve its own Repository through the same explicit workflow as any other project. Pi is the first and only Agent Runtime currently in scope. The project currently contains a clean Electron + SvelteKit shell, a directory picker, Tailwind CSS 4, the existing semantic color palette, and freshly generated shadcn-svelte source.

The previous desktop runtime, cloud application, marketing site, Zig experiment, shared protocol packages, and custom component library were intentionally removed on August 10, 2026.

## Current scope

- Desktop only.
- Pi only for the current product loop; later runtimes will receive separate integrations when implemented.
- Normal local Git worktrees only.
- Pi owns execution, tools, authentication, native behavior, canonical sessions, and canonical conversation history.
- H3Code owns the desktop shell, concurrent Thread supervision, Repository context, presentation, and small local preferences and indexes.
- H3Code follows BB's provider-specific bridge pattern: a tested Pi SDK runs in a dedicated local process, loads the user's normal Pi resources, and emits H3Code's small Thread event contract.
- Multiple Threads may share one checkout; its files, branch, and Git diff are shared.
- H3Code-created Threads use deterministic H3Code-owned Pi session paths. Existing terminal-created Pi sessions can be imported by reference, and H3Code removal actions only hide or unregister local navigation entries.
- The first usable release targets macOS.

The next product slice is a Pi SDK bridge proof: validate a selected Git worktree, load the user's normal Pi configuration and resources, start or resume a canonical Pi session, stream one real Turn, and support abort against the actual local checkout. Concurrent Thread supervision follows without tying Active Turns to the selected renderer view.

See [PRODUCT.md](PRODUCT.md) for the active brief. The pre-reset system is recorded in [docs/archive/h3code-current-state-2026-08-10.md](docs/archive/h3code-current-state-2026-08-10.md).

## Repository

```text
apps/desktop/
  electron/        Electron main process and preload bridge
  src/routes/      SvelteKit renderer
  src/lib/components/ui/  Fresh shadcn-svelte source
  src/app.css      Tailwind imports and semantic theme tokens
packages/runtime-pi/  Planned Pi integration package; created with the execution slice
```

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run check
npm run lint
npm run build
```

Run shadcn-svelte commands from `apps/desktop` and add components only when a feature needs them:

```bash
npx shadcn-svelte@latest add <component>
```
