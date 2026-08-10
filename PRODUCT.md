# H3Code Product Brief

> Status: Active PI-first brief after the August 10, 2026 reset.

## Product in one sentence

H3Code is a focused desktop workbench that makes PI sessions against local repositories easier to start, understand, control, resume, and review.

## First user

The first user is a developer who already uses PI, works in local Git repositories, and wants a clearer long-session interface than a collection of terminal windows.

## Product boundary

PI owns:

- The agent loop, model/provider behavior, tools, and execution.
- Authentication and provider credentials.
- Queueing, compaction, retry, and interruption semantics.
- Canonical sessions and transcripts.

H3Code owns:

- Electron process supervision and a narrow typed IPC bridge.
- Local repository selection and workspace presentation.
- Session navigation and readable streaming presentation.
- Controls that directly map to PI behavior, such as prompt, steer, follow-up, and abort.
- Lightweight preferences and indexes only when a product slice requires them.
- Diff and Git-oriented review around changes PI makes.

H3Code will not introduce a universal agent protocol, copy PI's canonical transcript into a second source of truth, or abstract for hypothetical providers.

## First complete loop

A user can:

1. Choose a local repository.
2. Start PI or resume a PI-owned session in that repository.
3. Send a prompt and see text, reasoning, tool activity, and errors stream in place.
4. Steer, follow up, or abort using PI's real controls.
5. Restart H3Code and recover the same PI session predictably.
6. Review the files and diff produced by the session.

That loop is the product gate. Work that does not improve it waits.

## Sequence

### 0. Clean foundation — complete

- One Electron + SvelteKit application.
- Tailwind CSS 4 with the retained semantic palette.
- Fresh shadcn-svelte configuration and component source.
- No legacy runtime, cloud surface, shared protocol, or custom component library.

### 1. PI execution loop — next

- Choose and validate a repository.
- Locate and launch PI through its supported programmatic or RPC boundary.
- Expose a small typed Electron-to-renderer contract.
- Stream one real turn and support abort.

### 2. Native PI session behavior

- Resume and switch PI-owned sessions.
- Add steer and follow-up.
- Represent queue, compaction, retry, and extension interactions when PI exposes them.
- Recover cleanly after renderer and application restarts.

### 3. Workbench depth

- Session navigation.
- Diff and changed-file review.
- Terminal and development-server visibility where it directly improves the PI workflow.
- Local Git actions only after review behavior is dependable.

## Explicit non-goals

Until the PI desktop loop is excellent:

- Cloud workspaces, accounts, teams, collaboration, billing, and remote sandboxes.
- Codex or additional agent runtimes.
- A marketing application or native-shell experiment.
- A shared cross-provider message protocol.
- A browser editor, managed inference, or H3Code-owned agent loop.
