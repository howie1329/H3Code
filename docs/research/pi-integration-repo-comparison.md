# Open-source Pi integration comparison

Research date: August 12, 2026.

## Question

How do open-source agent user interfaces integrate Pi, and what do those implementations imply for H3Code's choice among Vercel AI SDK Harness, the installed Pi CLI over RPC, and direct use of the Pi SDK?

This review inspected source at these revisions:

- [`get-bb/bb` at `aefe3ea`](https://github.com/get-bb/bb/tree/aefe3ea49ef7d7236905893a5feaa5986a929872)
- [`pingdotgg/t3code` at `e321667`](https://github.com/pingdotgg/t3code/tree/e321667b100a18d5306f845c655dce6f20525776)
- [`dnouri/pi-coding-agent` at `a7b533f`](https://github.com/dnouri/pi-coding-agent/tree/a7b533fb8ab5a5e2fabb6c925ad2d7385456c1bd)
- [`minghinmatthewlam/pi-gui` at `eb9a738`](https://github.com/minghinmatthewlam/pi-gui/tree/eb9a7380705dffad36db3efa771ee825aafbef6f)

The first two repositories were supplied by the user. `pi-coding-agent` is the closest mature installed-Pi RPC frontend found. `pi-gui` provides a useful independent example of direct Pi SDK embedding.

## Bottom line

There is no single established pattern:

| Project | Pi support today | Integration path | Uses installed `pi` executable | Loads normal Pi resources |
| --- | --- | --- | --- | --- |
| BB | Yes | Pinned Pi SDK in a provider-specific bridge process | No | Yes, deliberately |
| T3 Code | No; Pi is marked coming soon | Existing runtimes use provider-specific CLI/SDK adapters | Not applicable | Not applicable |
| pi-coding-agent | Yes | Pi native RPC | Yes | Yes, through the launched Pi process |
| pi-gui | Yes | Direct embedded Pi SDK | No | Yes, with limitations around terminal-specific UI |

The strongest evidence for H3Code is not that it must use installed Pi RPC. It is that **AI SDK Harness is not required to build a normalized multi-runtime UI**, and that **direct Pi SDK embedding can preserve far more of the user's Pi environment than `@ai-sdk/harness-pi` currently does**.

## BB: provider-specific SDK bridge with normalized events

BB describes its runtime as a multi-provider process manager. Consumers request Threads and Turns through a clean interface while adapters translate provider-native behavior into BB events. Its two sanctioned adapter shapes are a provider's native wire protocol or a provider-specific SDK bridge; BB explicitly avoids forcing unlike SDK bridges into one shared skeleton. [Runtime architecture](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/README.md)

For Pi, BB does **not** execute the installed `pi` CLI and does not use Vercel AI SDK Harness. Its runtime package pins `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai`, then hosts the SDK in a Node bridge process. [Package dependencies](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/package.json) [Pi bridge](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/src/pi/bridge/bridge.ts)

Unlike the AI SDK Pi harness, BB deliberately constructs Pi's configured services from the normal agent directory and Repository. Its source says this discovers the user's packages, extensions, skills, prompts, themes, context files, authentication, and custom models. [Pi SDK session](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/src/pi/bridge/sdk-session.ts) [Configured services](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/src/pi/bridge/configured-services.ts)

BB normalizes Pi behind its own JSON-RPC bridge. It supports start, resume, fork, Turn start, Steer, stop, compaction, model listing, and dynamic tools. One Pi bridge process holds a map of multiple Thread sessions, while BB's outer runtime shares one process per provider and routes events using both BB and provider Thread IDs. [Pi bridge command schema](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/src/pi/bridge/bridge.ts) [Runtime README](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/README.md)

BB does not simply adopt the user's existing Pi session universe. It maintains deterministic BB-owned Pi session paths and equates Pi's provider identity with the BB Thread identity. It can resume and fork those persisted files, but this is a product-owned session mapping rather than transparent discovery of every terminal-created Pi session. [Session identity and forking](https://github.com/get-bb/bb/blob/aefe3ea49ef7d7236905893a5feaa5986a929872/packages/agent-runtime/src/pi/bridge/bridge.ts)

### Implication

BB disproves the assumption that embedding a pinned Pi SDK necessarily loses user extensions and configuration. The fidelity loss in `@ai-sdk/harness-pi` comes largely from that adapter's policy and sandbox model, not from Pi's SDK itself. The cost of BB's approach is that the application owns version selection, bridge maintenance, and its mapping between product Threads and Pi session files.

## T3 Code: relevant architecture, but no Pi implementation yet

T3 Code currently supports Codex, Claude Code, Cursor, Grok Build, and OpenCode. Its installation guide requires those CLIs to be installed and authenticated on the machine. Pi is absent from the supported list. [README](https://github.com/pingdotgg/t3code/blob/e321667b100a18d5306f845c655dce6f20525776/README.md)

The current UI lists “Pi Agent” under `COMING_SOON_DRIVER_OPTIONS`, so T3 Code is not evidence for any implemented Pi path yet. [Add-provider dialog](https://github.com/pingdotgg/t3code/blob/e321667b100a18d5306f845c655dce6f20525776/apps/web/src/components/settings/AddProviderInstanceDialog.tsx)

Its broader architecture remains relevant. T3 Code places provider processes behind provider-specific drivers in a local server, ingests native runtime streams, and projects them into an event-sourced orchestration model consumed by web, desktop, and mobile clients. Its current providers use per-driver transports rather than AI SDK Harness. [Internal architecture](https://github.com/pingdotgg/t3code/blob/e321667b100a18d5306f845c655dce6f20525776/docs/internals/overview.md) [Provider architecture](https://github.com/pingdotgg/t3code/blob/e321667b100a18d5306f845c655dce6f20525776/docs/internals/providers.md)

### Implication

T3 Code supports the architectural principle of normalizing **above** provider-native integrations. It does not yet help choose Pi RPC versus Pi SDK, and it should not be cited as a working Pi example.

## pi-coding-agent: installed Pi through native RPC

The Emacs frontend defaults its executable setting to `("pi")`, permits a custom command such as `npx ...@latest`, and appends `--mode rpc`. Each live editor session launches a Pi subprocess in the Repository directory. [Executable configuration](https://github.com/dnouri/pi-coding-agent/blob/a7b533fb8ab5a5e2fabb6c925ad2d7385456c1bd/pi-coding-agent-ui.el) [Process command](https://github.com/dnouri/pi-coding-agent/blob/a7b533fb8ab5a5e2fabb6c925ad2d7385456c1bd/pi-coding-agent-core.el)

Because the installed Pi process owns execution, the frontend receives native model, thinking, session, tool, compaction, retry, and extension events. It also implements the RPC extension UI response path and renders extension errors. [RPC and event handling](https://github.com/dnouri/pi-coding-agent/blob/a7b533fb8ab5a5e2fabb6c925ad2d7385456c1bd/pi-coding-agent-core.el)

The frontend can open a Pi JSONL session file as a live session rather than copying its transcript. It implements separate Follow-up and Steer actions matching Pi behavior. [Session and interaction commands](https://github.com/dnouri/pi-coding-agent/blob/a7b533fb8ab5a5e2fabb6c925ad2d7385456c1bd/pi-coding-agent.el)

Pi officially documents RPC mode as a headless JSONL protocol for custom UIs, while noting that Node/TypeScript applications may prefer `AgentSession` directly. [Pi RPC documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md) [Pi SDK documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)

### Implication

This is the clearest proof of the “UI for the user's installed Pi” model. It preserves the executable version and runtime behavior chosen by the user. H3Code would inherit strict RPC framing, executable/version compatibility, subprocess supervision, and the need to project a large native event surface into its renderer.

## pi-gui: direct Pi SDK with native resource reuse

`pi-gui` embeds the upstream Pi SDK directly rather than using AI SDK Harness or launching the installed CLI. It loads the normal Pi agent directory, authentication, settings, sessions, extensions, skills, and prompt templates, then maps Pi events into its own desktop UI contract. [Repository](https://github.com/minghinmatthewlam/pi-gui/tree/eb9a7380705dffad36db3efa771ee825aafbef6f)

This approach avoids JSONL subprocess framing and gives a TypeScript application direct access to Pi's typed `AgentSession` APIs. Its tradeoffs are that the application chooses and ships the Pi package version, must isolate multiple live sessions inside its own process topology, and cannot assume arbitrary terminal-specific extension UI will translate cleanly to a graphical interface.

### Implication

The practical choice is three-way, not binary:

1. AI SDK Pi harness: normalized Harness API, but the current adapter deliberately substitutes sandbox tools and disables extensions, themes, and prompt templates.
2. Installed Pi RPC: maximum alignment with the user's chosen Pi executable and native environment, with protocol/version and process-management costs.
3. Direct Pi SDK: typed integration and normal Pi resource loading, with an H3Code-pinned runtime version and application-owned isolation/session wiring.

## AI SDK Pi harness comparison

The current `@ai-sdk/harness-pi` package depends on `@earendil-works/pi-coding-agent` and imports it in-process; it does not call an installed `pi` executable. [Harness manifest](https://raw.githubusercontent.com/vercel/ai/main/packages/harness-pi/package.json) [Harness session source](https://raw.githubusercontent.com/vercel/ai/main/packages/harness-pi/src/pi-session.ts)

It can reuse CLI authentication and model settings through `agentDir`, but its implementation creates harness-managed temporary workspace/session state, replaces native workspace tools with sandbox-backed tools, disables extensions, themes, and prompt templates, and filters skills. Those are concrete differences from both BB's direct SDK configuration and installed Pi RPC. [Harness session source](https://raw.githubusercontent.com/vercel/ai/main/packages/harness-pi/src/pi-session.ts)

AI SDK does expose custom Agent and UI transport interfaces, so H3Code could translate Pi SDK or RPC events into selected AI SDK-compatible UI shapes. That would be a custom integration, not a configuration option of `@ai-sdk/harness-pi`. [Custom Agent interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent) [UI transport](https://ai-sdk.dev/docs/ai-sdk-ui/transport)

## Recommendation for H3Code

### Evidence-backed conclusion

Do not make `@ai-sdk/harness-pi` the product boundary. Its current behavior conflicts with the already stated requirements for actual local checkout execution, canonical Pi sessions, and normal Pi extensions/resources.

Both remaining paths are credible:

- Installed Pi RPC best matches the literal promise “H3Code is a UI for the Pi the user already runs.”
- Direct Pi SDK best matches a conventional Electron/TypeScript integration and is proven by BB to support normal Pi resources without the AI SDK harness restrictions.

### Recommended next step

Run one disposable spike comparing **installed Pi RPC** and **direct Pi SDK** against the same acceptance tests before selecting either:

1. Discover and resume a session created in terminal Pi without copying it.
2. Load one representative installed extension, skill, prompt template, custom model, and setting.
3. Execute against the actual checkout with the user's configured shell behavior.
4. Exercise Prompt, Follow-up, Steer, Abort, model change, thinking change, compaction, and extension UI events.
5. Run at least three concurrent Threads, including two in one checkout.
6. Restart H3Code and resume the same canonical histories.
7. Record process isolation, error recovery, version-skew behavior, and the amount of translation code required.

### Inference

If transparent compatibility with the user's independently updated Pi installation is the defining promise, RPC should win unless the spike exposes a blocking protocol gap. If H3Code instead wants a tested, reproducible Pi runtime while still honoring the user's normal resources and session directory, direct SDK is probably the smaller TypeScript implementation.

AI SDK should remain optional at the renderer projection layer and for future runtimes whose official harness adapters preserve the behavior H3Code needs. It should not determine Pi's canonical session owner.
