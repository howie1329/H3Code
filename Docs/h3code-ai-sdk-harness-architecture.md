# H3Code — AI SDK Harness Architecture

> Status: **Target architecture** (June 2026). Supersedes the custom runtime / read-model stack described in [h3code-runtime-read-model-architecture.md](./h3code-runtime-read-model-architecture.md) and [h3code-agent-server-product.md](./h3code-agent-server-product.md).
>
> Parent: [h3code-platform-vision.md](./h3code-platform-vision.md). Client: [h3code-unified-client.md](./h3code-unified-client.md). Cloud data: [h3code-convex-schema.md](./h3code-convex-schema.md).

## Summary

H3Code is a **workbench shell** around **AI SDK Harness** runtimes—not a custom agent protocol and projection pipeline.

- **Agent loop, tools, session state, stream shape** → AI SDK `HarnessAgent` + harness adapters (`@ai-sdk/harness-pi`, later codex / claude-code).
- **UI transcript** → standard `UIMessage` / `UIMessageStream` from the `ai` package (`useChat`, `toUIMessageStream`).
- **Sandbox** → `HarnessV1SandboxProvider` (desktop: `@ai-sdk/sandbox-just-bash` on local repo; cloud: Daytona wrapper or `@ai-sdk/sandbox-vercel`).
- **H3Code-owned persistence** → product metadata only (local SQLite) and cloud session rows (Convex)—not a parallel event/read-model system.

The old `agent-protocol` → `agent-runtime` → `SessionReadModel` → WebSocket path is **retired as a target**. Existing packages remain in the repo until desktop and cloud migrate; new work should follow this document.

## Core flow

```txt
Workbench UI (useChat / UIMessage.parts)
  ↔ HTTP or IPC stream (createUIMessageStreamResponse)
    ↔ HarnessAgent.stream({ session, messages })
      ↔ harness adapter (pi | codex | claude-code)
        ↔ sandbox provider (just-bash | daytona | vercel)
```

Harness sessions own **live** conversation state. The UI sends the latest user turn; the server **resumes** the harness session (`sessionId` + opaque `resumeFrom` from `session.detach()` / `session.stop()`), it does not replay full history into the harness on every request.

## What H3Code still owns

| Concern | Owner | Notes |
| --- | --- | --- |
| App shell | `apps/cloud`, `apps/desktop` | Sidebar, composer, diffs, settings, routing |
| Workspace | Apps + Convex | Repo picker, GitHub connection, `repoPath`, branches, PR workflow |
| Sandbox orchestration (cloud) | Convex actions | Daytona create / start / stop / delete; clone repo into sandbox |
| Harness resume blobs | Convex (cloud), SQLite or file (desktop) | Opaque `HarnessAgentResumeSessionState` keyed by H3Code `sessionId` |
| Display cache (optional) | `@h3code/agent-metadata` | Fast reload: last-known `UIMessage[]` snapshot—not canonical agent truth |
| Local product metadata | `@h3code/agent-metadata` | Indexed repos, preferences, session list labels, recent sessions |
| Billing, auth, notifications | Cloud stack | Clerk, Stripe, web push—unchanged |

## What we stop owning

| Retired target | Replaced by |
| --- | --- |
| `@h3code/agent-protocol` `RuntimeEvent`, `SessionReadModel`, `ProviderAdapter` | `ai` types: `UIMessage`, tool parts, harness session resume state |
| `@h3code/agent-runtime` ingestion + projection | `HarnessAgent.stream()` + `toUIMessageStream` |
| `@h3code/agent-runtime-ws` | HTTP streaming route, or Electron IPC forwarding the same byte stream |
| `@h3code/agent-runtime-persistence` | Harness resume state + optional metadata cache |
| `@h3code/agent-runtime-server` | Thin **agent host** in Electron main / utility process / Convex worker—no custom WS protocol |
| Custom PI event mapper → H3Code activities | Harness adapter stream parts (`text`, `tool-*`, `dynamic-tool`) |

## Package target (monorepo)

```txt
packages/
  agent-provider-pi/     # Thin H3Code wiring: factory helpers for HarnessAgent + Pi + sandbox
  agent-metadata/        # Local SQLite: repos, prefs, session index, optional UIMessage cache
  sandbox-daytona/       # (planned) HarnessV1SandboxProvider over @daytona/sdk for cloud
```

`agent-provider-pi` is **not** a second PI SDK adapter. It composes:

- `@ai-sdk/harness`, `@ai-sdk/harness-pi`
- `@ai-sdk/sandbox-just-bash` (desktop) and/or `@h3code/sandbox-daytona` (cloud)
- Shared defaults: instructions, skills hooks, env/auth wiring

Apps import harness types from `ai` / `@ai-sdk/react` directly. Avoid re-exporting a parallel H3Code message model.

### Legacy packages (migration only)

Still present in the repo for the current Svelte desktop build:

- `agent-protocol`, `agent-runtime`, `agent-runtime-ws`, `agent-runtime-persistence`, `agent-runtime-server`

Do not extend these for new features. Delete after desktop renderer consumes `UIMessage` and Electron hosts `HarnessAgent`.

## Desktop

```txt
Electron main (or utilityProcess)
  ├─ folder picker → repoPath
  ├─ agent host: HarnessAgent(createPi(), createJustBashSandbox(OverlayFs(repoPath)))
  ├─ stream route or IPC: createUIMessageStreamResponse
  └─ @h3code/agent-metadata (SQLite)

Renderer
  └─ useChat({ transport }) → render message.parts
```

- **No** localhost WebSocket protocol long term (IPC or in-process stream is fine during migration).
- **No** canonical transcript in SQLite—optional snapshot for instant paint only.
- Pi harness runs in **host Node**; sandbox is local virtual FS via `just-bash`.

## Cloud

```txt
Browser (TanStack + useChat)
  ↔ session API route or Convex HTTP action
    ↔ HarnessAgent in worker (Convex action / Node route inside provisioned context)
      ↔ createDaytonaSandbox({ sandbox })  // wrap sandbox from sandboxProvision
    ↔ persist resumeFrom + append UIMessage chunks → Convex messages table
```

- Convex `messages` rows store **`UIMessage`-compatible JSON** (or stream parts), not `SessionReadModel` / `UiActivity`.
- `sessions` row keeps `sandboxId`, `harnessId` (`pi`), and harness resume blob reference.
- Steer / abort: route calls into active harness session or control mutation that the agent host watches.

## UI contract

**Single shape everywhere:**

```ts
import type { UIMessage } from 'ai';
// Infer tool parts when using typed host tools:
// UIMessage<unknown, never, InferUITools<typeof agent.tools>>
```

Render `message.parts` (text, reasoning, `tool-*`, `dynamic-tool`). Do not map through H3Code `UiMessage` / `UiActivity`.

Shared transcript components in the unified TanStack app should accept `UIMessage[]` only.

## Multi-provider

Phase 1: `@ai-sdk/harness-pi` only.

Phase 2: swap harness factory—`createCodex()`, `createClaudeCode()`—not new `@h3code/agent-provider-*` packages per vendor. Capability differences surface in UI by reading harness adapter metadata or feature-detecting tool parts—not a custom `ProviderCapabilities` enum (unless a tiny UI helper remains in app code).

## Persistence rules

| Data | Store | Role |
| --- | --- | --- |
| Harness native session + resume | Opaque blob per `sessionId` | Continue agent after process restart |
| Transcript for UI reload | Convex (cloud) / optional metadata cache (desktop) | Cross-device view; may lag harness truth |
| Repo / workspace | Convex + metadata | Product navigation |
| Provider API keys | Server env / vault | Never renderer |

**Continue vs reload:** Reloading the chat UI reads stored `UIMessage[]`. **Continuing the agent** requires `agent.createSession({ sessionId, resumeFrom })` with the stored harness state.

## Migration phases

1. **Document & cloud spike** — HarnessAgent + Daytona (or Vercel sandbox) in Convex; stream into Convex as `UIMessage` chunks; cloud session page on `useChat`.
2. **Shrink packages** — Freeze legacy runtime packages; new code only in `agent-provider-pi` + apps.
3. **Unified client** — TanStack transcript on `UIMessage`; desktop Electron hosts harness (drop WS client).
4. **Delete legacy** — Remove `agent-runtime*`, `agent-protocol` after last importer gone.

## Risks

- AI SDK harness packages are **experimental** (canary)—pin versions and expect churn.
- Bridge harnesses (Codex, Claude Code) need network sandboxes with ports; validate Daytona `getPreviewLink` before committing on cloud.
- Some PI controls (slash commands, queue UI) may need app-level affordances not expressed as `UIMessage` parts—keep those as session metadata, not a full runtime layer.

## Phase 0 findings

Branch: `experiment/desktop-harness-pi-v7`. Spike lives in `packages/agent-provider-pi` (`npm run spike:harness --workspace @h3code/agent-provider-pi`).

### Pinned canary versions (2026-06)

| Package | Version |
| --- | --- |
| `ai` | `7.0.0-canary.176` |
| `@ai-sdk/harness` | `1.0.0-canary.13` |
| `@ai-sdk/harness-pi` | `1.0.0-canary.9` |
| `@ai-sdk/sandbox-just-bash` | `1.0.0-canary.13` |
| `just-bash` | `2.14.5` |

Note: the monorepo root still hoists `ai@6` for desktop/cloud apps; `@h3code/agent-provider-pi` pins `ai@7` for harness work. Expect duplicate `ai` installs until other workspaces migrate.

### Desktop sandbox wiring

`createJustBashSandbox` accepts either create-params or a pre-built `just-bash` `Sandbox`. For local `repoPath`, mount an overlay FS:

```ts
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';
import { OverlayFs, Sandbox } from 'just-bash';

const overlay = new OverlayFs({ root: repoPath });
const sandbox = createJustBashSandbox({
  sandbox: await Sandbox.create({ fs: overlay, cwd: overlay.getMountPoint() }),
});
```

Implemented in [`packages/agent-provider-pi/src/harness/create-desktop-pi-agent.ts`](../packages/agent-provider-pi/src/harness/create-desktop-pi-agent.ts).

### OverlayFs write behavior

`OverlayFs` is copy-on-write: **reads come from the real directory; writes stay in the in-memory overlay** and do not modify files on disk. The spike probes for unexpected files on disk before/after turns. For a desktop coding agent that must persist edits to the user's repo, evaluate `ReadWriteFs` or a direct host-tool path in Phase 1 — do not assume Pi `write`/`edit` tools mutate `repoPath` on disk through just-bash overlay alone.

### just-bash limitations (Phase 0)

- **`ls` tool broken:** harness-pi implements `ls` via shell `ls -1Ap`. just-bash's `ls` does not support `-p`, so listing fails with `invalid option -- 'p'`. Prefer `read`, `grep`, `glob`/`find`, or `bash` with compatible flags in prompts and UI until upstream fixes or we add a workaround.
- **No cross-session sandbox resume:** `just-bash-sandbox` has no `resumeSession`. `createSession({ resumeFrom })` throws `Sandbox provider 'just-bash-sandbox' does not support resume`. Desktop Phase 1 should keep a **live `HarnessAgentSession` in Electron main** between chat turns; persist `session.stop()` blobs for a future provider or when resume lands in just-bash.
- **Spike default:** turn 2 runs on the **same session** (in-memory continuity). Cross-session resume is opt-in via `H3_SPIKE_TEST_RESUME=1` and is expected to fail on just-bash.
- **Workspace seeding:** harness creates `${overlayMount}/pi-<sessionId>`. `createDesktopPiAgent` copies repo files from the overlay root into that folder via `onSandboxSession` so `read`/`grep` see `package.json`.
- **AI Gateway free tier:** may return 429 after several tool calls. The spike treats gateway rate limits after successful tool activity as a partial pass.

### Auth

Phase 0 spike prefers **Vercel AI Gateway** for Pi model calls (one key, multi-provider model ids).

**AI Gateway (recommended):**

```bash
export AI_GATEWAY_API_KEY=...
# optional: export H3_SPIKE_MODEL=openai/gpt-4o
npm run spike:harness --workspace @h3code/agent-provider-pi
```

Defaults to `openai/gpt-4o-mini` with `thinkingLevel: off`. Curated gateway ids in spike config: `openai/gpt-4o-mini`, `openai/gpt-4o`, `anthropic/claude-sonnet-4.6`. Override with `H3_SPIKE_MODEL` and `H3_SPIKE_THINKING_LEVEL`. Force auth mode with `H3_SPIKE_AUTH=gateway|direct`.

`VERCEL_OIDC_TOKEN` also works as a gateway credential when running in Vercel-linked environments.

**Direct provider (fallback):**

```bash
export OPENAI_API_KEY=sk-...
export H3_SPIKE_AUTH=direct
npm run spike:harness --workspace @h3code/agent-provider-pi
```

Direct OpenAI uses `gpt-4o-mini`; direct Anthropic uses `anthropic/claude-sonnet-4.6`.

### TypeScript gotcha

`createDesktopPiAgent` needs an explicit `Promise<HarnessAgent>` return type — otherwise `tsc` fails with TS2742 (non-portable inferred type referencing nested `@ai-sdk/provider-utils`).

### Live E2E status

Spike compiles and starts; full stream + resume validation requires `AI_GATEWAY_API_KEY` (recommended) or direct `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`:

```bash
export AI_GATEWAY_API_KEY=...
npm run spike:harness --workspace @h3code/agent-provider-pi
```

Optional: `H3_SPIKE_MODEL`, `H3_SPIKE_AUTH`, `H3_SPIKE_THINKING_LEVEL`, `H3_SPIKE_PROMPT`, `H3_SPIKE_RESUME_DIR` (default resume blob: `/tmp/h3-harness-resume.json`).

**Smoke test (no API key):** validates `HarnessAgent` + `OverlayFs` + `createJustBashSandbox` session lifecycle only:

```bash
npm run spike:harness:smoke --workspace @h3code/agent-provider-pi
```

Verified on branch: smoke creates and destroys a harness session against the H3Code repo root.

## Phase 1 — Desktop harness host (Electron main)

Branch: `experiment/desktop-harness-pi-v7`. Renderer migrated to harness HTTP in Phase 2 (see below).

### What shipped

- Electron main hosts `HarnessSessionManager` + local HTTP server on `127.0.0.1:{port}`.
- Routes:
  - `GET /health` — `{ ok: true }`
  - `POST /api/chat` — `useChat`-compatible body (`id`, `repoPath`, `messages`); SSE via `pipeUIMessageStreamToResponse`
  - `POST /api/chat/abort` — abort in-flight stream for `sessionId`
- IPC: `getAgentStreamUrl()` → `http://127.0.0.1:{port}/api/chat` (preload + `window.h3code`).
- Legacy WS runtime is opt-in with `H3_USE_LEGACY_AGENT=1` (harness host is default).
- Factory uses `ReadWriteFs` so Pi `write`/`edit` persist to the real repo.
- Production auth: `resolveDesktopHarnessConfig()` in `@h3code/agent-provider-pi/harness` (gateway or direct keys).

### Key paths

| Path | Role |
| --- | --- |
| `apps/desktop/electron/harness/harness-lifecycle.ts` | Start/stop host |
| `apps/desktop/electron/harness/harness-session-manager.ts` | Live sessions per `sessionId` |
| `apps/desktop/electron/harness/harness-http-server.ts` | HTTP router + CORS |
| `apps/desktop/electron/harness/harness-chat-handler.ts` | Chat + abort handlers |
| `packages/agent-provider-pi/src/harness/` | `createDesktopPiAgent`, `resolveDesktopHarnessConfig` |

### Validation

```bash
npm run spike:harness:smoke --workspace @h3code/agent-provider-pi
npm run build:electron --workspace @h3code/desktop
npm run test:harness-chat-smoke --workspace @h3code/desktop   # needs API key for full stream
```

Set `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY` for streaming smoke. Health-only smoke runs without credentials.

## Phase 2 — Renderer on harness HTTP (`useChat` + `UIMessage`)

Branch: `experiment/desktop-harness-pi-v7`. Renderer uses `@ai-sdk/svelte` `Chat` + `DefaultChatTransport` against the Phase 1 HTTP host. Legacy WebSocket is off the hot path (opt-in via `H3_USE_LEGACY_AGENT=1`).

### What shipped

- `createHarnessChat()` — `Chat` wired to `getAgentStreamUrl()` with `repoPath` + `sessionId` in the POST body.
- `desktop-state.svelte.ts` — connect, send, abort, session list, and delete go through harness chat + `agent-metadata` index (no `RuntimeClient` on the hot path).
- `ui-message-transcript.ts` — maps `UIMessage.parts` into the existing transcript block renderer.
- Session list from `listIndexedSessionsForRepo()`; delete via `removeIndexedSession` IPC.
- Landing model picker uses a static gateway model catalog until per-request model wiring lands.
- Legacy-only features stubbed: slash commands, queue/compaction settings, session diff snapshot, provider UI approvals.

### Key paths

| Path | Role |
| --- | --- |
| `apps/desktop/src/lib/harness-chat.ts` | `Chat` factory + abort helper |
| `apps/desktop/src/lib/harness-sessions.ts` | Indexed session list helpers |
| `apps/desktop/src/lib/ui-message-transcript.ts` | `UIMessage` → transcript VM |
| `apps/desktop/src/lib/desktop-state.svelte.ts` | Harness connect/send/abort state |
| `apps/desktop/src/lib/components/desktop/WorkspaceTranscript.svelte` | Renders harness transcript |

### Deferred to Phase 3

- Reload prior `UIMessage` history when switching sessions — **done in Phase 3**.
- Pass landing `pendingModel` / `thinkingLevel` through the chat POST body — **done in Phase 3**.

### Still deferred

- Pi subscription auth (`~/.pi/agent/auth.json`) and provider picker.

### Validation

```bash
npm run check --workspace @h3code/desktop
npm run build:electron --workspace @h3code/desktop
```

Manual: start desktop, pick a repo, send a prompt — transcript should stream over `POST /api/chat`.

## Phase 3 — Session durability and legacy teardown

Branch: `experiment/desktop-harness-pi-v7`. Desktop sessions survive switch and app restart for transcript display; harness resume blobs are stored for future sandbox resume.

### What shipped

- `@h3code/agent-metadata` tables `session_ui_messages` and `harness_resume_blobs` (FK cascade on session delete).
- IPC: `getSessionUiMessages` / `saveSessionUiMessages` for renderer hydration and mirror saves.
- Harness host persists transcript + `repo_sessions` metadata after each completed stream (`onFinish` on `toUIMessageStream`).
- `HarnessSessionManager` loads resume blobs on cold `createSession`, saves on `closeSession` / app quit; agent cache keyed by `(repoPath, model, thinkingLevel)`.
- Chat POST body accepts `model` and `thinkingLevel`; renderer hydrates `Chat` with cached `messages` on connect/switch.
- Legacy WebSocket agent server removed from desktop (`agent-server-lifecycle`, `runtime-client`, `H3_USE_LEGACY_AGENT`).

### Key paths

| Path | Role |
| --- | --- |
| `packages/agent-metadata/src/session-cache.ts` | SQLite cache + resume blob CRUD |
| `apps/desktop/electron/harness/harness-session-persistence.ts` | Transcript + index metadata after turns |
| `apps/desktop/electron/harness/harness-session-manager.ts` | Resume load/save, per-config agents |
| `apps/desktop/src/lib/harness-chat.ts` | Cached messages + model/thinking in transport body |

### Known limitation

`just-bash-sandbox` may still reject `createSession({ resumeFrom })` after app restart. Transcript reload from SQLite works; agent continuation after cold start is best-effort until sandbox resume lands.

### Validation

```bash
npm run test --workspace @h3code/agent-metadata
npm run check --workspace @h3code/desktop
npm run build:electron --workspace @h3code/desktop
```

Manual: two sessions, multi-turn each, switch between them and restart app — transcripts should reload from cache.

## Related docs (updated for this model)

- [h3code-platform-vision.md](./h3code-platform-vision.md) — product map
- [h3code-unified-client.md](./h3code-unified-client.md) — `runtime: desktop | cloud`, `useChat` wiring
- [h3code-desktop-evolution.md](./h3code-desktop-evolution.md) — in-process host replaces agent-runtime-server

## Superseded

- [h3code-runtime-read-model-architecture.md](./h3code-runtime-read-model-architecture.md)
- [h3code-agent-server-product.md](./h3code-agent-server-product.md) (ProviderAdapter / WebSocket product brief)
