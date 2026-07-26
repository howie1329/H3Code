# H3Code Product Brief

> Status: Active working brief. Strategic sequencing is maintained in [docs/h3code-roadmap.md](docs/h3code-roadmap.md); execution and business-model decisions are recorded in [docs/h3code-product-direction.md](docs/h3code-product-direction.md).

## Product in one sentence

H3Code is a focused coding-agent workbench that lets developers run the coding runtimes they already use against local or cloud repositories while H3Code provides the surrounding workspace, session, terminal, preview, diff, and Git experience.

## Problem

Coding agents are powerful but fragmented across terminals, editor panels, provider-specific applications, cloud sandboxes, and Git tooling. Developers have to reconstruct context, find the right session, understand what is running, and recover from failures across several surfaces.

H3Code should make the work legible and continuous without hiding the runtime that is doing the work. A developer should be able to select a repository, start or resume an agent session, inspect tool activity and changes, intervene when needed, and deliver the result through Git.

## Target users

The first user is a solo developer who:

- works against one or more real repositories;
- already uses coding-agent subscriptions, native provider authentication, or BYOK;
- values fast orientation and keyboard-friendly controls over onboarding theater;
- needs local-first workflows but may want a remote workspace when away from their primary machine.

Teams, shared workspaces, and enterprise controls are later opportunities, not launch requirements.

## Product promise

> One workbench for coding agents, local repositories, and remote development sessions—using the provider access the developer already has whenever the runtime permits it.

H3Code must clearly show which runtime, authentication path, and billing mode are active. It must not imply that provider subscription access is portable when it is not.

## Product surfaces

### Desktop: flagship surface

Desktop is the first product to make reliable. It owns:

- local repository and workspace selection;
- runtime/session navigation and recovery;
- unified transcript and tool activity presentation;
- terminal and development-server workflows;
- diff review and local Git actions;
- runtime, model, authentication, connection, and capability state;
- lightweight local metadata and display caching.

Initial execution paths are PI through the existing SDK integration and Codex through its app-server, with a shared UI/transport boundary. Additional runtimes are justified by user value and reliable authentication—not by provider count.

### Cloud: independent remote workspace

Cloud is not a remote-control dependency on a running desktop. It gives a signed-in user a GitHub repository, isolated sandbox, agent session, durable product state, and a path to preview and deliver changes.

The first cloud path is Codex-first, subject to validating authentication, credential custody, sandbox economics, and resume behavior. BYOK and AI Gateway remain explicit fallback paths. Cloud scope starts with solo accounts and GitHub.

### Web and experimental shell

`apps/web` is the marketing surface. `apps/desktop-zero` is an experimental native shell and does not currently define the flagship product scope.

## Ownership boundary

H3Code owns:

- the workbench UI and navigation;
- repository/workspace context;
- local or cloud sandbox lifecycle orchestration;
- display persistence and product metadata;
- terminal, preview, diff, and Git integrations;
- clear runtime capabilities and connection state.

The selected runtime owns:

- the agent loop, tools, model behavior, queueing, compaction, and retry;
- canonical native session history and provider-native identifiers;
- provider authentication semantics and execution details.

The renderer boundary should use AI SDK-compatible `UIMessage` parts and a small lifecycle surface. H3Code should not build another universal agent protocol or projector.

## Principles

1. Own the workbench, not the agent loop.
2. Prefer native provider subscriptions and BYOK; make managed inference optional and transparent.
3. Keep desktop useful without cloud availability.
4. Make runtime, authentication, connection, and run state visible.
5. Favor one interaction model across local and cloud workspaces.
6. Earn complexity in phases; do not build teams, broad provider coverage, or a browser editor before the core loop is dependable.

## Current product state

### Working today

- Desktop local folder selection and Electron shell.
- Local runtime-server supervision and WebSocket connection.
- PI session creation, listing, switching, prompts, steer/follow-up, and abort.
- Desktop transcript rendering, streaming output, tool blocks, diagnostics, extension UI, recent activity, session stats, preferences, and metadata indexing.
- Cloud sign-in, Clerk/Convex auth, GitHub connection verification, curated workspace repositories, session create/list/open, Convex-persisted user messages, and asynchronous Daytona sandbox provisioning.

### Not yet product-complete

- Desktop Codex app-server integration and shared transcript boundary.
- Desktop migration away from the legacy runtime server.
- Cloud live agent execution and assistant/tool streaming.
- Cloud terminal, preview, diff, commit, push, and pull-request flow.
- Durable cloud harness resume and secure credential lifecycle.
- Reliable crash/reconnect testing and launch-quality packaging.

## Success criteria

H3Code is ready to become a real product when a developer can:

1. choose a local repository or GitHub-backed cloud workspace;
2. authenticate through a clearly labeled supported path;
3. start or resume a session and see useful streaming state;
4. steer or stop the run predictably;
5. inspect tool activity, terminal output, previews, and diffs;
6. recover after restart or sandbox suspension;
7. deliver changes through local Git or a cloud branch/PR workflow.

Product quality is measured first by successful completion and recovery of that loop, then by adoption, retention, cloud cost, and support burden. Numeric targets should be set after baseline instrumentation exists.

## Explicit non-goals

- Building a foundation model or general-purpose agent framework.
- Replacing mature provider runtimes with an H3Code-owned agent loop.
- Making H3Code the canonical owner of provider transcripts.
- Supporting every provider before the core workbench is excellent.
- Requiring cloud connectivity for the desktop product.
- Launching teams, a full browser editor, native mobile apps, or managed inference as the default before the MVP gates pass.
