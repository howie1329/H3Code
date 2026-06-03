# PRD: H3Code Cloud — SaaS Coding Agent Workbench

> Status: Draft for review. Not yet filed as a GitHub issue.
> Scope: A standalone, cloud-hosted SaaS. Independent of the Electron desktop app. Accessible from any device (laptop, desktop, mobile) through a single SvelteKit PWA.

## Problem Statement

Today H3Code only works as a local Electron desktop app. The agent runtime (`@h3code/agent-server`) runs on the user's own machine, executes the PI provider in-process, and can only operate on repositories that live on that machine's local disk. This means:

- A developer can only do agent work at the one machine where H3Code is installed and where the repo is checked out.
- There is no way to start, watch, or steer a coding session from a phone, a borrowed laptop, or a second computer.
- Nothing is shared across devices: sessions, transcripts, and diffs live behind a local WebSocket and a local SQLite metadata store.
- Setup is heavy: install Electron app, configure the provider, check out the repo locally.

The user wants to do real coding-agent work from wherever they are — including their phone — without depending on the desktop app or a local checkout, and have the agent's changes land safely in GitHub.

## Solution

A true cloud SaaS. The user signs in on the web (installable as a PWA on mobile), connects GitHub, and picks a repository. H3Code spins up a cloud sandbox, clones the repo into it, and runs a coding agent there. The user interacts with the agent **in real time** — watching streaming output, steering, aborting, following up — exactly like the desktop experience, but from any device. When the agent finishes work, it commits to a branch and opens a pull request for review. Sessions, transcripts, and diffs are persisted server-side so the same session can be opened and continued from a laptop in the morning and a phone in the afternoon. If a run finishes while the user is away, a web-push notification lets them know.

The experience is interactive pairing, not fire-and-forget job dispatch. Notifications are a convenience layer on top of live sessions, not the primary interaction model.

## User Stories

### Onboarding & Identity
1. As a solo developer, I want to sign up with email and password, so that I can access H3Code Cloud from any device.
2. As a solo developer, I want to link my GitHub account to my H3Code account, so that the agent can access my repositories.
3. As a solo developer, I want to install the web app to my phone's home screen as a PWA, so that it behaves like a native app without an app store.
4. As a solo developer, I want my session to stay signed in across devices, so that I don't re-authenticate constantly.
5. As a solo developer, I want to sign out and revoke a device, so that I control account access.

### Repository & Workspace
6. As a developer, I want to browse and search my GitHub repositories, so that I can choose what to work on.
7. As a developer, I want to select a repository and branch to start a session, so that the agent works against the right code.
8. As a developer, I want a cloud sandbox to be provisioned automatically with my repo cloned in, so that I don't manage infrastructure.
9. As a developer, I want the sandbox to stay warm while I'm actively working, so that interactions are fast.
10. As a developer, I want the sandbox to hibernate after I'm idle, so that I'm not billed for idle compute.
11. As a developer, I want a hibernated sandbox to resume with my work intact, so that I can continue where I left off.

### Provider & Models
12. As a developer, I want to choose which agent provider powers a session (multi-provider), so that I can use the runtime I prefer.
13. As a developer, I want to use managed inference by default, so that I don't have to supply API keys to get started.
14. As a power user, I want to bring my own provider API keys, so that I can use my own quota and billing.
15. As a developer, I want to switch models within a provider when capabilities allow, so that I can trade cost for quality.
16. As a developer, I want the UI to gate controls (slash commands, model picker, queue, compaction) by provider capability, so that I only see what's supported.

### Interactive Agent Session
17. As a developer, I want to send a prompt and watch the agent's response stream in real time, so that I can follow its reasoning.
18. As a developer, I want to see tool calls and their output as they happen, so that I understand what the agent is doing.
19. As a developer, I want to steer or send a follow-up message mid-run, so that I can correct course without restarting.
20. As a developer, I want to abort an active run, so that I can stop wasted work immediately.
21. As a developer, I want to see run status and connection health at all times, so that I trust the session state.
22. As a developer, I want to open the same live session on a second device and see synchronized state, so that I can move between laptop and phone seamlessly.
23. As a developer, I want to create, list, and switch between multiple sessions for a repo, so that I can manage parallel threads of work.

### Code, Diffs & Git
24. As a developer, I want to view the diff of changes the agent has made, so that I can review its work.
25. As a developer, I want to read files the agent touched (read-only viewing), so that I can understand the context.
26. As a developer, I want the agent to work on a dedicated branch, so that my main branch stays safe.
27. As a developer, I want the agent to open a pull request when work is ready, so that I can review and merge through GitHub.
28. As a developer, I want to approve a commit/PR step from the UI, so that I stay in control of what lands.
29. As a developer, I want sensible automatic branch names, so that PRs are organized.

### Persistence & History
30. As a developer, I want my sessions and transcripts saved server-side, so that I can revisit them later from any device.
31. As a developer, I want to resume a past session, so that I can continue prior work.
32. As a developer, I want to see a history of diffs per session, so that I can track what changed over time.

### Notifications
33. As a developer, I want a web-push notification when a run finishes while I'm away, so that I know when to come back.
34. As a developer, I want in-app notifications for run lifecycle events, so that I stay informed while using the app.
35. As a developer, I want to manage/disable notifications, so that I control interruptions.

### Billing & Usage
36. As a developer, I want to see my usage (compute minutes and tokens), so that I understand my costs.
37. As a developer, I want to be billed for what I use via usage-based pricing, so that I only pay for actual work.
38. As a developer, I want to add a payment method, so that I can use the service beyond any free allowance.
39. As a developer using managed inference, I want token usage metered and billed transparently, so that there are no surprises.
40. As a developer using my own keys, I want to be billed only for platform/compute, so that I'm not double-charged for inference.

## Implementation Decisions

### Codebase relationship
- Build a **separate cloud backend** in a (possibly shared) monorepo. **Reuse `@h3code/agent-core`** (provider-neutral protocol: sessions, runs, messages, capabilities, provider contract). **Do not depend** on `@h3code/agent-server`, the Electron packages, or native shell affordances, which are localhost/in-process specific.
- Web/mobile clients speak the existing H3Code WebSocket protocol so the contract stays consistent with the desktop app.

### Execution model
- Code lives and the agent executes in a **cloud sandbox/container**. Primary backend: **Daytona** (persistent, suspendable dev sandboxes that match the hybrid lifecycle). Fallback/alternative: **Vercel Sandbox** (ephemeral Firecracker microVMs) behind the same orchestrator interface.
- **Hybrid sandbox lifecycle:** warm while a session is active, hibernate after idle, resume with state intact.

### Interaction model
- **Interactive real-time pairing** is the core, mirroring the desktop loop (stream, steer, abort, follow-up). Background/async execution is explicitly *not* the primary model.
- Notifications are a convenience layer over live sessions.

### Providers
- **Multi-provider**, switchable like the desktop app, behind the `agent-core` provider contract.
- **Key model: both.** Managed inference by default (we hold keys, meter and resell tokens); BYO keys for power users (platform/compute billed only).

### Clients
- **SvelteKit PWA** for web and mobile (installable, offline-aware shell, web push). Reuses the existing design system, shadcn-svelte components, and transcript-rendering patterns. No native app-store apps in MVP.

### Identity & tenancy
- **Solo accounts only** for MVP.
- **Auth: email/password + GitHub link** via **Clerk** (recommended) with its official Convex integration; Convex Auth is the no-extra-vendor alternative. GitHub *login* (Clerk) is distinct from the GitHub *App* used for repo/PR work.

### Git integration
- **GitHub only** via a **GitHub App** for MVP.
- Git output: agent works on a **branch and opens a pull request** for review.

### Persistence
- Cloud SaaS **owns session/transcript/diff persistence** in **Convex** (its document database), a deliberate departure from the desktop boundary ("providers own transcripts"), because cross-device history requires it. Provider-native history remains the upstream source of truth where applicable; our Convex store is the durable, queryable, **reactively-synced** cross-device record. No separate SQL database or ORM is used.

### Billing
- **Usage-based billing from MVP** (Stripe): meter **compute-minutes** and, for managed inference, **tokens**. BYO-key users billed for platform/compute only.

### Major Modules (interfaces hide complexity; designed as deep modules)

Convex absorbs the realtime, persistence, scheduling, and orchestration-trigger responsibilities, so the module set is reshaped accordingly. **Architectural rule: Convex orchestrates and persists; it does not host the agent loop. The agent runs in the Daytona sandbox and streams results back into Convex.**

1. **`agent-core` (reused):** provider-neutral protocol — sessions, runs, messages, capabilities, multi-provider contract. Interface essentially unchanged; shared types used by client, Convex functions, and the in-sandbox adapter.
2. **Sandbox Orchestrator (Convex actions + Daytona client):** `acquire(repo, session) → Sandbox`, `suspend`, `resume`, `destroy`. Convex actions drive lifecycle; hides Daytona API, warm-pool management, hibernation, and the lifecycle state machine. Backend swappable (Daytona / Vercel Sandbox fallback).
3. **Provider Runtime Adapter (in-sandbox):** runs the multi-provider agent loop *inside* the sandbox, maps the provider's native stream to H3Code protocol messages, and **persists coalesced (~150–250ms debounced) chunks to Convex via HTTP**. Subscribes to a Convex "control" query to react to steer/abort. Hides PI/Codex/Cursor differences; reuses `agent-core` contracts.
4. **Realtime Sync (Convex reactive queries):** replaces a hand-rolled WebSocket gateway. Multi-device session synchronization, fan-out, and reconnection are provided by Convex subscriptions over its managed WebSocket. The only custom surface is the schema and the query/mutation functions for messages, runs, and control signals.
5. **Git/GitHub Service:** `cloneInto(sandbox)`, `diff`, `commit`, `openPR`. Hides GitHub App installation auth, branch naming, and PR creation. Invoked from Convex actions / in-sandbox steps.
6. **Identity & Billing:** Clerk (or Convex Auth) for accounts; key vault (managed + BYO) stored server-side; usage metering (`meter(event)`) written to Convex; Stripe usage-based billing driven by Convex actions/cron.
7. **Session Store (Convex tables):** durable, reactively-synced persistence of sessions, transcripts, diffs, and usage. Just Convex schema + functions — no separate database.
8. **Notification Service:** `notify(user, event)` over Web Push (VAPID) + in-app; subscriptions stored in Convex, dispatched from Convex functions on run-lifecycle events.

### Proposed stack
- **Frontend/PWA:** SvelteKit 2 + Svelte 5, Tailwind v4, shadcn-svelte, existing design system; `convex-svelte` client; Vercel AI SDK + Streamdown + Shiki for transcript rendering. `@vite-pwa/sveltekit` for installability/offline shell. **Hosted on Vercel.**
- **Backend:** **Convex** — document database, reactive queries (realtime sync), mutations/actions (orchestration triggers, GitHub, Stripe), HTTP actions (webhooks + sandbox chunk ingestion), scheduler/cron. Reuses `agent-core` types. No separate Node service, SQL database, ORM, or custom WebSocket server.
- **Sandboxes:** **Daytona** (primary) running the agent + in-sandbox Provider Runtime Adapter; **Vercel Sandbox** as a swappable fallback behind the orchestrator interface.
- **Realtime:** Convex reactive subscriptions (no custom gateway).
- **Auth:** **Clerk** (recommended) with Convex integration, or Convex Auth. Email/password + GitHub login. Separate GitHub App for repo/PR work.
- **Billing:** Stripe usage-based (metered from Convex).
- **Notifications:** Web Push (VAPID) + in-app, dispatched from Convex.

### Deployment topology
```txt
SvelteKit PWA (Vercel)
  │  Convex client (reactive queries + mutations over Convex WSS)
  ▼
Convex (DB, reactive sync, actions, HTTP actions, cron)
  │  action: acquire/resume/suspend         ▲  HTTP: batched chunk writes
  ▼                                          │
Daytona sandbox  ── runs agent + Provider Runtime Adapter ──┘
  ├─► GitHub App (clone, diff, commit, PR)
  └─► provider runtime (managed inference or BYO keys)
Convex ─► Stripe (usage billing)   Convex ─► Web Push (notifications)
```

## Testing Decisions

A good test verifies **external, observable behavior through a module's public interface**, not internal implementation details. Tests should treat each deep module as a black box, drive it through its documented interface, and assert on outputs and state transitions a caller would observe. They must not assert on private structure, exact internal call sequences, or provider-specific shapes that the protocol is designed to hide. Prior art: the existing Node tests for `@h3code/agent-server` (`npm run test --workspace @h3code/agent-server`); for Convex functions, use `convex-test` with Vitest.

Modules to be tested in the MVP:

- **Sandbox Orchestrator:** lifecycle state machine — acquire → active → suspend → resume → destroy, including resume-with-state and idle hibernation transitions. Daytona client mocked behind the interface; Convex actions tested with `convex-test`.
- **Provider Runtime Adapter:** mapping of a provider's native event stream into H3Code protocol messages (run lifecycle, streaming assistant output, tool blocks, abort/steer), plus correct chunk coalescing/debounce before persistence. Provider mocked; assert protocol output and batched writes.
- **Realtime Sync (Convex functions):** message/run/control query+mutation behavior — two subscribers to one session observe consistent, ordered state; control writes (steer/abort) are visible to the in-sandbox subscriber. Tested with `convex-test`.
- **Session Store (Convex schema + functions):** persistence round-trips — sessions, transcripts, and diffs save and reload faithfully; resume returns prior state.

Modules **not** prioritized for tests in MVP (manual/integration verification instead): Git/GitHub Service, Identity & Billing, Notification Service.

## Out of Scope

- The Electron desktop app and any dependency on `@h3code/agent-server` or native shell affordances. This SaaS is standalone.
- Native iOS/Android app-store applications (PWA only for MVP).
- Teams/orgs, shared workspaces, roles, and permissions (solo accounts only; future version).
- Git hosts other than GitHub (no GitLab/Bitbucket in MVP).
- Full in-browser code editor / manual file editing (MVP is chat + diff viewing + approve/commit; editor is a future version).
- Direct-push git workflow and per-session PR-vs-push choice (MVP is branch + PR only).
- Fire-and-forget/background autonomous agents as a primary model.
- Connecting the cloud agent back to a user's local machine/repo.

## Further Notes

### Suggested MVP boundary
Sign in via Clerk (email/password) → link GitHub (GitHub App) → pick repo + branch → Convex action provisions a warm Daytona sandbox and clones the repo → interactive multi-provider session, with the in-sandbox agent streaming coalesced chunks into Convex and all devices syncing via reactive queries (stream, steer, abort, follow-up) with managed inference by default → review diffs (read-only) → agent commits to a branch and opens a PR → sessions/transcripts/diffs persisted in Convex for cross-device resume → idle hibernation → web-push on run completion → usage-based billing (compute-minutes + managed tokens).

### Future versions (post-MVP)
- Full in-browser Monaco editor with manual editing and inline approvals.
- Teams/orgs: shared workspaces, roles, seat + usage billing.
- Additional git hosts (GitLab, Bitbucket).
- Native mobile apps (Capacitor/React Native) if PWA limits bite.
- Direct-push workflow and per-session git strategy selection.
- Richer notifications (email digests, mobile push beyond web push, Slack).
- Optional background/async task runs layered on top of the interactive core.

### Key risks / open questions to revisit
- Daytona cost and cold-resume latency vs. the warm-experience target; validate hybrid lifecycle economics against usage-based pricing.
- **Convex streaming cost/throughput:** per-token writes are infeasible — the in-sandbox adapter must coalesce chunks (~150–250ms) before persisting. Validate write volume and bandwidth against Convex pricing under realistic transcripts.
- **Convex function limits:** actions are short-lived (~minutes), so the long-running agent loop must live in the sandbox, with Convex only orchestrating and persisting. Confirm the control-channel pattern (sandbox subscribing to a Convex control query) meets steer/abort latency expectations.
- Web Push reliability on iOS PWAs (requires installed PWA; historically constrained).
- Secure secret handling for managed and BYO keys inside ephemeral sandboxes; where the GitHub App installation token and provider keys are injected.
- Clerk vs Convex Auth: vendor cost/lock-in vs. single-system simplicity — decide before building auth.
