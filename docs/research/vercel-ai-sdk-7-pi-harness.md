# Vercel AI SDK 7 + Pi harness findings

Research date: 2026-08-10

## Bottom line

AI SDK 7 has explicit, first-party Pi support through `@ai-sdk/harness-pi`. This is not a model provider: it adapts the complete Pi coding-agent runtime to AI SDK's `HarnessAgent`, normalized stream/result types, session lifecycle, tool approvals, and sandbox contract. Pi still owns the agent loop, native conversation state, compaction, and model calls. AI SDK owns the normalized application-facing surface and sandbox orchestration. [AI SDK harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview) [Pi harness docs](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi)

The adapter is a useful first integration path, but it does **not** currently expose enough Pi behavior to make H3Code a complete, local, Pi-native UI by itself. The blocking gaps are direct operation on an existing local repository with a real local shell, Pi's live model/thinking controls and model catalog, canonical Pi session management, steering/follow-up, session trees/forks, and full Pi resource/extension behavior. A thin H3Code-owned runtime boundary is justified even if the first implementation delegates most turns to `HarnessAgent`.

All harness packages are documented as experimental and may make breaking changes between releases. [AI SDK harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)

## What “harness” means in AI SDK 7

A harness is a complete agent runtime rather than a language-model adapter. It owns higher-level behavior such as workspace access, coding tools, native session state, compaction, permissions, and runtime-specific configuration. `HarnessAgent` projects that runtime into AI SDK-compatible `GenerateTextResult` and `StreamTextResult` values. Harness-only events that lack a native AI SDK stream part, including file changes and compaction, are emitted as dynamic provider-executed tool parts. [AI SDK harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)

The current documented first-party adapters are:

- Claude Code: `@ai-sdk/harness-claude-code`
- Codex: `@ai-sdk/harness-codex`
- Deep Agents: `@ai-sdk/harness-deepagents`
- OpenCode: `@ai-sdk/harness-opencode`
- Pi: `@ai-sdk/harness-pi`

Amp, Goose, and Mastra are listed as coming soon. [Harness adapter list](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-adapters)

## Exact Pi packages and surface

The documented setup is:

```sh
npm install @ai-sdk/harness @ai-sdk/harness-pi @ai-sdk/sandbox-vercel
```

For local emulation, Pi can instead use `@ai-sdk/sandbox-just-bash` because Pi runs in the host Node.js process and does not need a bridge port. A sandbox provider is still mandatory. [Pi harness docs](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi) [HarnessAgent docs](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent)

The primary interfaces are:

```ts
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createPi, pi } from '@ai-sdk/harness-pi';

const agent = new HarnessAgent({
  harness: createPi({
    model: 'anthropic/claude-sonnet-4.6',
    thinkingLevel: 'medium',
  }),
  sandbox,
});

const session = await agent.createSession({ sessionId });
const result = await agent.stream({ session, prompt, abortSignal });
```

`createPi()` configures `auth`, `model`, and `thinkingLevel`. The current source also exposes `agentDir` to reuse Pi CLI auth/model/settings files, although that option is not listed in the current provider-page settings section—an example of why this experimental surface should remain behind an H3Code adapter. [`PiHarnessSettings` source](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-harness.ts) [Pi harness docs](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi)

The current package source depends on `@earendil-works/pi-coding-agent` (`^0.80.10` on the researched `main` branch) and requires Node 22 or newer. [`@ai-sdk/harness-pi` manifest](https://github.com/vercel/ai/blob/main/packages/harness-pi/package.json)

## Ownership boundary

| Concern | Owner through the harness path |
| --- | --- |
| Agent/model loop and native conversation history | Pi runtime |
| Compaction and Pi model invocation | Pi runtime |
| Normalized `generate()` / `stream()` results | AI SDK `HarnessAgent` |
| Session creation, detach/stop/destroy, opaque resume state | AI SDK harness lifecycle over Pi state |
| Workspace filesystem and shell execution | Sandbox provider, via Pi adapter-provided tools |
| Tool approvals/filtering and host-provided AI SDK tools | AI SDK harness + Pi adapter |
| UI message stream conversion | AI SDK UI |
| Multiple live session registry, persistence policy, window/tab selection | H3Code |

The Pi adapter runs Pi in the host Node process but replaces the normal workspace-facing built-ins with adapter tools backed by the sandbox filesystem/shell. Its documented built-ins are `read`, `write`, `edit`, `bash`, `grep`, `glob`, and `ls`. [Pi harness docs](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi) [`pi-harness.ts` source](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-harness.ts)

## Streaming and UI implications

`HarnessAgent.stream()` returns an AI SDK `StreamTextResult`; text, reasoning, tool calls/results, usage, and finish reasons use normal AI SDK shapes where possible. File changes and compaction are represented as dynamic tool parts. The harness UI guide converts that stream with `toUIMessageStream()` and emphasizes that the harness session—not replayed UI messages—owns history. [Harness overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview) [Harness UI guide](https://ai-sdk.dev/docs/ai-sdk-harnesses/ui)

Implications for H3Code:

- AI SDK UI stream shapes can drive the renderer, including a Svelte renderer, but they are a projection rather than Pi's raw `AgentSessionEvent` stream.
- H3Code must retain or persist the harness resume state per thread. Replaying renderer messages is not a valid way to recreate a Pi harness session.
- If the UI needs a Pi event not represented by the normalized stream, the adapter does not offer a raw-event escape hatch; H3Code will need a direct Pi connection for that behavior.

## Multiple simultaneous sessions

The architecture supports multiple concurrent sessions. `HarnessAgent` is a stateless definition, and every call requires an explicit `HarnessAgentSession`; state does not live on the agent object. Each thread should therefore have its own stable `sessionId`, session object, abort controller, stream consumer, and resume state. [HarnessAgent source](https://github.com/vercel/ai/blob/main/packages/harness/src/agent/harness-agent.ts) [HarnessAgent docs](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent)

The Pi adapter's process-global workspace VFS explicitly supports multiple concurrent mounts when each session has a distinct working-directory mount, which `HarnessAgent` creates per session. [`pi-workspace-vfs.ts` source](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-workspace-vfs.ts)

For the desktop product, switching projects or threads in the renderer must only change the selected view. It must not call `detach()`, `stop()`, or cancel the stream. A long-lived desktop-main runtime should own a map of all live sessions and continue draining every active stream independently.

Lifecycle caveat: same-process `detach()` can park a live Pi session, but Pi has no bridge process to attach to after the host process exits. Cross-process continuation restores the persisted journal and reruns the unfinished tail; the adapter describes this as lossy recomputation. Keeping work alive after the desktop main process exits would require a separate long-lived background process. [`pi-session.ts` source](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-session.ts)

## Model and thinking selectors

The adapter supports initial `model` and `thinkingLevel` configuration, but these are adapter-factory settings, not live `HarnessAgentSession` methods. It also does not expose Pi's available-model/auth catalog. The current adapter type accepts `off`, `minimal`, `low`, `medium`, `high`, and `xhigh`; Pi's direct SDK currently also documents `max`, so the adapter is behind Pi on that capability. [`pi-session.ts` source](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-session.ts) [Pi SDK model docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#model)

By comparison, Pi's direct `AgentSession` exposes `setModel()`, `setThinkingLevel()`, model/thinking cycling, and current values, while `ModelRuntime.getAvailable()` provides authenticated models. [Pi SDK `AgentSession`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#agentsession) [Pi SDK model and auth docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#model)

Therefore the required first-loop selectors need one of these H3Code-owned additions:

1. Query Pi's `ModelRuntime` directly for the selector and recreate/resume a harness session through a new `createPi({ model, thinkingLevel })` configuration when selection changes; or
2. Run the session directly through Pi's SDK and expose its live setters.

Option 1 preserves normalized AI SDK streams but is a cold configuration swap rather than Pi's native live setter and needs careful testing around active turns and resume files.

## Abort semantics

`HarnessAgent.generate()`, `stream()`, `continueGenerate()`, and `continueStream()` accept an `AbortSignal`. The Pi adapter installs an abort listener that calls `AgentSession.abort()`. This matches H3Code's requirement that Abort stop the current generation/agent turn rather than destroy the thread. [`HarnessAgent` source](https://github.com/vercel/ai/blob/main/packages/harness/src/agent/harness-agent.ts) [`pi-session.ts` source](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-session.ts) [Pi SDK `abort()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#agentsession)

H3Code should keep one `AbortController` per active turn, replace it for the next turn, and keep the containing session alive after cancellation.

## Local repository and shell gap

The official Pi adapter always requires a `HarnessV1SandboxProvider`. With Vercel Sandbox, the workspace is remote rather than the user's live local checkout. With `@ai-sdk/sandbox-just-bash`, the default filesystem and shell are an in-process virtual environment. [Pi harness sandbox docs](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi#sandbox) [`sandbox-just-bash` README](https://github.com/vercel/ai/blob/main/packages/sandbox-just-bash/README.md)

`just-bash` can wrap a real directory in two relevant ways:

- `OverlayFs` reads the real checkout but keeps writes in memory.
- `ReadWriteFs` writes through to the real directory.

However, the shell remains just-bash's virtual shell; its own documentation recommends a real VM when arbitrary binary execution is required. That is not equivalent to Pi's normal local `bash` tool running project commands on the machine. [`just-bash` filesystem docs](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md#filesystem-options)

To obtain normal local-repository behavior while retaining `HarnessAgent`, H3Code would need a custom local `HarnessV1SandboxProvider` that safely delegates filesystem operations and process execution to the selected repository. That is a substantial connection layer. Direct Pi SDK sessions already accept a real `cwd` and build their normal tools for it. [Pi SDK custom-cwd tools](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md#tools-with-custom-cwd)

## Pi fidelity gaps in the current adapter

The following direct Pi SDK capabilities are not exposed through the normalized harness API:

- Live `setModel()` and `setThinkingLevel()` plus the authenticated model catalog.
- `steer()` and `followUp()` while a turn is running.
- Pi session listing/opening, session tree navigation, new/switch/fork/import flows, and direct canonical JSONL session ownership.
- Raw `AgentSessionEvent` subscriptions.
- Full Pi extension, prompt-template, theme, and command behavior.

The adapter source deliberately disables extensions, themes, and prompt templates. It filters discovered skills to workspace/harness-approved locations. It creates Pi session journals in adapter-controlled temporary state and persists them through the sandbox/resume mechanism rather than using Pi's normal project session store. [`pi-session.ts` source](https://github.com/vercel/ai/blob/main/packages/harness-pi/src/pi-session.ts) [Pi SDK resources and sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)

These differences matter because the stated product contract is “H3Code is only the UI; Pi owns everything else.” The current harness adapter is intentionally a normalized, sandboxed subset of Pi, not a transparent UI bridge to every Pi SDK feature.

## Recommended H3Code integration boundary

Create a small workspace package or internal package boundary now, because two implementation paths are already required. Keep the renderer independent of both:

```ts
interface PiRuntime {
  listModels(): Promise<ModelSummary[]>;
  createSession(input: CreateSessionInput): Promise<SessionId>;
  resumeSession(input: ResumeSessionInput): Promise<SessionId>;
  prompt(sessionId: SessionId, input: PromptInput): AsyncIterable<UiEvent>;
  setModel(sessionId: SessionId, modelId: string): Promise<void>;
  setThinkingLevel(sessionId: SessionId, level: ThinkingLevel): Promise<void>;
  abort(sessionId: SessionId): Promise<void>;
  dispose(sessionId: SessionId): Promise<void>;
}
```

Use `@ai-sdk/harness-pi` first where it meets the contract: normalized streaming, standard tool parts, approvals, session identifiers, and turn abort. Implement direct Pi-backed methods where the adapter has no surface. Before committing the whole MVP to the harness, run a focused spike against four acceptance tests:

1. Two or more sessions in different real local repositories keep running while the UI switches between them.
2. Edits and arbitrary project commands operate on the actual checkout, not an in-memory or remote copy.
3. Model and every Pi thinking level can be selected and changed with Pi's authenticated catalog.
4. A stopped/restarted app resumes the expected Pi history without divergent or duplicated turns.

If the local-workspace and canonical-session tests require a large custom sandbox implementation, using the direct Pi SDK as the runtime and AI SDK UI-compatible event projection as H3Code's connection layer is the smaller and more Pi-faithful architecture.
