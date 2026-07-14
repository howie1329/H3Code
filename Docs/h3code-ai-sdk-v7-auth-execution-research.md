# H3Code AI SDK 7 Authentication and Execution Research

> Status: Research recommendation
>
> Date: July 14, 2026
>
> Related: [AI SDK Harness Architecture](./h3code-ai-sdk-harness-architecture.md), [Platform Vision](./h3code-platform-vision.md), [Unified Client](./h3code-unified-client.md), and [Cloud SaaS PRD](./h3code-cloud-saas-prd.md).

## Purpose

H3Code should keep the simplification offered by AI SDK 7 while allowing desktop users to use existing coding-agent subscriptions wherever the underlying runtime supports them. The web product should offer an independent cloud workspace, with an optional connection to H3Code Desktop as a separate mode.

The central architectural finding is that AI SDK can be the common UI and streaming layer without requiring every execution backend to be an official `HarnessAgent` adapter.

## Current findings

### AI SDK 7

AI SDK 7 is the current stable major release. It provides the shared primitives H3Code needs:

- `UIMessage` and `UIMessageStream` as the renderer boundary.
- `useChat` and transport APIs for desktop and browser clients.
- Compatible streams from model providers and `HarnessAgent` runtimes.
- Stateful harness sessions with detach, stop, and resume support.
- Harness adapters for Codex, Pi, Claude Code, OpenCode, and other runtimes.
- Workflow helpers for durable cloud turns.

The AI SDK Harness packages remain experimental and can introduce breaking changes independently of the stable AI SDK core.

Sources:

- [AI SDK introduction](https://ai-sdk.dev/docs/introduction)
- [AI SDK Harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)
- [Harnesses with AI SDK UI](https://ai-sdk.dev/docs/ai-sdk-harnesses/ui)

### Native authentication is runtime-specific

Omitting `auth` does not have one universal meaning across AI SDK Harness adapters. Each adapter decides what happens next.

For the official Codex Harness, the current resolver checks explicit settings, AI Gateway credentials, and OpenAI API credentials. If none are present, it forwards no model credential. The Codex process can then use its native credential discovery if its runtime can see an authenticated `CODEX_HOME` or sandbox home.

This is useful on desktop, but it is not automatic host credential forwarding. A runtime isolated from the host cannot see the user's local Codex login unless H3Code deliberately provides the appropriate credential home.

For the official Pi Harness, the current implementation creates a private per-session Pi agent directory and `AuthStorage`. It does not automatically reuse `~/.pi/agent/auth.json`. An upstream request exists to make the agent configuration directory overridable.

For the official Claude Code Harness, the adapter can use explicit credentials, environment credentials, AI Gateway, or an `apiKeyHelper` configured in `~/.claude/settings.json`. This is not equivalent to offering third-party Claude subscription login.

Sources:

- [AI SDK Codex auth resolver](https://github.com/vercel/ai/blob/main/packages/harness-codex/src/codex-auth.ts)
- [AI SDK Pi session implementation](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-session.ts)
- [Pi agent-directory request](https://github.com/vercel/ai/issues/16491)
- [AI SDK Claude Code auth resolver](https://github.com/vercel/ai/blob/main/packages/harness-claude-code/src/claude-code-auth.ts)

### Codex subscription support

OpenAI supports two Codex authentication modes:

- Sign in with ChatGPT for subscription-backed access.
- Sign in with an API key for usage-based access.

Codex app-server is intended for rich product integrations and exposes authentication, persistent threads, approvals, streamed agent events, diffs, plans, tool calls, interruption, and resume. It supports both a browser callback flow and a device-code flow where the client owns the login experience.

The community `ai-sdk-provider-codex-app-server` provider exposes Codex app-server through AI SDK model interfaces and adds persistent threads, tool streaming, interruption, and mid-execution message injection. Its published compatibility table currently identifies the 1.x provider line as stable for AI SDK 6, so AI SDK 7 compatibility must be validated before H3Code adopts it directly.

Sources:

- [OpenAI Codex authentication](https://developers.openai.com/codex/auth)
- [OpenAI Codex app-server](https://developers.openai.com/codex/app-server)
- [AI SDK community Codex app-server provider](https://ai-sdk.dev/providers/community-providers/codex-app-server)

### Pi subscription support

Pi supports subscription-based OAuth providers through its own interactive login and auth storage. Its current provider documentation lists ChatGPT Plus/Pro through Codex, Claude Pro/Max, and GitHub Copilot. Pi stores OAuth credentials in `~/.pi/agent/auth.json` and refreshes them automatically.

Pi also documents an important limitation: third-party Claude Pro/Max use draws from Anthropic extra usage and is billed per token rather than consuming normal Claude plan limits. Anthropic states that third-party developers may not offer Claude.ai login or subscription rate limits without prior approval. H3Code should therefore treat Claude as API/BYOK unless Anthropic explicitly approves another arrangement.

Sources:

- [Pi providers and authentication](https://pi.dev/docs/latest/providers)
- [Claude Agent SDK overview and authentication restriction](https://docs.anthropic.com/en/docs/claude-code/sdk)

## Recommended product shape

### Desktop

Desktop should be subscription-first and initially support two primary runtimes.

#### Codex

Preferred path: use Codex app-server through the community AI SDK provider if its AI SDK 7 compatibility is acceptable. Otherwise, use a small H3Code adapter around Codex app-server and convert native events into AI SDK `UIMessage` stream parts.

Reasons:

- Uses the user's existing ChatGPT-backed Codex authentication.
- Preserves native Codex threads, tools, approvals, diffs, plans, and interruption.
- Better matches an interactive workbench than one-shot CLI execution.
- Avoids forcing subscription-backed execution through AI Gateway.

The official `@ai-sdk/harness-codex` path remains useful for sandboxed API-key, BYOK, or AI Gateway execution. It should not be the only Codex integration.

#### Pi

Preferred path: use the Pi SDK with its native `AuthStorage` until the official Pi Harness can accept or reuse the user's Pi agent directory.

Reasons:

- Preserves Pi's subscription and provider authentication.
- Supports Pi's model and provider breadth.
- Avoids copying OAuth tokens into H3Code-owned formats.
- Keeps native Pi session behavior while H3Code standardizes only the UI stream.

The official `@ai-sdk/harness-pi` path remains useful for API-key and AI Gateway execution, especially in controlled sandboxes.

### Web

The web product should expose two distinct execution modes rather than treating tunneling and independent cloud work as the same feature.

#### Cloud workspace

This is the primary web product. H3Code provisions an isolated sandbox, clones the selected repository, and runs the agent in that sandbox. The user can work while the desktop is offline.

The first subscription-backed experiment should use Codex app-server:

1. Start Codex app-server inside the user's sandbox.
2. Communicate with it through a local process transport inside the sandbox, preferably stdio.
3. Present Codex device-code authentication through the H3Code web UI.
4. Persist the sandbox's Codex credential home in encrypted, user-scoped storage.
5. Persist native Codex thread identifiers and H3Code `UIMessage` transcript data separately.
6. Use BYOK or AI Gateway as fallback execution modes.

H3Code should not expose Codex app-server's experimental WebSocket listener directly to the public internet. Remote transport authentication and TLS do not remove the benefit of keeping the control connection private inside the sandbox.

#### Desktop relay

This is an optional convenience mode. The browser or mobile client connects securely to a running H3Code Desktop host and operates against its local repositories, credentials, and runtimes.

Benefits:

- Reuses local Codex and Pi subscriptions.
- Gives mobile access to local repositories and tools.
- Avoids cloud inference and sandbox costs.

Limitations:

- The desktop must be running, awake, and reachable.
- It does not satisfy the independent cloud-workspace promise.
- It introduces pairing, relay security, reconnect, and host-presence requirements.

Desktop relay should complement cloud workspaces, not replace them.

## Target boundary

```txt
Shared H3Code workbench
  UIMessage + useChat + AI SDK transport
                  |
        H3Code execution boundary
                  |
  Desktop                         Web
  - Codex app-server              - Cloud Codex app-server
  - Pi SDK + native AuthStorage   - BYOK / AI Gateway harnesses
  - API/Gateway Harness adapters  - Optional desktop relay
  - Local model providers         - Persistent cloud sandbox
```

H3Code owns:

- The workbench UI and shared `UIMessage` rendering contract.
- Runtime selection and capability-aware controls.
- Workspace, repository, branch, diff, and PR workflows.
- Secure routing between the UI and the selected execution backend.
- Cloud sandbox lifecycle and encrypted user-scoped credential persistence.

Native runtimes own:

- Provider authentication and credential refresh.
- Agent loops, native tools, compaction, and conversation state.
- Runtime-specific permissions and session semantics.

## Architectural implications

The existing target architecture should be relaxed from "all execution uses `HarnessAgent`" to "all UI and transport use AI SDK-compatible messages and streams."

This retains the intended simplification:

- Retire the custom H3Code read-model and projection stack.
- Render `UIMessage.parts` everywhere.
- Use `useChat` or an equivalent AI SDK transport on both clients.
- Keep runtime-specific adapters narrow and local to the agent host.
- Use official Harness adapters where their authentication and sandbox model fit.
- Use native SDK or app-server integrations where subscriptions are the product advantage.

It also avoids rebuilding a universal agent runtime. H3Code needs only a small execution boundary that can return an AI SDK-compatible UI stream and expose a limited set of lifecycle operations such as send, steer, abort, resume, and destroy.

## Authentication and security rules

- Never copy local OAuth credentials into H3Code's transcript or metadata stores.
- Prefer native login flows and native credential refresh.
- Keep credentials out of the renderer and browser JavaScript.
- Desktop credentials remain in native runtime storage on the user's machine.
- Cloud credentials must be encrypted, user-scoped, revocable, and unavailable to other sandboxes.
- Do not share one subscription identity across H3Code users.
- Do not treat API-key support as proof that consumer subscription use is permitted.
- Keep sandbox control transports private; expose only the H3Code application API.
- Do not advertise Claude subscription support without explicit Anthropic approval.

## Validation plan

Research establishes plausible paths, not production readiness. Validate these items before changing the implementation architecture:

1. Run `ai-sdk-provider-codex-app-server` against AI SDK 7 and document type, streaming, tool-part, and session behavior.
2. Run Codex app-server with no explicit API or Gateway auth while using an existing desktop ChatGPT login.
3. Verify that no ambient `OPENAI_API_KEY`, `CODEX_API_KEY`, or Gateway credential silently changes the billing path.
4. Confirm that app-server events can be represented faithfully as `UIMessage` parts without importing private AI SDK internals.
5. Verify Pi SDK sessions can use the user's normal `~/.pi/agent/auth.json` without H3Code reading or copying tokens.
6. Test a cloud Codex device-code login inside an isolated sandbox and confirm authentication survives hibernation and resume.
7. Define credential revocation, sandbox deletion, and account-disconnect behavior before persisting cloud Codex credentials.
8. Compare cloud sandbox persistence and cost for Daytona, Vercel Sandbox, and other candidates using the same Codex app-server prototype.
9. Prototype desktop relay separately and measure reconnect behavior, pairing security, and mobile latency.

## Recommended sequence

1. Preserve AI SDK 7 `UIMessage` and `useChat` as the shared client contract.
2. Prove subscription-backed Codex app-server on desktop.
3. Prove Pi SDK native authentication on desktop.
4. Remove legacy protocol layers only after both native streams reach the shared UI contract.
5. Prove Codex device authentication and credential persistence in one cloud sandbox.
6. Add cloud BYOK and AI Gateway fallback paths.
7. Decide whether desktop relay is valuable after the independent cloud workflow works end to end.

## Decision summary

- Keep both desktop and web products.
- Make desktop subscription-first with Codex and Pi.
- Make Codex app-server the leading Codex integration candidate.
- Keep AI SDK 7 as the shared UI, message, and transport layer.
- Do not require every runtime to use an official AI SDK Harness adapter.
- Build independent cloud workspaces as the primary web experience.
- Treat desktop relay as an optional second web execution mode.
- Use BYOK and AI Gateway where subscription-backed execution is unavailable or unsuitable.
