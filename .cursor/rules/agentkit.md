<!-- agentkit:start cursor-rules-agentkit -->
# Cursor AgentKit Rules

Use this rule as a repository guidance router for Cursor agents and composer workflows.

## Primary Guidance

- Follow `AGENTS.md` first.
- Treat `AGENTS.md` as the source of truth for repository-wide agent behavior.
- Keep context focused. Read companion files only when relevant to the task.

## Read When Relevant

- `STACK.md`: monorepo layout, architecture boundaries, validation.
- `CODE-QUALITY.md`: code quality, review, refactors, dependencies.
- `CHANGE-EXPLANATION.md`: final handoff and developer-facing explanation.
- `DESIGN.md`: UI, styling, layout, components (desktop product baseline; cloud uses parallel shadcn patterns).
- `docs/SvelteKitShadcn.md`: SvelteKit + shadcn-svelte APIs for desktop/web.
- `docs/h3code-cloud-saas-prd.md` and `docs/h3code-convex-schema.md`: cloud scope and data model.

## Cursor Behavior

- Prefer existing repository patterns over generic generated patterns.
- Keep changes scoped and reviewable.
- Do not change foundational architecture, schema, dependencies, or theme primitives without explicit approval.
- Summarize changed files, checks run, risks, and review focus before handoff.
<!-- agentkit:end cursor-rules-agentkit -->
