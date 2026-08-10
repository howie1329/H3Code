# H3Code

H3Code is being rebuilt as a focused desktop workbench for PI. The project currently contains a clean Electron + SvelteKit shell, a repository picker, Tailwind CSS 4, the existing semantic color palette, and freshly generated shadcn-svelte source.

The previous desktop runtime, cloud application, marketing site, Zig experiment, shared protocol packages, and custom component library were intentionally removed on August 10, 2026.

## Current scope

- Desktop only.
- PI only.
- Local repositories only.
- PI owns execution, tools, authentication, canonical sessions, and canonical transcripts.
- H3Code owns the desktop shell, repository context, presentation, and small product preferences.

The next product slice is the smallest complete PI loop: choose a repository, start or resume PI, send a prompt, stream assistant and tool activity, steer or abort, and recover the session after restart.

See [PRODUCT.md](PRODUCT.md) for the active brief. The pre-reset system is recorded in [docs/archive/h3code-current-state-2026-08-10.md](docs/archive/h3code-current-state-2026-08-10.md).

## Repository

```text
apps/desktop/
  electron/        Electron main process and preload bridge
  src/routes/      SvelteKit renderer
  src/lib/components/ui/  Fresh shadcn-svelte source
  src/app.css      Tailwind imports and semantic theme tokens
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
