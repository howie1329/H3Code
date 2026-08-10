# H3Code V2 Product and Architecture Brief

> Status: Draft direction captured on August 10, 2026. This document defines the V2 rewrite and does not describe the current implementation.

## Product in One Sentence

H3Code is a local-first Electron desktop interface that makes multiple concurrent Pi Threads across local Git repositories easy to start, monitor, control, resume, and review.

## Product Position

H3Code is the UI layer for Pi. It does not own an agent loop, invent a provider-neutral runtime, or replace Pi's canonical conversation state.

Pi owns:

- Agent and tool execution.
- Models, providers, thinking levels, and authentication.
- Native conversation state, compaction, and runtime behavior.
- Repository tools and the changes they make.

H3Code owns:

- The Electron desktop experience and React renderer.
- Repository and Thread navigation.
- Supervision and presentation of multiple concurrent Pi Threads.
- Product-safe communication between the renderer and the Pi runtime.
- Lightweight indexes and preferences needed to reopen the workbench.
- Diff and Git-oriented review of the shared local checkout.

## Settled V2 Decisions

- The desktop host is Electron.
- The renderer is React.
- Pi is the only agent runtime in scope.
- Vercel AI SDK 7 harness support is the first integration path to Pi.
- A separate `pi-runtime` workspace package contains AI SDK integration and any additional Pi-specific connection code.
- Every H3Code Thread is backed by exactly one canonical Pi session.
- Multiple Threads may run simultaneously across one or more Repositories.
- Navigating away from a Thread does not stop, detach, or abort its Active Turn.
- Multiple Threads may share and modify the same local checkout in the MVP.
- Model and thinking-level selectors are required in the first complete loop.
- Abort stops the selected Thread's current Turn without destroying the Thread.
- H3Code remains local-first. Repository contents, edits, and H3Code-owned state stay local unless Pi or an explicitly invoked tool performs a network operation.

## Runtime Shape

```text
React renderer
  -> typed Electron bridge
    -> Electron main process
      -> pi-runtime package
        -> Thread supervisor
          -> Pi Thread A
          -> Pi Thread B
          -> Pi Thread C
```

The renderer is a view over runtime state. React component mounting, route changes, and selected-Thread changes must not own or determine the lifetime of a Pi Thread.

The `pi-runtime` package owns the registry of live Threads and the operations that target them. Its interface should remain Pi-specific rather than becoming a generic agent protocol.

The package may use both Vercel AI SDK and Pi packages, but it must not create two competing live session owners for one Thread. Supplementary Pi facilities such as model discovery or settings access may surround a harness-backed Thread. If a missing capability requires direct control of the conversation, H3Code must extend the existing connection to the same Pi session or use a direct-Pi implementation for the entire Thread.

## Required Runtime Capabilities

The renderer needs a small typed surface equivalent to:

```ts
interface PiRuntime {
  listModels(): Promise<PiModel[]>;
  listThreads(): Promise<ThreadSummary[]>;
  createThread(input: CreateThreadInput): Promise<ThreadSummary>;
  resumeThread(threadId: string): Promise<void>;
  prompt(threadId: string, input: PromptInput): Promise<void>;
  steer(threadId: string, message: string): Promise<void>;
  followUp(threadId: string, message: string): Promise<void>;
  abort(threadId: string): Promise<void>;
  setModel(threadId: string, modelId: string): Promise<void>;
  setThinkingLevel(
    threadId: string,
    level: PiThinkingLevel,
  ): Promise<void>;
  subscribe(listener: (event: PiRuntimeEvent) => void): () => void;
}
```

This is a directional interface, not a frozen implementation contract. The first runtime spike should reduce it to the smallest surface proven necessary by Pi and AI SDK behavior.

## Concurrent Thread Semantics

A Repository and a Thread have a many-to-one relationship: many Threads may point at the same Repository path.

For the MVP:

- There are no automatic Git worktrees, clones, file locks, or edit queues.
- Every Thread sharing a Repository receives the same working directory.
- Each Thread has independent Pi state, model selection, thinking level, Turn state, stream, and abort control.
- Filesystem and Git changes are shared immediately between Threads.
- Repository diffs describe the checkout as a whole and are not assumed to belong to one Thread.
- H3Code should indicate when a checkout is shared by multiple live Threads, but it should not block concurrent work.

This intentionally accepts several risks for the MVP:

- Concurrent edits may conflict or overwrite one another.
- A branch change made by one Thread changes the branch seen by every Thread using that checkout.
- A Thread's conversational assumptions may become stale after another Thread changes files.

Worktree isolation may be added later by assigning a Thread a different local repository path without changing the Thread lifecycle model.

## First Complete Loop

A user can:

1. Add or select a local Repository.
2. Create a Pi Thread with an explicit model and thinking level.
3. Send a prompt and see text, reasoning, tool activity, approvals, file changes, and errors stream in place.
4. Navigate to other Repositories and Threads while the original Turn continues.
5. Run multiple Turns concurrently in different Threads, including Threads sharing one checkout.
6. Steer, follow up, or abort the selected Thread using Pi behavior.
7. Return to a background Thread and see its current state and accumulated output.
8. Resume the expected Pi history after a supported application restart.
9. Review the current files and Git diff for the Repository.

## AI SDK Harness Acceptance Gate

Vercel AI SDK 7 harness support is the preferred first path, but the product contract is Pi fidelity rather than harness adoption. Before the MVP depends on the harness end to end, a focused spike must prove that it can:

1. Keep multiple Pi Threads running concurrently while the renderer switches views.
2. Operate against the selected local checkout with the required local filesystem and command behavior.
3. Populate the model selector and support every required Pi thinking level.
4. Preserve one canonical Pi history through Turn aborts and application restarts.
5. Expose enough Pi behavior for prompt, steer, follow-up, abort, tool approvals, and compaction presentation.

When the harness does not expose a required capability, the `pi-runtime` package owns the narrow Pi-specific connection needed to close that gap. The renderer must not know which underlying integration supplies an event or command.

## Local-First Boundary

- The renderer never receives provider credentials or unrestricted Node APIs.
- Repository paths are validated before becoming Pi working directories.
- H3Code does not upload repositories, transcripts, diffs, or usage telemetry to an H3Code service.
- Pi authentication and provider requests follow Pi behavior.
- H3Code persistence is limited to product preferences, Repository indexes, Thread indexes, and runtime resume information that Pi or the integration requires.
- Pi remains the source of truth for conversation content and agent state.

## Explicit Non-Goals for the MVP

- Additional agent runtimes or a universal agent protocol.
- Cloud workspaces, remote repositories, accounts, teams, collaboration, or billing.
- Automatic worktree management or concurrent-edit conflict resolution.
- A browser-based code editor.
- H3Code-owned model inference or agent orchestration.
- Attribution of every repository change to a specific Thread.

## Open Decisions

These questions remain intentionally unresolved:

- Whether Active Turns must survive the entire Electron application exiting, rather than only renderer navigation and reloads.
- The exact process topology for `pi-runtime`: Electron main, one long-lived child process, or isolated worker processes.
- The required level of compatibility with existing Pi extensions, commands, prompt templates, skills, settings, and session files in the first release.
- The first-release permission experience for shell commands and file changes.
- Attachment and image support in the first prompt flow.
- Packaging, signing, auto-update, and initial operating-system support.

## First Engineering Slice

Build a disposable runtime spike before constructing the full workbench UI:

1. Create the React + Electron shell and the `pi-runtime` package boundary.
2. Select two local Repositories.
3. Start at least three Pi Threads, with two sharing one checkout.
4. Stream all Threads concurrently while switching the selected view.
5. Exercise model selection, thinking selection, steer, follow-up, and abort.
6. Confirm that local edits and commands affect the expected checkout.
7. Restart at the supported lifecycle boundary and verify canonical history.

The spike should decide the smallest viable AI SDK/Pi connection. Product UI depth follows only after this execution loop is proven.
