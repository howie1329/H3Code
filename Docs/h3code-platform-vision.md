# H3Code Platform Vision

> Status: Draft. Companion to [h3code-cloud-saas-prd.md](./h3code-cloud-saas-prd.md) (cloud MVP scope).
>
> **Architecture:** [h3code-ai-sdk-harness-architecture.md](./h3code-ai-sdk-harness-architecture.md) is the target agent stack. Related: [h3code-unified-client.md](./h3code-unified-client.md), [h3code-desktop-evolution.md](./h3code-desktop-evolution.md), [h3code-convex-schema.md](./h3code-convex-schema.md).

## Summary

H3Code is a **coding-agent workbench** (desktop + cloud): shell, workspace, git/PR workflow, and persistence—not a custom agent runtime.

Agent execution is delegated to **AI SDK Harness** (`HarnessAgent` + Pi / Codex / Claude Code adapters). The UI speaks **`UIMessage`** from the `ai` package end to end. H3Code does not maintain a parallel protocol, event bus, or read-model projector.

## What H3Code is today (transition)

```txt
apps/desktop (Electron + SvelteKit)
  → WebSocket → agent-runtime-server → PiProviderAdapter (legacy)

packages/agent-protocol, agent-runtime*, agent-provider-pi, agent-metadata
apps/cloud — Clerk, Convex, Daytona provision; agent harness not wired yet
```

Legacy stack remains until desktop migrates to harness + `UIMessage`. **New work** follows [h3code-ai-sdk-harness-architecture.md](./h3code-ai-sdk-harness-architecture.md).

## What H3Code is becoming

```txt
H3Code (product)
├── Workbench UI        — TanStack + useChat, transcript from UIMessage.parts
├── Workspace layer     — local folder (desktop) | GitHub + Daytona (cloud)
├── Agent host          — HarnessAgent + sandbox provider (thin; mostly AI SDK)
└── Product persistence — agent-metadata (local) | Convex (cloud sessions + messages)
```

```txt
packages/
  agent-provider-pi/   # HarnessAgent factories (Pi + sandbox wiring)
  agent-metadata/      # Local SQLite metadata + optional UI snapshot cache
  sandbox-daytona/     # (planned) cloud HarnessV1SandboxProvider
```

## Cursor parity (conceptual)

| Surface | Cursor | H3Code (direction) |
|--------|--------|---------------------|
| Local agent | IDE-integrated harness | HarnessAgent(Pi) + just-bash on `repoPath` in Electron host |
| Cloud agent | VM per session | HarnessAgent in Daytona sandbox + Convex |
| Clients | IDE, web, mobile | PWA + Electron hosting same TanStack SPA |
| Streaming | Append-only UI store | Convex queries + `UIMessage` stream |
| Agent ownership | Cursor harness | **AI SDK harness adapters**; H3Code owns shell + workspace |

**Differentiation:** Multi-harness workbench (Pi, Codex, Claude Code) via AI SDK adapters—not maintaining our own provider protocol.

## Architectural model

### Agent layer — AI SDK Harness (target)

- `HarnessAgent` + `@ai-sdk/harness-pi` (MVP), later `@ai-sdk/harness-codex`, `@ai-sdk/harness-claude-code`.
- Streams map to `UIMessage` via `toUIMessageStream`; no H3Code converter.
- Session resume via harness `resumeFrom` blobs, keyed by H3Code `sessionId`.

### Machine layer — unchanged

- **Desktop:** local repo on disk (via just-bash overlay).
- **Cloud:** one Daytona sandbox per session; hibernate when idle; parallel sessions → separate sandboxes + work branches.

### Conversation layer — simplified

- **Cloud:** Convex stores `UIMessage`-compatible message rows + harness resume metadata.
- **Desktop:** harness owns live state; optional SQLite snapshot in `agent-metadata` for fast reload only.

## Phased roadmap

### Phase 0 — Today

- Legacy desktop: WebSocket + `agent-runtime-server` + PI adapter.
- Cloud: auth, repos, session create, Daytona provision.

### Phase 1 — Harness on cloud

- Wire `HarnessAgent` in sandbox worker; `useChat` on session page; Convex ingests `UIMessage` stream.
- See [cloud PRD](./h3code-cloud-saas-prd.md).

### Phase 2 — Unified client + desktop harness

- TanStack SPA for cloud and Electron; `runtime: desktop | cloud`.
- Desktop: Electron agent host replaces WebSocket server; `agent-metadata` only for local product data.

### Phase 3 — Multi-harness

- Codex + Claude Code via AI SDK harness adapters (not new H3Code provider packages).

### Phase 4 — Desktop cloud mode

- Same Convex backend from Electron without a second UI codebase.

### Phase 5 — Optional depth

- Teams, GitHub App, Monaco, durable workflows if harness sessions outgrow request/response.

## Cross-cutting decisions

| Topic | Decision |
|-------|----------|
| Agent runtime | **AI SDK Harness** (`HarnessAgent`) — see [harness architecture](./h3code-ai-sdk-harness-architecture.md) |
| UI message shape | **`UIMessage`** from `ai` — not `SessionReadModel` |
| Legacy `agent-protocol` / `agent-runtime*` | **Retire** after migration; do not extend |
| Cloud backend | **Convex** |
| Sandboxes | **Daytona** primary; `@ai-sdk/sandbox-vercel` fallback |
| Auth (cloud) | **Clerk** + GitHub OAuth `repo` scope |
| Frontend | **TanStack Start** for cloud + unified desktop SPA |
| Local metadata | **`@h3code/agent-metadata`** (SQLite) |
| Desktop shell | **Electron** |

## Success criteria

- Same interaction model on desktop folder and cloud repo: stream, steer, abort, diff, PR (cloud).
- UI renders **`UIMessage.parts`** only; swapping Pi → Codex is a harness config change, not a protocol rewrite.
- Package surface shrinks to **agent-provider-pi + agent-metadata** (+ optional sandbox-daytona).

## Decision log

| Decision | Rationale | Date |
|----------|-----------|------|
| Platform = local + cloud | Matches developer workflow | 2026-06 |
| TanStack + AI SDK UI types | One transcript model; React AI ecosystem | 2026-06 |
| **AI SDK Harness for agent loop** | Replaces custom runtime/read-model; Vercel maintains adapters | 2026-06 |
| Retire H3Code protocol projection | `UIMessageStream` is sufficient UI boundary | 2026-06 |
| PI harness MVP | Aligns with existing PI usage; host-runtime fits desktop | 2026-06 |
| Clerk + Daytona for cloud | Unchanged product choices | 2026-06 |
