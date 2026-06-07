# H3Code — Code Quality

<!-- agentkit:start code-quality -->
Guidance for review, refactor, and maintainability. Commands live in `AGENTS.md`; run the narrowest check set for the workspaces you touch.

## Review Priorities

1. **Boundary respect** — Providers own runtime and transcripts; H3Code owns local UI and orchestration. Do not blur ownership.
2. **Protocol neutrality** — Keep renderer and shared types aligned with `@h3code/agent-core`, not PI-specific shapes.
3. **Scope discipline** — No drive-by refactors, unrelated formatting, or dependency churn.
4. **Type safety** — Prefer explicit types at protocol boundaries; use `svelte-check` / `tsc` clean passes.
5. **UI consistency** — Reuse shadcn primitives: Svelte in `apps/desktop` / `apps/web`; React in `apps/cloud/src/components/ui/`. Follow `DESIGN.md` tokens.

## Patterns to Prefer

- Existing component and module structure in the touched app or package.
- Workspace-local utilities (`apps/desktop/src/lib/utils.ts`, package `src/` modules).
- Small, reviewable commits of behavior with tests where behavior is non-obvious.
- Node test runner for server/desktop unit tests; Vitest for cloud (`npm run test --workspace @h3code/cloud`).

## Patterns to Avoid

- New dependencies without clear need and approval.
- Duplicating provider logic in the renderer.
- Hardcoded colors or spacing when `DESIGN.md` tokens or Tailwind theme variables exist.
- Broad `any` at WebSocket or protocol boundaries.

## Refactor Guidance

- Refactor only what the task requires.
- When extracting shared code, prefer `packages/` only if two workspaces need it.
- Preserve public exports and protocol compatibility unless the task explicitly allows breaking changes.

## Pre-Handoff Checklist

- [ ] Changed workspaces pass `check` (and `lint` / tests when relevant).
- [ ] No secrets or env values committed.
- [ ] Important decisions documented in the change explanation.
- [ ] Reviewer knows which app/package to focus on.
<!-- agentkit:end code-quality -->
