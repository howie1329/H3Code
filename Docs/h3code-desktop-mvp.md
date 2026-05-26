# H3Code Desktop MVP

## Summary

H3Code Desktop is a local Electron and SvelteKit UI shell for PI Agent in RPC mode.

The MVP proves one loop: a user selects a local repo, starts or connects to PI Agent with that repo as the working directory, chats with the agent, sees streaming assistant and tool activity, and can start a fresh PI-owned session.

H3Code is not the agent runtime, session system, message store, model router, or tool executor. PI Agent owns those responsibilities. H3Code owns the desktop experience around them.

## Implementation Status

This document describes the MVP target. The current `apps/desktop` app implements the core RPC loop: repo selection, PI process startup, session listing/switching, new sessions, prompt/steer/follow-up, abort, transcript rendering, session stats, diagnostics, recent activity, SQLite-backed recent repos and session metadata index, configurable PI executable path, extension UI prompts (select/confirm/input/editor), and a reactive PI sync layer (`src/lib/pi-session`: main adapts raw RPC to domain events over `pi:session-event`; renderer applies a shared projector for PI TUI parity including streaming messages, live tool activity, turn commits, queue/compaction/retry banners, and extension `setStatus`/`notify`/`setWidget`/`setTitle`). Snapshot reconnect uses `get_state` + `get_messages`. Remaining MVP gaps include better discovery across workspace repo/session metadata.

## Product Boundary

PI Agent owns:

- Sessions and session persistence.
- Messages and canonical conversation history.
- Agent behavior, tools, model behavior, queueing, compaction, and retry.
- Extension commands, prompt templates, skills, and command expansion exposed by PI.
- Tool execution state and results.

H3Code owns:

- Electron process lifecycle.
- PI RPC subprocess lifecycle.
- RPC connection state and diagnostics.
- Repo/workspace selection.
- UI state and rendering.
- Minimal local preferences.

H3Code should ask PI Agent for state and messages whenever possible. It should not duplicate transcripts or become the source of truth for sessions.

## MVP Scope

The first implementation should support:

- Launching PI Agent with `pi --mode rpc`.
- Running the PI subprocess with the selected repo as `cwd`.
- Configuring the PI executable path, defaulting to `pi`.
- Selecting a local repo/workspace path.
- Calling `get_state` and rendering session/model/run state.
- Calling `get_messages` and rendering the transcript returned by PI.
- Sending `prompt` when idle.
- Sending `steer` or `follow_up` while PI is running.
- Sending `abort` to stop an active operation.
- Calling `new_session` to start a fresh PI-owned session.
- Streaming `message_update` events into the active assistant message.
- Streaming `tool_execution_start`, `tool_execution_update`, and `tool_execution_end` into readable tool activity.
- Showing `agent_start`, `agent_end`, `queue_update`, compaction, retry, extension error, and process diagnostics in the UI.

## Explicitly Deferred

Do not build these in the first desktop slice:

- Full-text search or transcript indexing in SQL (metadata-only index exists for sidebar discovery).
- Multi-provider routing index in SQL.
- Codex CLI or Codex Server support.
- Custom message storage.
- Custom session storage.
- App-owned transcript persistence.
- App-owned session browser unless PI RPC exposes the required session list/switch primitives cleanly.
- Slash command or file mention expansion unless PI RPC exposes it directly.
- Cloud sync, accounts, teams, remote sandboxes, or collaboration features.

## RPC Contract

H3Code should communicate with PI Agent over stdin/stdout JSONL:

```bash
pi --mode rpc
```

The main process writes one JSON command per line to stdin. PI emits command responses and agent events as JSON lines on stdout. H3Code should generate request IDs for commands and correlate responses by ID.

The RPC reader must use strict JSONL framing:

- Split stdout records only on `\n`.
- Strip a trailing `\r` before parsing.
- Do not use Node `readline`, because it can split on Unicode separators that are valid inside JSON strings.
- Treat malformed JSON as a connection diagnostic, not transcript content.

stderr should be captured separately as diagnostics.

## First Implementation Shape

Recommended architecture:

```txt
Svelte renderer
  -> preload API
    -> Electron main process
      -> PI RPC client
        -> pi --mode rpc subprocess
```

Main process responsibilities:

- Spawn and stop PI.
- Own JSONL parsing and command correlation.
- Serialize RPC commands and extension UI responses on a single queue (one stdin write at a time).
- Validate selected repo paths before using them as `cwd`.
- Capture stdout events, command responses, stderr diagnostics, exit codes, and start failures.
- Do not forward uncorrelated `type: "response"` lines to the renderer as agent events.
- Expose a small typed IPC surface to the renderer.

Renderer responsibilities:

- Show connection state.
- Let the user select a repo.
- Render current PI state.
- Render messages returned by PI; prefer `agent_end.messages`, with `get_messages` as fallback.
- Render streaming assistant deltas and tool activity events.
- Refresh session git diff on `turn_end` (debounced) and after `agent_end`.
- Clear running/streaming UI as soon as `agent_end` arrives, before slow refresh work.
- Resync transcript/diff when the renderer reloads while PI remains connected.
- Provide composer controls for prompt, steer, follow-up, abort, and new session.

## Local Preferences

Use minimal local persistence in SQLite (`h3code.sqlite` under Electron user data).

Store:

- PI executable path (`app_settings`).
- Recent repo paths and per-repo session metadata index (`recent_repos`, `repo_sessions`).
- Last selected repo path and session path.
- Desktop UI toggles (sidebar, context panel).

Do not store:

- Full messages.
- Full transcripts.
- Tool outputs.
- PI session files.
- API keys or secrets.

## UI Direction

The UI should feel like a dense local developer tool, not a marketing page.

Recommended first screen:

```txt
+------------------------------------------------------+
| Top bar: repo, PI status, model, session state       |
+----------------------+-------------------------------+
| Sidebar              | Transcript                    |
| - recent repos       | - PI messages                 |
| - state/details      | - streaming assistant output  |
| - compact controls   | - tool activity               |
+----------------------+-------------------------------+
| Composer: prompt, queue mode, send, abort             |
+------------------------------------------------------+
```

Required states:

- No repo selected.
- PI not configured or executable missing.
- PI starting.
- PI connected and idle.
- PI running.
- PI exited unexpectedly.
- RPC parse or command error.
- Empty transcript.

## Acceptance Criteria

- The desktop app can launch PI in RPC mode from Electron.
- The selected repo path is used as the PI subprocess working directory.
- The app can call `get_state` and `get_messages`.
- The user can send a prompt and see assistant output stream.
- Tool execution events are visible and update in place by `toolCallId`.
- The user can abort a running operation.
- The user can start a new PI-owned session.
- The app persists only minimal preferences and recent repo paths.
- The app does not persist transcripts or own PI sessions.
- The app does not touch the web/marketing app.

## Later Direction

Extend the existing metadata-only SQL index for multi-provider routing and full-text discovery. Do not store canonical messages or transcripts in H3Code.
