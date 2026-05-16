# H3 Code MVP: Pi Desk

## Summary

H3 Code is a local desktop UI shell for managing Pi agent sessions across local repositories.

The MVP should prove one core loop: a user can select a local repo, start a Pi-backed session in that repo, send prompts, stream Pi output into a chat-style transcript, and return to that Pi session later.

H3 Code is not an AI coding agent, Codex clone, or model provider. Pi owns agent behavior, tool execution, model routing, code editing, extensions, inference, and canonical session history. H3 Code owns the desktop UI, local repo/session organization, process orchestration, prompt conveniences, and local metadata.

## Goals

- Add and select local repositories.
- Configure the local Pi executable path.
- Create and resume Pi sessions scoped to a selected repo.
- Send chat-style prompts to Pi.
- Run Pi with the selected repo as the process working directory.
- Stream Pi stdout and stderr into the active session view.
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
7. H3 Code runs Pi in the selected repo directory.
8. Pi stdout and stderr stream into the chat transcript.
9. The session is saved locally.
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
};

type Settings = {
  piExecutablePath: string;
};
```

Persist repos, session metadata, Pi session pointers, and settings locally. Keep active process state in memory.

Pi owns the canonical transcript and resume state. H3 Code should read Pi session JSONL for transcript display or maintain a derived cache that can be rebuilt from Pi's session file. Do not make H3 Code's local store the source of truth for Pi messages.

## Pi Process Contract

The MVP should use a simple prompt-in/process-out model:

- `cwd`: selected repo path
- `command`: configured Pi executable path
- `input`: expanded user prompt
- `output`: stdout and stderr streamed into the active transcript view
- `exit`: marks the session idle or errored

For MVP, spawn one Pi process per prompt. Long-lived interactive Pi sessions can be evaluated later if needed.

Behavior:

1. User submits a prompt.
2. H3 Code expands slash commands and file mentions.
3. H3 Code spawns Pi with the selected repo as `cwd`.
4. H3 Code streams stdout and stderr into the active view.
5. H3 Code records or updates the Pi session pointer for the session.
6. Process exit marks the session `idle`.
7. Non-zero exit marks the session `error` and preserves access to Pi output through the Pi session file.
8. User can stop a running process.

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
9. Spawn Pi in the selected repo and stream output.
10. Read Pi session output for transcript display.
11. Add stop-process behavior.
12. Add slash command expansion.
13. Add basic file mention expansion.
14. Polish empty, loading, running, disabled, and error states.

## Acceptance Criteria

The MVP is complete when this flow works:

1. Open H3 Code.
2. Configure a valid Pi executable path.
3. Add a local repo.
4. Select the repo.
5. Create a session named `Fix failing tests`.
6. Send `/fix @src/example.ts tests are failing here`.
7. H3 Code expands the slash command and file mention.
8. Pi runs with the repo path as `cwd`.
9. Pi stdout and stderr stream into the transcript.
10. H3 Code stores the session metadata and Pi session pointer.
11. Quit and reopen H3 Code.
12. The repo, session, and transcript are still available through the Pi session file.
13. Send another message in the same session.
14. Stop a running Pi process from the UI.

## Risks

- Pi invocation details may differ from the simple prompt-in/process-out contract.
- Pi session file discovery may need adjustment after testing against the installed Pi executable.
- Large file mentions can make prompts too large.
- Derived transcript caches can drift if treated as canonical.
- Cross-platform executable validation may need platform-specific handling.

## Deferred Follow-Up

- SQLite persistence if metadata queries, search, or indexing become limiting.
- Derived transcript cache or search index.
- Fuzzy file mention search.
- Custom slash commands.
- Session title generation.
- Rich file browser.
- Diff review UI.
- Multiple active sessions.
- Provider-specific harnesses beyond Pi.
