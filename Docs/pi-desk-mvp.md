# H3 Code MVP: Pi Desk

## Summary

H3 Code is a local desktop UI shell for managing Pi agent sessions across local repositories.

The MVP should prove one core loop: a user can select a local repo, start a long-lived Pi RPC-backed session in that repo, send prompts, stream Pi events into a chat-style transcript, and return to that Pi session later.

H3 Code is not an AI coding agent, Codex clone, or model provider. Pi owns agent behavior, tool execution, model routing, code editing, extensions, inference, and canonical session history. H3 Code owns the desktop UI, local repo/session organization, process orchestration, prompt conveniences, and local metadata.

## Goals

- Add and select local repositories.
- Configure the local Pi executable path.
- Create and resume Pi sessions scoped to a selected repo.
- Send chat-style prompts to Pi.
- Run Pi with the selected repo as the process working directory.
- Stream Pi RPC events into the active session view, with stderr captured as diagnostics.
- Save local repos, session metadata, Pi session pointers, and settings.
- Switch between repos and sessions.
- Expand simple slash commands into prompt templates.
- Resolve simple `@file` mentions into prompt context.

## Non-Goals

- Direct Codex integration.
- Direct model provider integration.
- Custom AI backend.
- Cloud sync.
- User accounts.
- Remote sandboxes.
- Full IDE/editor.
- Complex diff review UI.
- Linear or GitHub integrations.
- Plugin marketplace.
- Team or collaboration features.
- Automatic commits.
- Background multi-agent orchestration.
- More than one active Pi process per session.

## Preferred Stack

- npm workspaces monorepo
- Turborepo for workspace task orchestration and Vercel-friendly builds
- SvelteKit
- Electron
- TypeScript
- Tailwind CSS
- Local JSON persistence for H3 Code metadata in the MVP
- SQLite deferred until metadata queries, search, or indexing justify it

Use SvelteKit for both the desktop renderer and the future marketing site. Keep the desktop app and marketing site as separate workspace apps. Use Turborepo to coordinate workspace scripts, caching, and Vercel builds without coupling app internals.

```txt
apps/
  desktop/        # SvelteKit + Electron app
  web/            # SvelteKit marketing site
packages/
  config/         # shared TypeScript, lint, and Tailwind config when useful
  ui/             # shared UI only after real duplication appears
```

Keep Electron, Pi process management, local filesystem access, and Pi session parsing inside `apps/desktop`. The marketing site should not import desktop internals.

Deploy web-facing SvelteKit surfaces through Vercel first. Electron packaging and distribution remain a separate desktop release path.

## Core User Flow

1. User opens H3 Code.
2. User configures the Pi executable path.
3. User adds a local repository path.
4. User selects that repo from the sidebar.
5. User creates a new session.
6. User types a prompt.
7. H3 Code runs Pi in RPC mode in the selected repo directory.
8. Pi RPC events stream into the chat transcript, with stderr captured as diagnostics.
9. The session is saved locally with a pointer to Pi's session file.
10. User can switch to another repo or session and return later.

## UI Shape

Use a clean desktop developer-tool layout.

```txt
+------------------------------------------------------+
| Sidebar               | Main Session Area            |
|-----------------------|------------------------------|
| Repos                 | Header: repo + session title |
| - TaskFlow            |                              |
| - ListIt              | Chat/output stream           |
| - H3 Code             |                              |
|                       |                              |
| Sessions              | Input composer               |
| - Refactor auth       | Slash commands / mentions    |
| - Fix tests           |                              |
|                       |                              |
| Settings              |                              |
+------------------------------------------------------+
```

Required states:

- No repo added.
- Repo selected with no session.
- No Pi executable configured.
- Pi executable path invalid.
- Session idle.
- Session running.
- Session errored.
- Empty transcript.

## Architecture

### Electron Main Process

The main process owns local capabilities:

- Validate repo paths.
- Read and write local persistence.
- Validate the Pi executable path.
- Spawn, stream, and stop Pi processes.
- Resolve file mentions from the selected repo.
- Enforce that file reads stay inside the selected repo.

### SvelteKit Renderer

The renderer owns UI state and interaction:

- Repo list.
- Session list.
- Transcript rendering.
- Prompt composer.
- Slash command menu.
- Basic file mention entry.
- Settings screen.

### IPC Surface

Keep the IPC boundary small and explicit:

```ts
repos:list
repos:add
repos:select

sessions:list
sessions:create
sessions:getMessages
sessions:sendMessage

settings:get
settings:update

files:resolveMentions

pi:stopSession
```

The renderer should not spawn processes or read arbitrary files directly.

## Data Model

```ts
type Repo = {
  id: string;
  name: string;
  path: string;
  addedAt: string;
  lastOpenedAt?: string;
};

type Session = {
  id: string;
  repoId: string;
  harness: 'pi';
  harnessSessionPath: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'running' | 'error';
  titleSource?: 'local' | 'pi' | 'user';
};

type Settings = {
  piExecutablePath: string;
};
```

Persist repos, session metadata, Pi session pointers, and settings locally. `harnessSessionPath` stores Pi's RPC `sessionFile` when available. Keep active process state in memory.

Pi owns the canonical transcript and resume state. H3 Code should read Pi session JSONL for transcript display or maintain a derived cache that can be rebuilt from Pi's session file. Do not make H3 Code's local store the source of truth for Pi messages.

## Pi Process Contract

The MVP should use Pi's RPC mode for process integration:

- `cwd`: selected repo path
- `command`: configured Pi executable path
- `args`: `--mode rpc`, plus `--session <harnessSessionPath>` when resuming an existing Pi session
- `input`: LF-delimited JSON RPC commands written to stdin
- `output`: LF-delimited JSON RPC responses/events read from stdout and rendered into the transcript
- `stderr`: diagnostic output captured and preserved separately from normal transcript events
- `exit`: marks the session idle or errored

For MVP, keep one long-lived Pi RPC process per active H3 session. Multiple H3 sessions may run concurrently, including sessions in different repos. Do not spawn multiple Pi processes for the same H3 session.

Behavior:

1. User submits a prompt.
2. H3 Code starts or reuses that session's Pi RPC process with the selected repo as `cwd`.
3. H3 Code sends a `prompt` RPC command over stdin. If Pi is already streaming, H3 Code sends the prompt with `streamingBehavior: "steer"`.
4. H3 Code parses stdout as strict LF-delimited JSONL RPC events and streams normalized transcript events into the active or background session view.
5. H3 Code captures stderr as diagnostic transcript events.
6. H3 Code records or updates the Pi session pointer from RPC `get_state.sessionFile`.
7. H3 Code updates local session titles from RPC `get_state.sessionName` unless the user manually renamed the session.
8. Process lifetime maps to session status: alive is `running`, no live process is `idle`, and unexpected start/exit failures are `error`.
9. User can stop a running process; H3 Code sends RPC `abort` before force-killing if needed.

## Slash Commands

Start with three built-in commands:

```txt
/explain
/fix
/test
```

Slash commands only expand prompt text locally. They do not add new execution modes.

Example:

```txt
/fix auth redirect is failing
```

Expands to:

```txt
Fix the following issue in this repository: auth redirect is failing.
Keep the change minimal. Explain the files changed and any tests to run.
```

Do not build custom command editing in the MVP.

## File Mentions

Support simple `@file` and `@path/to/file` mentions.

MVP behavior:

- Resolve paths relative to the selected repo.
- Read file contents before sending the prompt to Pi.
- Append referenced file contents to the expanded prompt.
- Reject paths outside the selected repo.
- Show a clear error if a mentioned file cannot be found.

Example expanded prompt:

```txt
Fix the bug in this file.

Referenced files:

--- src/routes/auth.ts ---
<file contents>
```

Do not build fuzzy search, rich autocomplete, or full file browsing in the MVP.

## Implementation Order

1. Create npm workspace structure.
2. Add Turborepo task orchestration.
3. Create `apps/desktop` with SvelteKit, Electron, TypeScript, and Tailwind.
4. Create `apps/web` as a placeholder SvelteKit marketing app.
5. Add local JSON persistence for H3 Code metadata.
6. Add settings screen for Pi executable path.
7. Add repo registration, validation, selection, and persistence.
8. Add session creation, selection, and Pi session pointer persistence.
9. Spawn long-lived Pi RPC processes in selected repos and stream RPC events.
10. Store derived per-session transcript caches and Pi `sessionFile` pointers.
11. Add stop-process behavior using RPC `abort` before force-killing if needed.
12. Add slash command expansion.
13. Add basic file mention expansion.
14. Polish empty, loading, running, disabled, and error states.

## Acceptance Criteria

The MVP is complete when this flow works:

1. Open H3 Code.
2. Configure a valid Pi executable path.
3. Add a local repo.
4. Select the repo.
5. Create or select a session.
6. Send a prompt.
7. H3 Code sends the prompt to Pi through RPC.
8. Pi runs with the repo path as `cwd`.
9. Pi RPC events stream into the transcript, with stderr shown as diagnostics if emitted.
10. H3 Code stores the session metadata, Pi `sessionFile` pointer, and derived transcript cache.
11. Quit and reopen H3 Code.
12. The repo, session, and transcript are still available.
13. Send another message in the same session and continue the same Pi session.
14. Stop a running Pi process from the UI.

## Risks

- Pi RPC protocol details may require adjustment after testing against the installed Pi executable.
- Pi session file and session-title mapping may need refinement after real RPC testing.
- Large file mentions can make prompts too large.
- Derived transcript caches can drift if treated as canonical.
- Cross-platform executable validation may need platform-specific handling.

## Deferred Follow-Up

- SQLite persistence if metadata queries, search, or indexing become limiting.
- Derived transcript cache or search index.
- Fuzzy file mention search.
- Custom slash commands.
- Rich session title generation beyond Pi `sessionName` sync.
- Rich file browser.
- Diff review UI.
- Multiple active sessions.
- Provider-specific harnesses beyond Pi.
