# H3Code Before the PI-First Reset

> Snapshot date: August 10, 2026  
> Git commit: `dcc056f62213f075ff8fe7eb735edd864864c409`  
> Branch at snapshot: `codex/review-h3code-product-and-pi`  
> Purpose: preserve a concise description of the codebase immediately before the clean-slate, PI-first reset. Git history remains the source for the original files.

## Product at this point

H3Code was designed as a coding-agent workbench spanning local desktop and remote cloud environments. The product intended to own repository navigation, session presentation, transcripts, terminals, previews, diffs, Git workflows, and product metadata while leaving agent execution and canonical session state to the selected runtime.

Four product surfaces existed:

| Surface | Technology | State before reset |
| --- | --- | --- |
| Desktop | Electron, SvelteKit 2, Svelte 5, Vite, Tailwind CSS 4, shadcn-svelte/Bits UI | The most complete surface. It could run local PI sessions and presented a substantial workbench UI. |
| Cloud | TanStack React Start, React 19, Convex, Clerk, Daytona, Tailwind CSS 4, React shadcn components | An authenticated workspace shell with GitHub repository selection, persisted session rows, and sandbox provisioning. It did not run a live coding-agent loop. |
| Web | SvelteKit, Svelte 5, Tailwind CSS 4, shadcn-svelte | Marketing site. |
| Desktop Zero | Zig | Experimental lightweight native shell. |

The repository was an npm workspaces monorepo orchestrated by Turborepo. It contained four apps and seven internal packages.

## Repository shape

```text
apps/
  desktop/        Electron + SvelteKit local workbench
  cloud/          TanStack Start + Clerk + Convex cloud shell
  web/            SvelteKit marketing site
  desktop-zero/   Zig desktop experiment

packages/
  agent-provider-pi/         PI provider adapter
  agent-metadata/            Local SQLite-style metadata and preferences
  agent-protocol/            Custom shared protocol
  agent-runtime/             Runtime and projection layer
  agent-runtime-ws/          WebSocket transport
  agent-runtime-persistence/ Runtime persistence
  agent-runtime-server/      Local runtime composition server
```

## Working desktop PI path

The desktop application had a working local PI loop:

```text
Svelte renderer
  -> WebSocket RuntimeClient
    -> local agent-runtime-server
      -> custom AgentRuntime
        -> PI provider adapter
          -> PI coding agent
```

Implemented desktop behavior included:

- Local repository selection and recent repository metadata.
- PI process/session startup, listing, switching, and new-session creation.
- Prompt, steer, follow-up, and abort controls.
- Streaming assistant text, reasoning, tool activity, queue state, compaction, retry, and diagnostics.
- Transcript rendering, session statistics, diff presentation, and extension UI prompts.
- Local preferences, configurable PI executable path, session indexing, and a non-canonical display cache.
- Renderer reconnect based on PI state and message snapshots.

PI was intended to own the agent loop, tools, model behavior, authentication, queueing, compaction, canonical transcripts, and native session files. H3Code owned process supervision, repository context, presentation, preferences, and lightweight metadata.

## Cloud implementation

The cloud application had working building blocks but not a complete product loop:

- Clerk authentication and GitHub connection.
- Convex users, repositories, sessions, and simple message persistence.
- Daytona sandbox provisioning.
- A broad React workbench UI and many AI-oriented display components.

Important limitations:

- Sending a message only persisted user text to Convex; no agent consumed it.
- The workspace hard-coded `isStreaming: false`, and stop was a no-op.
- Assistant and tool messages were not represented end to end.
- The schema stored simple role/content records rather than full `UIMessage` data and resumable runtime state.
- Sandbox lifecycle, suspension, deletion, bounded usage, and secure end-to-end agent execution were incomplete.

## Architecture transition that was planned

The active documentation proposed replacing the custom runtime stack with a shared AI SDK-compatible UI boundary:

```text
Workbench UI using UIMessage/useChat
  <-> thin transport or Electron IPC
    <-> thin runtime adapter
      -> Codex app-server or PI SDK
```

The intended package target was a small PI adapter, local metadata package, and optional Daytona sandbox adapter. The following packages were marked migration-only and were not supposed to receive new product features:

- `agent-protocol`
- `agent-runtime`
- `agent-runtime-ws`
- `agent-runtime-persistence`
- `agent-runtime-server`

That target architecture had been documented but had not replaced the active desktop runtime path.

## Roadmap before reset

The active roadmap was:

| Phase | Focus | Recorded status |
| --- | --- | --- |
| 0 | Product foundation and legacy freeze | In progress |
| 1 | Desktop execution boundary and Codex path | Next |
| 2 | Complete the flagship desktop workbench | Planned |
| 3 | Independent cloud Codex workspace | Planned |
| 4 | Cloud MVP hardening and launch | Planned |
| 5 | Optional expansion | Later |

Phase 0 was not complete, and Phase 1 had not materially begun in production code. The project carried simultaneous desktop, cloud, Codex, PI, shared-protocol, AI SDK Harness, and native-shell ambitions.

## UI and theme state

The desktop used Tailwind CSS 4 and shadcn-svelte with the `mira` style, Hugeicons, and semantic OKLCH variables in `apps/desktop/src/app.css`. Light and dark tokens covered background, foreground, cards, popovers, primary/secondary/muted/accent/destructive colors, borders, inputs, rings, charts, and sidebar colors. Radius and shadow variables were also defined.

Those semantic Tailwind/shadcn color tokens are intentionally carried forward into the reset. The old generated shadcn source and all custom desktop/AI components are not carried forward; fresh components are generated from a new shadcn-svelte baseline.

## Validation snapshot

Checks run immediately before the reset review produced this baseline:

- Root build passed across all 11 workspaces, with Svelte accessibility and bundle-size warnings.
- PI provider tests passed: 28/28.
- Desktop runtime-client tests passed: 11/11.
- Desktop agent-library tests passed: 11/11.
- Runtime-server tests passed: 5/5 when rerun with socket access.
- Root `check` failed because the cloud workspace used a repository-wide Prettier check and reported 91 unformatted files.
- Root `lint` failed with 566 cloud findings, including generated/ignored directories and real source issues.
- Cloud tests failed because no test files existed and the test setup hit an ESM `module is not defined` error and a hanging Vite server.

Dependency review also found that the direct PI coding-agent version was `0.75.4` and was included in a high-severity npm advisory. Other high/critical transitive advisories were present. These versions should not be copied blindly into the new baseline.

## Main reasons for the reset

- The working PI product was buried inside a much broader platform plan.
- The repository maintained two frontend stacks and two shadcn implementations.
- The active runtime contradicted the documented target architecture.
- The cloud surface looked substantial but did not execute an agent turn.
- Generated component volume and custom UI made product decisions harder to revisit.
- Repository-wide checks were noisy enough to obscure the health of the working PI loop.

## Reset decision

The replacement project is intentionally narrower:

- Desktop first.
- PI first.
- Local repositories first.
- One frontend: Electron + SvelteKit/Svelte.
- Tailwind CSS 4 and the existing semantic color palette remain.
- shadcn-svelte is reinitialized, and only fresh upstream components are installed.
- Product behavior is rebuilt as small vertical slices instead of preserving the old workbench implementation.

The first meaningful product loop to rebuild is: select a local repository, start or resume PI, send a prompt, stream assistant/tool activity, steer or abort, recover after restart, and review resulting changes.

## Historical source pointers

Use commit `dcc056f62213f075ff8fe7eb735edd864864c409` when historical implementation detail is needed. The most useful former documents were:

- `README.md`
- `PRODUCT.md`
- `docs/h3code-roadmap.md`
- `docs/h3code-product-direction.md`
- `docs/h3code-desktop-mvp.md`
- `docs/h3code-ai-sdk-harness-architecture.md`
- `docs/h3code-cloud-saas-prd.md`
- `docs/h3code-convex-schema.md`

This brief records the old system for reference; it is not a specification for the replacement.
