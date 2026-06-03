# H3Code Platform Vision

> Status: Draft. Companion to [h3code-cloud-saas-prd.md](./h3code-cloud-saas-prd.md) (cloud MVP scope).
>
> Related: [h3code-unified-client.md](./h3code-unified-client.md), [h3code-desktop-evolution.md](./h3code-desktop-evolution.md), [h3code-convex-schema.md](./h3code-convex-schema.md)

## Summary

H3Code is evolving from a **local-only Electron workbench** into a **two-legged product**: a desktop agent on the developer’s machine, plus a **cloud agent platform** reachable from the web (and eventually from the same UI inside Electron). The product class is the same as **Cursor**: local agent in an app shell, cloud agents in isolated sandboxes, multiple clients on one backend.

This document is the **product map**. Cloud MVP requirements live in the cloud PRD; implementation detail for the shared client and Convex live in sibling docs.

## What H3Code Is Today

```txt
apps/desktop (Electron + SvelteKit)
  → WebSocket → @h3code/agent-server (localhost)
    → PiAgentProvider (@h3code/pi-provider, PI SDK in-process)

packages/agent-core     — H3Code protocol + AgentProvider contract
packages/agent-metadata — SQLite prefs, session index, message display cache
apps/web                — marketing only
```

**Boundary today:** Providers own sessions, tools, and runtime behavior. H3Code owns the shell, local orchestration, and a **projection** of provider events into H3Code-shaped UI state—not canonical transcripts at the product level (desktop caches for display).

## What H3Code Is Becoming

```txt
H3Code (product)
├── Local workbench     — agent on disk: folder picker, local provider, optional Convex cache
└── Cloud platform      — agent in sandbox: Clerk, GitHub repos, Daytona, Convex, PR workflow
```

Both legs speak **`agent-core`** at the UI boundary. Both can share **one TanStack Start client** with `runtime: desktop | cloud` (see [unified client doc](./h3code-unified-client.md)).

## Cursor Parity (Conceptual, Not a Clone)

| Surface | Cursor | H3Code (direction) |
|--------|--------|---------------------|
| Local agent | Harness + tools inside VS Code fork | Wrapped provider (PI MVP) via local Agent Server; optional future own harness |
| Cloud agent | VM per agent, clone repo, PR | Daytona sandbox + Convex + Clerk git |
| Clients | IDE, web, mobile PWA, Slack, GitHub, API | PWA on Vercel (MVP); Electron hosting same SPA (desktop runtime); API later |
| Streaming to UI | Append-only store + clients | Convex reactive queries + coalesced writes from sandbox |
| Harness ownership | Cursor-owned (Composer, Temporal loop) | **Provider-owned loop** (PI, etc.); H3Code owns shell + protocol + adapters |

**Differentiation:** Provider-neutral workbench—wrap mature agents (PI, later Claude Code / Codex) instead of betting everything on one in-house harness and model.

## Architectural Patterns

### Pattern A — Wrap providers (MVP)

- Agent loop runs **inside** the provider runtime (PI SDK locally; PI in Daytona for cloud).
- H3Code **adapter** maps native stream → `agent-core` events → UI / Convex.
- Convex stores **H3Code-shaped** messages for display and reload—not provider-native blobs.

### Pattern B — Own harness (future)

- H3Code runs the loop (e.g. AI SDK in sandbox or durable orchestrator).
- Providers become **model backends**; tools are H3-owned (`h3-tools`).
- Closer to Cursor cloud; larger investment (eval, tool design, Temporal-class orchestration if runs are days-long).

**Decision:** Ship Pattern A for cloud and desktop; revisit Pattern B when wrapping limits quality or control.

### Three decoupled layers (learned from Cursor cloud)

1. **Agent loop** — provider (A) or harness (B).
2. **Machine state** — local repo + process, or Daytona sandbox (hibernate/resume).
3. **Conversation state** — Convex for cloud; optional Convex + SQLite for desktop fast paint.

**Continue vs reload:** Convex (and desktop cache) answer **fast UI reload**. **Continuing the agent** requires provider reconnect with stored `providerId` + `providerSessionRef`, or replay into provider on cold start—not automatic from Convex alone.

## Phased Roadmap

### Phase 0 — Today

- Electron desktop, local Agent Server, PI only.
- SvelteKit UI; SQLite metadata cache.

### Phase 1 — Cloud MVP

- New app: `apps/cloud` (TanStack Start on Vercel).
- Convex + Clerk + Daytona; PI-only in sandbox; branch + PR.
- PWA; usage billing (Stripe).
- See [cloud PRD](./h3code-cloud-saas-prd.md).

### Phase 2 — Unified client

- TanStack UI extracted to shared packages; `runtime: cloud` on Vercel.
- Electron loads **same SPA** with `runtime: desktop` (folder picker, local Agent Server).
- Redesigned transcript / tool-call UI (React ecosystem).
- See [unified client doc](./h3code-unified-client.md).

### Phase 3 — Provider expansion

- Claude Code + Codex adapters (API-key auth) behind `agent-core`.
- GitHub App optional upgrade from Clerk OAuth if webhooks / bot identity needed.

### Phase 4 — Desktop cloud mode

- Desktop app as **client** for cloud sessions (Cursor “Cloud” in dropdown)—same Convex backend, no second UI codebase.

### Phase 5 — Optional depth

- Own harness (Pattern B), Temporal or Convex Workflows for durable loops.
- Teams/orgs, more git hosts, Monaco editor, native mobile if PWA limits bite.
- Desktop evolution: in-process host, native tools—[desktop evolution doc](./h3code-desktop-evolution.md).

## Repository Layout (Target)

```txt
apps/
  web/           # marketing (unchanged)
  desktop/       # Electron shell → loads unified SPA (Phase 2+); until then current Svelte app
  cloud/         # TanStack Start, Vercel, runtime=cloud
packages/
  agent-core/    # protocol (shared)
  agent-server/  # local host (desktop); cloud uses Convex instead of WS to browser
  pi-provider/   # PI adapter (local + in-sandbox)
  agent-metadata/# desktop prefs/cache (may shrink if Convex owns display cache)
  # Phase 2+
  app-shell/     # layout, transcript, composer (presentational)
  runtime-cloud/ # Clerk, repos, Convex mutations
  runtime-desktop/ # folder picker bridge, local agent IPC/WS
```

## Cross-Cutting Decisions

| Topic | Decision |
|-------|----------|
| Cloud app vs extend `apps/web` | **New `apps/cloud`**, not marketing site |
| Frontend (cloud + unified) | **TanStack Start (React)** — new UI; not reusing Svelte AI Elements |
| Backend (cloud) | **Convex** — DB, realtime, actions, cron |
| Sandboxes | **Daytona** primary; Vercel Sandbox fallback behind orchestrator interface |
| Auth (cloud) | **Clerk** (email/password + GitHub OAuth `repo` scope) |
| Git (cloud MVP) | Clerk token for clone/push; **GitHub App deferred** |
| Composio | **Not** for repo clone; wrong tool for `git clone` |
| AI SDK | **Auxiliary only** (PR copy, summaries in Convex actions)—not agent loop or UI stream transport |
| Multi-provider MVP | **PI only**; Claude Code + Codex Phase 3 |
| Cross-device resume | **Cloud:** in-platform resume (laptop ↔ phone). **Cloud → desktop local:** optional / deferred for MVP |
| Desktop shell | **Electron** for now; Tauri / zero-native (`apps/desktop-zero`) optional later |

## Success Criteria (Platform)

- A developer can run an agent on a **local folder** (desktop) or a **GitHub repo in the cloud** (PWA) with the same interaction model: stream, steer, abort, diff, PR (cloud).
- UI speaks only **H3Code protocol** shapes; swapping PI for another provider does not rewrite the shell.
- One Convex project can serve cloud sessions and optional desktop display cache without conflating `execution: local | cloud` session types.

## Open Questions

- Confirm Clerk GitHub OAuth token retrieval with `repo` scope on chosen plan.
- Managed inference markup vs provider ToS (BYO keys fallback).
- Sandbox retention TTL vs cost vs resume fidelity.
- When to commit to Pattern B harness vs staying provider-wrap forever.

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Platform = local + cloud, not cloud-only | Matches Cursor and user workflow; desktop remains first-class | 2026-06 |
| TanStack Start for new UI | Redesign tool-call/transcript; React AI ecosystem; Convex/Clerk maturity | 2026-06 |
| Clerk for git MVP, not GitHub App | Faster integration; acts as user on git | 2026-06 |
| PI-only cloud MVP | Prove sandbox + Convex loop before N adapters | 2026-06 |
| Unified SPA with `runtime` | One UI; Electron + Vercel hosts | 2026-06 |
