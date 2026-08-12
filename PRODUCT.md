# H3Code Product Brief

> Status: Active product direction as of August 12, 2026.

## Product in one sentence

H3Code is a local Pi development workbench for starting, supervising, resuming, and reviewing multiple concurrent coding-agent Threads across local Git repositories.

## First user

The first user is a developer who works in local Git repositories and wants a clearer interface for long-running coding-agent work than a collection of terminal windows.

## Product purpose

H3Code is first and foremost a desktop UI wrapper around Pi: a Pi IDE that can use Pi to improve any Repository, including H3Code itself. It replaces terminal juggling with an attention dashboard: users can see which Threads are active, waiting for approval, failed, or complete; which Repository each Thread affects; and what changed. Users control concurrent Pi work without reconstructing its state across terminal windows.

Self-development is ordinary product behavior, not a privileged agent mode. A developer opens the H3Code Repository, asks Pi to change it, reviews the shared checkout, runs explicit checks, and starts a separate development instance when desired. H3Code never silently updates or replaces the currently running application.

Future Agent Runtimes may use the same workbench, but they do not shape the Pi implementation before they are concrete product work.

## Product direction

H3Code begins with Pi. Codex, Claude Code, and other coding-agent runtimes may be added after the Pi experience is dependable.

Each Runtime Integration uses the runtime's strongest supported programmatic boundary. For Pi, H3Code embeds a tested version of the Pi SDK in a dedicated bridge process, following the provider-specific bridge pattern proven by BB. The bridge loads the user's normal Pi configuration and translates native Pi commands and events into H3Code's small Thread contract.

Vercel AI SDK harnesses may be evaluated for later Agent Runtimes when they preserve the required native behavior. They are not H3Code's product boundary, and `@ai-sdk/harness-pi` is not used for Pi. H3Code does not reduce every runtime to a lowest-common-denominator protocol and does not integrate model providers directly.

Agent Runtimes own:

- Agent and tool execution.
- Model-provider behavior and authentication.
- Native runtime behavior such as compaction, retry, interruption, and permissions.
- Canonical sessions and conversation history.

H3Code owns:

- Electron process supervision and operating-system integration.
- Runtime Integration packages and a narrow typed renderer bridge.
- Local Repository registration and workspace presentation.
- Thread navigation and readable streaming presentation.
- Controls that faithfully map to each Agent Runtime's behavior.
- Lightweight local preferences, indexes, and resume references.
- Diff and Git-oriented review around the shared local checkout.
- Supervision of multiple concurrent Threads independently of the selected view.

H3Code will not own an agent loop, duplicate a runtime's canonical conversation state, or introduce a universal agent protocol before multiple real integrations prove a shared contract.

## Thread and integration contract

- One Thread is permanently associated with one Agent Runtime and exactly one canonical runtime-owned session.
- One Pi SDK session owns the canonical conversation for a Thread. H3Code never creates a second transcript or conversation owner.
- A dedicated Pi bridge process hosts the Pi SDK, supervises multiple live Pi sessions, and translates native commands and events.
- The bridge uses Pi's normal resource and configuration services so authentication, settings, packages, extensions, skills, prompt templates, themes, context files, custom models, and shell behavior remain Pi-owned.
- The bridge executes against the validated local Repository rather than a sandbox mirror.
- The renderer consumes a small Pi-proven workbench contract: Thread and runtime identity, lifecycle and attention state, presentation events, prompt, and abort.
- Optional controls such as steer, follow-up, approvals, and model controls are exposed as explicit capabilities. The contract grows from implemented runtime behavior, not hypothetical parity.

## Local-only boundary

H3Code runs on the user's computer against local repositories. It has no H3Code account, hosted backend, cloud workspace, cloud sync, or H3Code telemetry service.

Repository contents, H3Code-owned preferences and indexes, and runtime resume references remain local. Agent Runtimes may contact their model providers, and explicitly invoked tools may use the network according to the runtime's behavior and permissions.

H3Code may persist registered Repository roots, Thread IDs and runtime session references, Thread-to-Repository relationships, the last selected Repository and Thread, window and UI preferences, and small derived navigation summaries. Derived data is a rebuildable index; runtime conversation history remains canonical and is not copied into H3Code storage.

## Pi session discovery and Thread creation

- H3Code-created Threads use deterministic H3Code-owned Pi session paths so Repository grouping, restart recovery, and Thread identity remain predictable.
- For a registered Repository, H3Code can discover and import resumable terminal-created Pi sessions by reference. Import never copies the canonical conversation.
- H3Code-created and imported Threads remain ordinary canonical Pi sessions; the distinction is their storage path and how H3Code indexes them.
- Opening or exporting an H3Code-created session for terminal Pi is deferred until the first workbench loop proves it is necessary.
- A new Thread begins with Pi's current default model and thinking level preselected.
- The user may change model and thinking level before the first prompt and later when Pi permits it.
- Each Thread has an editable H3Code-owned display title associated with, but distinct from, its canonical Pi session identity.
- H3Code seeds the editable title locally from the first prompt. It does not call a separate model or model provider to generate navigation titles.

## First complete loop

A user can:

1. Register or select a local Repository.
2. Create or resume a Pi-backed Thread in that Repository.
3. Send a prompt and see text, reasoning, tool activity, approvals, file changes, and errors stream in place.
4. Navigate to another Repository or Thread without stopping an active Turn.
5. Run multiple Threads concurrently, including Threads that share one checkout.
6. Steer, follow up, or abort the selected Thread using Pi's real behavior.
7. Restart H3Code and recover the expected runtime-owned Thread history.
8. Review the current files and Git diff for the Repository.

That loop is the product gate. Work that does not improve it waits.

## Concurrent Thread semantics

- Each Thread has independent runtime state, Turn state, stream, and abort control.
- Selecting a different view does not stop or detach an active Turn.
- Multiple Threads may use the same Repository path.
- Threads sharing a Repository see the same files and Git state immediately.
- Repository diffs describe the checkout as a whole and are not attributed to one Thread.
- H3Code should make shared-checkout risk visible without adding automatic locks, edit queues, clones, or worktrees in the first release.
- H3Code imposes no artificial limit on concurrent Active Turns initially. It exposes active work and abort controls; resource warnings or configurable limits require evidence from real use.
- A Shared Checkout has a persistent indicator showing its participating Threads, current branch, and Repository-wide dirty state.
- H3Code warns before user-initiated Git operations that affect every Thread using a Shared Checkout.
- H3Code does not detect overlapping edits or block Agent Runtime tool operations initially.

## Thread attention and messaging

Every Thread exposes one of these Attention States in global navigation:

- Idle.
- Running.
- Waiting for Approval.
- Follow-up Queued.
- Failed.
- Interrupted.

A completed Turn returns its durable Thread to Idle. While a Turn is active, the normal composer queues a Follow-up and a separate Steer action injects guidance into the Active Turn. H3Code never guesses between those Pi-native behaviors.

## Approvals

H3Code faithfully presents Pi-native approval requests and makes waiting-for-approval state prominent. It does not introduce persistent allowlists or a second permission policy in the first release.

## Pi runtime availability

H3Code ships a tested Pi SDK dependency as part of `runtime-pi`; it does not install or invoke a separate Pi CLI. Settings report the embedded Pi runtime version and configuration errors. H3Code reads compatible Pi configuration through Pi's own services and never collects provider credentials.

## Pi session storage

H3Code-created Threads use deterministic H3Code-owned paths similar to BB. Each Thread still has exactly one canonical Pi JSONL session file; H3Code stores only its index and display metadata. Existing terminal-created Pi sessions may be imported by reference and remain at their native paths.

## Navigation and removal

- Navigation is Repository-first, with Threads nested under their Repository and global indicators for Threads that are running, waiting, or failed.
- Archiving a Thread hides it from normal H3Code navigation without deleting its canonical Pi session.
- Permanent Pi session deletion is not part of the first release.
- Removing a Repository unregisters it from H3Code. It never deletes local files, Git data, or Pi sessions.
- A Repository with Active Turns cannot be unregistered until those Turns are aborted.

## Quit behavior

When the user tries to quit with Active Turns, H3Code offers Cancel or Quit and Abort Active Turns. The application does not imply that work continues after its process exits.

## Background attention

- A background Thread remains unread when its Turn completes, fails, or requires approval until the user views it.
- Unread state is local, rebuildable navigation metadata rather than runtime conversation state.
- Native macOS notifications are deferred. When added, they should be configurable and limited to unselected Threads that require approval, fail, or finish a Turn.

## Runtime events and recovery

- H3Code does not add automatic retry behavior. It presents Pi failures and Pi-native retry or continue controls.
- Pi compaction appears as a quiet inline transcript marker with details available on demand, not as an error.
- H3Code mirrors Pi's Follow-up queue exactly. It shows the runtime-owned ordered queue and supports editing or removal only when Pi supports those operations.
- Archiving a Thread with an Active Turn requires explicit Abort and Archive confirmation.
- Re-registering a Repository rediscovers its canonical Pi sessions and restores surviving H3Code display metadata by session identity.
- Starting a second concurrent Active Turn in one Repository triggers a non-blocking Shared Checkout confirmation. Idle Threads alone do not trigger it; persistent shared state remains visible after confirmation.

## Review scope

The first review surface shows the Repository's live working-tree diff. It does not preserve per-Turn snapshots or attribute changes to a Thread.

## Repository registration

H3Code accepts a directory contained in a normal Git worktree and registers the resolved worktree root as the Repository. Bare repositories and directories outside a Git worktree are not supported initially.

Repository paths must be validated before they become Agent Runtime working directories.

## Application lifecycle

- Active Turns continue while the user navigates between Repositories and Threads or reloads the renderer.
- Quitting the Electron application may terminate an Active Turn in the first release.
- Relaunching H3Code restores registered Repositories, Thread references, and completed canonical runtime history.
- Keeping Active Turns alive after the Electron application exits is deferred until the product requires a separate background process.

## Sequence

### 0. Clean foundation — complete

- One Electron + SvelteKit application.
- Tailwind CSS 4 with the retained semantic palette.
- Fresh shadcn-svelte configuration and component source.
- No legacy runtime, cloud surface, shared protocol, or custom component library.

### 1. Pi execution proof — next

- Choose and validate local Repositories.
- Create `packages/runtime-pi` with a dedicated Node bridge process hosting a pinned Pi SDK.
- Load normal Pi authentication, settings, packages, extensions, skills, prompts, themes, context files, custom models, and shell configuration.
- Prove the bridge against the real local checkout, session, model, and control requirements.
- Expose a small typed Electron-to-renderer contract.
- Stream one real Turn and support abort.
- Prove existing Pi authentication, model discovery, thinking-level selection, tool approvals, normal skills, and essential settings.
- Prove canonical Pi session creation and resume without copying its conversation history.

### 2. Concurrent Pi Threads

- Create, resume, and switch runtime-owned Threads.
- Keep active Turns running independently of renderer navigation.
- Add steer and follow-up.
- Run multiple Threads concurrently, including against one shared Repository.
- Recover completed canonical history after application restart.

### 3. Workbench depth

- Thread navigation and background activity status.
- Diff and changed-file review.
- A development workspace mode when real usage demands it: explicit development-server start and restart, checks and builds, logs, and diff review.
- Load Pi extensions through Pi first and present the events, requests, and dialogs they emit. Add a richer graphical extension host only for proven extension workflows.
- Interactive terminal visibility only when a later concrete workflow requires manual intervention.
- Local Git actions only after review behavior is dependable.

### 4. Additional Agent Runtimes

- Add a Runtime Integration only for a concrete supported runtime.
- Use its native wire protocol, SDK bridge, or AI SDK harness according to which boundary preserves the required runtime behavior.
- Extract shared contracts from working integrations rather than predicting them in advance.

## Explicit non-goals

Until the local Pi loop is excellent:

- H3Code accounts, hosted services, cloud workspaces, teams, collaboration, billing, and remote repositories.
- Additional Agent Runtimes beyond Pi.
- Direct model-provider integrations.
- A universal agent protocol or lowest-common-denominator runtime abstraction.
- A browser-based editor, managed inference, or H3Code-owned agent loop.
- Automatic worktree management or concurrent-edit conflict resolution.
- Attribution of every Repository change to a specific Thread.
- An interactive terminal in the first complete loop.
- Windows or Linux packaging, signing, and auto-update before the macOS Pi loop is proven.

## Initial platform

The first usable release targets macOS. Windows and Linux process behavior, packaging, signing, and distribution follow after the local Pi loop is proven.
