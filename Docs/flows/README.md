# Interaction flows (`*.ivo.flow`)

Lightweight YAML specs for layout regions, navigation, and user flows before implementation.

| File | Scope |
| --- | --- |
| `desktop-shell-layout.ivo.flow` | Persistent top bar, session sidebar, workspace + inspector |
| `desktop-repo-workspace.ivo.flow` | Repo dropdown and workspace scoping |
| `desktop-session-navigation.ivo.flow` | Session list, selection, and new session |

These are planning artifacts. Implementation maps to `apps/desktop/src/routes/+layout.svelte`, `PageShell`, `AppSidebar`, and `desktop-state.svelte.ts`.
