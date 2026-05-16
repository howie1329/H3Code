# H3 Code

H3 Code is a local desktop UI shell for managing Pi agent sessions across local repositories.

The project is currently in MVP planning. The first product target is **Pi Desk**: a desktop app that lets a user select a repo, run their locally installed Pi executable in that repo, stream Pi output into a chat-style session view, and save local session history.

H3 Code is not an AI coding agent, Codex clone, model provider, or custom inference backend. Pi owns agent behavior, model routing, tool execution, code editing, and extensions. H3 Code owns the desktop experience around Pi.

## MVP Scope

The MVP should support:

- Adding and selecting local repositories.
- Configuring the path to the local Pi executable.
- Creating and resuming Pi sessions for a selected repo.
- Sending chat-style prompts to Pi.
- Running Pi with the selected repo as the working directory.
- Streaming Pi stdout and stderr into the session transcript.
- Saving repos, sessions, messages, and settings locally.
- Switching between repos and sessions.
- Expanding simple slash commands.
- Resolving basic `@file` mentions into prompt context.

The detailed MVP brief lives in [Docs/pi-desk-mvp.md](Docs/pi-desk-mvp.md).

## Non-Goals

The MVP intentionally avoids:

- Direct Codex integration.
- Direct model provider integration.
- Custom AI backend.
- Cloud sync.
- User accounts.
- Remote sandboxes.
- Full IDE/editor features.
- Complex diff review UI.
- Linear or GitHub integrations.
- Plugin marketplace.
- Team or collaboration features.
- Automatic commits.
- Multi-agent orchestration.

## Planned Stack

- Electron
- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui where it stays lightweight
- Local JSON persistence for the first MVP

This is a local desktop app, so the project should avoid Next.js, SSR, API routes, and server components.

## Core Flow

1. Open H3 Code.
2. Configure the Pi executable path.
3. Add a local repository.
4. Select the repo.
5. Create a session.
6. Send a prompt.
7. H3 Code runs Pi in the repo directory.
8. Pi output streams into the transcript.
9. The session is saved locally.
10. Return later and continue the same session.

## Product Boundary

Pi handles:

- Agent behavior.
- Codex/subscription/model routing.
- Tool execution.
- Code editing.
- Extensions.

H3 Code handles:

- Desktop UI.
- Local repo management.
- Session management.
- Running Pi in the selected repo.
- Streaming Pi output.
- Local session history.
- Slash command expansion.
- Basic file mention expansion.
- Local settings.

## Status

This repository currently contains the project direction and MVP brief. Application scaffolding and implementation are next.
