# H3 Code MVP: Pi Desk

## Summary

H3 Code is a local desktop UI shell for managing Pi agent sessions across local repositories.

The MVP should prove one core loop: a user can select a local repo, start a Pi-backed session in that repo, send prompts, stream Pi output into a chat-style transcript, and return to that saved session later.

H3 Code is not an AI coding agent, Codex clone, or model provider. Pi owns agent behavior, tool execution, model routing, code editing, extensions, and inference. H3 Code owns the desktop UI, local repo/session organization, process orchestration, prompt conveniences, and local persistence.

## Goals

- Add and select local repositories.
- Configure the local Pi executable path.
- Create and resume Pi sessions scoped to a selected repo.
- Send chat-style prompts to Pi.
- Run Pi with the selected repo as the process working directory.
- Stream Pi stdout and stderr into the active session view.
- Save local repos, sessions, messages, and settings.
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

- Electron
- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui if it stays lightweight and useful
- Local JSON persistence for MVP

Avoid Next.js. This is a local desktop app and does not need SSR, API routes, or server components.

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

### React Renderer

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
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'running' | 'error';
};

type Message = {
  id: string;
  sessionId: string;
  role: 'user' | 'pi' | 'system';
  content: string;
  createdAt: string;
};

type Settings = {
  piExecutablePath: string;
};
```

Persist repos, sessions, messages, and settings locally. Keep active process state in memory.

## Pi Process Contract

The MVP should use a simple prompt-in/process-out model:

- `cwd`: selected repo path
- `command`: configured Pi executable path
- `input`: expanded user prompt
- `output`: stdout and stderr streamed into the session transcript
- `exit`: marks the session idle or errored

For MVP, spawn one Pi process per prompt. Long-lived interactive Pi sessions can be evaluated later if needed.

Behavior:

1. User submits a prompt.
2. H3 Code creates and persists a user message.
3. H3 Code expands slash commands and file mentions.
4. H3 Code spawns Pi with the selected repo as `cwd`.
5. H3 Code streams stdout and stderr into a Pi message.
6. H3 Code persists streamed output as the Pi message content updates.
7. Process exit marks the session `idle`.
8. Non-zero exit marks the session `error` and preserves output.
9. User can stop a running process.

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

1. Create Electron, Vite, React, TypeScript, and Tailwind app shell.
2. Add local JSON persistence.
3. Add settings screen for Pi executable path.
4. Add repo registration, validation, selection, and persistence.
5. Add session creation, selection, and persistence.
6. Add transcript persistence.
7. Spawn Pi in the selected repo and stream output.
8. Add stop-process behavior.
9. Add slash command expansion.
10. Add basic file mention expansion.
11. Polish empty, loading, running, disabled, and error states.

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
10. The transcript is persisted locally.
11. Quit and reopen H3 Code.
12. The repo, session, and transcript are still available.
13. Send another message in the same session.
14. Stop a running Pi process from the UI.

## Risks

- Pi invocation details may differ from the simple prompt-in/process-out contract.
- Large file mentions can make prompts too large.
- Streaming persistence can be noisy if every chunk writes to disk immediately.
- Cross-platform executable validation may need platform-specific handling.

## Deferred Follow-Up

- SQLite persistence if JSON becomes limiting.
- Fuzzy file mention search.
- Custom slash commands.
- Session title generation.
- Rich file browser.
- Diff review UI.
- Multiple active sessions.
- Provider-specific harnesses beyond Pi.
