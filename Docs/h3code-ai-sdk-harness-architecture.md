# H3Code — AI SDK Harness Architecture

> Status: **Target UI and transport boundary** (June 2026). The shared `UIMessage` boundary remains current; [h3code-product-direction.md](./h3code-product-direction.md) allows native SDK/app-server execution adapters where they are required for provider authentication or capability parity. This supersedes the custom runtime / read-model stack described in [h3code-runtime-read-model-architecture.md](./h3code-runtime-read-model-architecture.md) and [h3code-agent-server-product.md](./h3code-agent-server-product.md).
>
> Parent: [h3code-platform-vision.md](./h3code-platform-vision.md). Client: [h3code-unified-client.md](./h3code-unified-client.md). Cloud data: [h3code-convex-schema.md](./h3code-convex-schema.md).

## Summary

H3Code is a **workbench shell** around thin execution adapters—not a custom agent protocol and projection pipeline. AI SDK Harness is the preferred adapter foundation where it fits; native SDK/app-server integrations are allowed behind the same UI boundary.

- **Agent loop, tools, session state, stream shape** → provider runtime adapter, preferably AI SDK `HarnessAgent` + harness adapters, otherwise a native SDK/app-server bridge.
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
  agent-provider-pi/     # Thin PI execution wiring; may expose HarnessAgent or native SDK helpers
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

## Related docs (updated for this model)

- [h3code-platform-vision.md](./h3code-platform-vision.md) — product map
- [h3code-unified-client.md](./h3code-unified-client.md) — `runtime: desktop | cloud`, `useChat` wiring
- [h3code-desktop-evolution.md](./h3code-desktop-evolution.md) — in-process host replaces agent-runtime-server

## Superseded

- [h3code-runtime-read-model-architecture.md](./h3code-runtime-read-model-architecture.md)
- [h3code-agent-server-product.md](./h3code-agent-server-product.md) (ProviderAdapter / WebSocket product brief)
