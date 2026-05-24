<!-- agentkit:start agents -->

# H3 Code Agent Guide

## Purpose

This is the primary instruction file for AI coding agents working in this repository.

H3Code is an MVP-stage local desktop UI shell for PI Agent in RPC mode (Electron + SvelteKit). The desktop app wraps PI's RPC runtime; `apps/web` is the marketing site. Agents should optimize for safe, focused, production-ready changes that follow local patterns.

## Source Of Truth

Follow this file first. It defines the repository-wide operating rules for agents.

Use companion guides only when relevant to the task. Do not load or restate every guide by default.

## Reference Map

Read these files when the task calls for them:

| Task type                                            | Read first                         |
| ---------------------------------------------------- | ---------------------------------- |
| Any implementation                                   | `AGENTS.md`                        |
| Code quality, refactors, review, dependencies        | `CODE-QUALITY.md`                  |
| Planning, branching, implementation, review, release | `WORKFLOWS.md`                     |
| Final handoff or PR explanation                      | `CHANGE-EXPLANATION.md`            |
| UI, styling, layout, navigation, components          | `DESIGN-SYSTEM.md`                 |
| Tests, fixtures, mocks, QA strategy                  | `TESTING.md`                       |
| Auth, permissions, secrets, PII, data handling       | `SECURITY-CHECKLIST.md`            |
| Complex engineering execution                        | `IMPLEMENTATION-BRIEF-TEMPLATE.md` |
| Product or user-facing feature definition            | `PRD-TEMPLATE.md`                  |
| Stack-specific work                                  | `STACK.md` when present            |

## Local Guidance

This root `AGENTS.md` applies to the whole repository.

If a subdirectory contains its own `AGENTS.md` or equivalent local guidance, follow the most specific local guidance for files in that subtree. When instructions conflict, prefer the more specific local guidance unless it violates repository-wide safety, security, or quality rules.

## Operating Rules

- Inspect existing code and patterns before changing files.
- Prefer the smallest complete solution that satisfies the task.
- Keep diffs focused and reviewable.
- Preserve user changes. Do not overwrite or revert work you did not make.
- Avoid speculative abstractions, broad rewrites, and dependency bloat.
- Validate external input at system boundaries.
- Keep public APIs and persisted data shapes stable unless the task requires a change.
- Ask before destructive commands, broad refactors, schema changes, dependency additions, or security-sensitive changes.
- Run the narrowest useful checks before handoff.
- Explain completed work clearly using `CHANGE-EXPLANATION.md` when present.

## Before Coding

Before making meaningful code changes:

1. Confirm the task, scope, and acceptance criteria.
2. Check whether the task is linked to an issue in Linear.
3. For non-trivial work without an issue, ask whether one should be created before implementation.
4. Create or switch to an appropriate branch when the workflow expects branches.
5. Inspect nearby code, tests, and existing patterns.
6. Read relevant companion guidance from the Reference Map.
7. Identify the smallest complete approach.
8. Ask for clarification if requirements, risk, or approval boundaries are unclear.

Tiny fixes can skip branch-and-brief ceremony when the change is obvious and low risk.

## During Coding

While implementing:

- Modify existing patterns before creating new ones.
- Keep behavior explicit and easy to test.
- Avoid unrelated formatting churn.
- Prefer existing utilities, components, and conventions.
- Add or update tests when behavior changes.
- For UI work, follow `DESIGN-SYSTEM.md` and preserve existing interaction patterns.
- For stack-specific work, read `STACK.md` when present.
- Document meaningful decisions in the implementation brief, PR, or final handoff.

## Approval Boundaries

Ask before:

- Adding a new runtime dependency.
- Changing schemas, migrations, permissions, auth, billing, or data retention behavior.
- Running destructive commands or deleting files.
- Changing global design tokens, theme primitives, or foundational layout rules.
- Performing broad refactors or large formatting-only rewrites.
- Editing generated, vendored, or external-source files unless the task explicitly requires it.

## Before Finishing

Before marking work complete:

1. Re-read the original request and acceptance criteria.
2. Confirm the implementation satisfies the requested scope.
3. Run the narrowest relevant checks:
   - `npm run check` — SvelteKit sync + `svelte-check` via Turbo
   - `npm run lint` — workspace lint (`svelte-check`)
   - `npm run build` — full workspace build (larger changes)
4. Review the diff for unrelated changes.
5. Confirm no unnecessary dependencies, schema changes, theme changes, or broad refactors were introduced.
6. Summarize what changed, why it changed, checks run, risks, and follow-up work.
7. If `CHANGE-EXPLANATION.md` exists, follow it for the final handoff.

## Project Commands

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Turbo: dev for all workspaces                    |
| `npm run dev:desktop` | Electron + SvelteKit desktop (`@h3code/desktop`) |
| `npm run dev:web`     | Marketing site (`@h3code/web`, port 5174)        |
| `npm run check`       | Type/check across workspaces                     |
| `npm run lint`        | Lint across workspaces                           |
| `npm run build`       | Production build across workspaces               |

## Environment

- `VITE_DEV_SERVER_URL`: set by the desktop dev script; Electron main loads the Vite dev URL when present (`apps/desktop/electron/main.ts`).
- **PI CLI:** MVP expects `pi` on `PATH` for `pi --mode rpc` (configurable path is planned; not an env var yet).
- Model/API keys are owned by **PI Agent**, not H3Code environment variables.

Never commit API keys, tokens, private keys, or local `.env` values. Keep secrets in environment variables or the project-approved secret store.

## Stack

- SvelteKit 2 + Svelte 5 + TypeScript 5.9
- Electron 39 (desktop)
- Tailwind CSS v4, shadcn-svelte / Bits UI, Hugeicons
- PI Agent RPC (JSONL over stdin/stdout); no app-owned DB in MVP
- Verification: `svelte-check` + Turbo; no automated unit/e2e suite yet

See `STACK.md` for architecture and key file paths.

<!-- agentkit:end agents -->

## Other Rules

- For UI in `apps/desktop` or `apps/web`: use that app's existing `$lib/components/ui` components first. If a component is missing, run the shadcn-svelte CLI from **that app's directory** (where its `components.json` lives), e.g. `cd apps/web && npx shadcn-svelte@latest add <name>`. Do not install into the other app unless you are editing it too. Read `Docs/SvelteKitShadcn.md` for APIs and `DESIGN-SYSTEM.md` for layout/token rules.
