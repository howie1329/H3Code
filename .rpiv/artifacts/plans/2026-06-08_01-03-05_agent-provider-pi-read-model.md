---
date: 2026-06-08T01:03:05-0400
author: howie1329
commit: 6c44109
branch: refactor/packages
repository: H3Code
topic: "@h3code/agent-provider-pi runtime read model package"
tags: [plan, agent-provider-pi, agent-protocol, agent-runtime, agent-runtime-server]
status: draft
last_updated: 2026-06-08T01:14:07-0400
last_updated_by: howie1329
last_updated_note: "Narrowed scope to agent-provider-pi and immediate runtime integration; removed legacy package retirement work."
---

# @h3code/agent-provider-pi Implementation Plan

## Overview

Create `@h3code/agent-provider-pi` as the PI SDK adapter for the new runtime/read-model architecture. The package replaces the old `@h3code/pi-provider` boundary, but it must remain adapter-only: it owns PI SDK lifecycle and PI-native event translation, while runtime ingestion and read-model projection live in `@h3code/agent-runtime`.

The target package architecture is:

```txt
@h3code/agent-protocol       contracts/events/commands/read-model types
@h3code/agent-runtime        runtime ingestion + read-model projection
@h3code/agent-provider-pi    PI SDK adapter
@h3code/agent-runtime-ws     WebSocket transport for runtime protocol
@h3code/agent-runtime-server composition server for desktop
```

Corrected responsibility statement:

> `@h3code/agent-runtime-server` registers `@h3code/agent-provider-pi` with `@h3code/agent-runtime`. Runtime owns bindings, ingests `RuntimeEvent`s, projects `SessionReadModel`, and streams `UiSessionEvent`s over WebSocket.

## Desired End State

- `@h3code/agent-protocol` is the only home for provider-neutral contracts: IDs, capabilities, commands, runtime events, runtime bindings, session read model, UI events, provider adapter interfaces, and transport messages.
- `@h3code/agent-runtime` owns provider registry, runtime bindings, event ingestion, read-model projection, runtime store/cache, and command routing.
- `@h3code/agent-provider-pi` owns PI SDK lifecycle, PI session handles, PI command mapping, PI-native event-to-`RuntimeEvent` mapping, PI capability declaration, and PI session helpers.
- `@h3code/agent-runtime-server` composes `agent-runtime`, `agent-runtime-ws`, and `agent-provider-pi` for the desktop local server.
- Desktop UI consumes server-projected `SessionReadModel`/`UiSessionEvent`s and does not import PI SDK or provider adapter types.

## What We're NOT Doing

- Not putting the new clean protocol into legacy `@h3code/agent-core`.
- Not rebuilding read-model projection inside `@h3code/agent-runtime-server` or `@h3code/agent-provider-pi`.
- Not making H3Code the canonical PI transcript store.
- Not implementing Codex/Cursor/other providers.
- Not completing the cloud Daytona runtime.
- Not rewriting desktop UI visuals; UI changes are limited to consuming the server read model.
- Not deleting, deprecating, or otherwise retiring old packages in this plan.

## Current Findings

- Clean-rewrite packages already exist: `packages/agent-protocol`, `packages/agent-runtime`, and `packages/agent-runtime-ws`.
- `packages/agent-runtime-server` does not currently exist and should be introduced as the desktop composition package.
- Current old PI package is `packages/pi-provider` with package name `@h3code/pi-provider`.
- Current old `AgentProvider` contract in `packages/agent-core/src/providers.ts` subscribes to `SessionDomainEvent`; the new package should not extend that path.
- Current PI adapter maps PI events in `packages/pi-provider/src/event-mapper.ts`, but those mappings are old session-domain/display events and need to become `@h3code/agent-protocol` `RuntimeEvent`s.
- Current old Agent Server directly registers `new PiAgentProvider()` from `@h3code/pi-provider`; the new composition package should register `Pi ProviderAdapter` with `@h3code/agent-runtime` instead.

## Phase 1: Agent Protocol Finalization

### Overview

Finalize `@h3code/agent-protocol` as the single source of truth for runtime contracts. Do not add new runtime/read-model contracts to legacy `@h3code/agent-core`.

### Target Package

`packages/agent-protocol`

### Changes Required

1. Review and finalize existing protocol modules:
   - `src/ids.ts`
   - `src/capabilities.ts`
   - `src/commands.ts`
   - `src/providers.ts`
   - `src/runtime-events.ts`
   - `src/runtime-binding.ts`
   - `src/session-read-model.ts`
   - `src/ui-events.ts`
   - `src/transport.ts`
2. Ensure `RuntimeEvent` variants contain the fields required by `docs/h3code-runtime-read-model-architecture.md`: `sessionId`, `providerId`, `turnId` where applicable, `itemId` where applicable, and `occurredAt`.
3. Ensure provider contracts express adapter responsibilities only: start/resume/stop, send/abort turn, resolve approval/input, subscribe to runtime events, declare capabilities.
4. Ensure command types separate first-pass commands from advanced PI controls:
   - first pass: start session, resume session, send turn, abort turn, resolve approval/user input, stop/dispose;
   - later pass: model changes, thinking level, queue modes, compaction, switch/fork/import, advanced PI session management.
5. Export all finalized protocol types from `src/index.ts`.

### Success Criteria

#### Automated Verification
- [ ] `npm run check --workspace @h3code/agent-protocol` passes.
- [ ] Existing `@h3code/agent-runtime` tests still compile against finalized protocol types.
- [ ] Protocol exports are stable enough for `agent-runtime`, `agent-runtime-ws`, and `agent-provider-pi` to depend on without importing `agent-core`.

#### Manual Verification
- [ ] Contracts match `docs/h3code-runtime-read-model-architecture.md`.
- [ ] No new runtime/read-model contract is added to `packages/agent-core`.
- [ ] Provider contracts answer “what happened in the provider runtime?” rather than “what should the UI render?”.

---

## Phase 2: `@h3code/agent-provider-pi` Scaffold

### Overview

Create the new PI provider adapter package with the same build/test ergonomics as existing packages, depending on `@h3code/agent-protocol` rather than `@h3code/agent-core`.

### Target Package

`packages/agent-provider-pi`

### Changes Required

1. Create package files:
   - `package.json`
   - `tsconfig.json`
   - `tsconfig.test.json`
   - `README.md`
   - `src/index.ts`
   - `test/`
2. Reuse or move PI runtime infrastructure from the old package only where it remains adapter-owned:
   - `runtime.ts`
   - `pi-models.ts`
   - `pi-commands.ts`
   - `extension-ui.ts`
   - `custom-ui-correlation.ts`
   - `session-store.ts`
3. Name exports around the new boundary, for example:
   - `PiProviderAdapter`
   - `PiProviderAdapterOptions`
   - `mapPiEventToRuntimeEvents`
   - `listPiSessionsForRepo`
   - `deletePiSessionForRepo`
4. Add package scripts: `build`, `check`, `lint`, `test`, and optional `smoke`.
5. Document the hard boundary: no read-model projection inside `agent-provider-pi`.

### Success Criteria

#### Automated Verification
- [ ] `npm run check --workspace @h3code/agent-provider-pi` passes.
- [ ] `npm run test --workspace @h3code/agent-provider-pi` passes with scaffold-level tests.
- [ ] The package imports protocol types from `@h3code/agent-protocol`, not `@h3code/agent-core`.

#### Manual Verification
- [ ] README clearly states that the package emits `RuntimeEvent`s and does not own `SessionReadModel` projection.
- [ ] Existing `@h3code/pi-provider` remains available while migration proceeds.

---

## Phase 3: PI Event → RuntimeEvent Mapper

### Overview

Replace the old PI-to-session-domain mapper with a mapper that emits `@h3code/agent-protocol` `RuntimeEvent`s for `@h3code/agent-runtime` ingestion.

### Target Package

`packages/agent-provider-pi`

### Changes Required

1. Implement `src/event-mapper.ts` to map PI SDK events to `RuntimeEvent[]`.
2. Introduce deterministic correlation/ID strategy when PI does not provide stable IDs:
   - one active `turnId` per prompt/run;
   - assistant message item for text streaming;
   - tool item keyed by PI tool call ID or stable fallback;
   - error/runtime item for runtime errors;
   - request IDs for approval/user input correlation.
3. Include required protocol fields: `sessionId`, `providerId: "pi"`, `turnId`, `itemId`, and `occurredAt` where applicable.
4. Map first-pass runtime facts:
   - run/turn started;
   - text content deltas;
   - tool start/update/end;
   - approval requested;
   - user input requested;
   - runtime errors;
   - turn completed/failed/cancelled.
5. Preserve PI-native correlation data in event payloads only where the runtime/server needs it to route a response back to PI.
6. Add tests using old PI event fixtures/patterns from `packages/pi-provider/test` where useful.

### Success Criteria

#### Automated Verification
- [ ] Mapper tests cover agent start/end, turn start/end, message start/update/end, tool start/update/end, approval/user input requests, and runtime errors.
- [ ] `RuntimeEvent` output never contains PI display snapshot objects as the primary payload.
- [ ] `npm run test --workspace @h3code/agent-provider-pi` passes.

#### Manual Verification
- [ ] Mapping is documented well enough for a future provider to mirror the contract without PI-specific assumptions.
- [ ] Provider-owned IDs/handles remain available for routing/correlation but do not leak into UI-specific read model fields.

---

## Phase 4: PI ProviderAdapter Implementation

### Overview

Implement the first-pass PI provider adapter around the PI SDK lifecycle and essential runtime commands. Keep advanced PI controls out of the first implementation pass so the rewrite does not balloon.

### Target Package

`packages/agent-provider-pi`

### First-Pass Scope

- Start session.
- Resume session.
- Send turn.
- Abort turn.
- Resolve approval/user input.
- Emit streaming text events.
- Emit tool events.
- Emit runtime errors.
- Stop/dispose.

### Deferred Advanced Scope

- Model changes.
- Thinking level changes.
- Queue modes.
- Auto-compaction controls.
- Switch/fork/import session.
- Advanced PI session management.

### Changes Required

1. Implement `PiProviderAdapter` against the `@h3code/agent-protocol` provider adapter contract.
2. On start/resume, return a provider runtime/session ref containing PI session file/session ID and any resume cursor needed by `agent-runtime` bindings.
3. Implement first-pass command mapping:
   - `session.start` / equivalent;
   - `session.resume` / equivalent;
   - `turn.send`;
   - `turn.abort`;
   - approval/user input resolution;
   - stop/dispose.
4. Subscribe to PI SDK events and emit mapped `RuntimeEvent`s.
5. Keep PI session discovery/deletion helpers in this package for composition-server/platform commands.
6. Add explicit TODO/follow-up notes for deferred advanced controls rather than partially implementing them.

### Success Criteria

#### Automated Verification
- [ ] Adapter tests prove start/resume returns provider refs without exposing read-model state.
- [ ] Command mapping tests cover start, resume, send turn, abort turn, approval/user input resolution, runtime errors, and dispose.
- [ ] Disposal unsubscribes SDK listeners and rejects outstanding UI requests.
- [ ] Tests confirm advanced controls are either unsupported with clear capability flags or intentionally absent in first pass.

#### Manual Verification
- [ ] `PiProviderAdapter` owns PI SDK details only; no read-model projection appears in the package.
- [ ] Capability declaration makes first-pass vs advanced controls explicit.

---

## Phase 5: Runtime Server Composition

### Overview

Introduce `@h3code/agent-runtime-server` as the desktop composition server. It should wire together `agent-runtime`, `agent-runtime-ws`, and `agent-provider-pi`; it should not own runtime bindings or read-model projection itself.

### Target Package

`packages/agent-runtime-server`

### Composition

```txt
agent-runtime-server
  -> creates/configures AgentRuntime from @h3code/agent-runtime
  -> registers PiProviderAdapter from @h3code/agent-provider-pi
  -> exposes runtime over WebSocket via @h3code/agent-runtime-ws
  -> exposes desktop platform services as needed
```

### Changes Required

1. Create `packages/agent-runtime-server` with package metadata, TypeScript config, README, source, and tests.
2. Add a server startup entry point, e.g. `startH3CodeRuntimeServer(options)`.
3. Instantiate `AgentRuntime` from `@h3code/agent-runtime`.
4. Register `PiProviderAdapter` from `@h3code/agent-provider-pi`.
5. Start WebSocket transport using `@h3code/agent-runtime-ws`.
6. Route session list/delete or platform commands to PI helpers from `@h3code/agent-provider-pi` where still needed.
7. Keep runtime bindings, event ingestion, read-model projection, and UI event generation in `@h3code/agent-runtime`.
8. Preserve old desktop server behavior behind a temporary adapter if desktop cannot switch to the new runtime server in one step.

### Success Criteria

#### Automated Verification
- [ ] `npm run check --workspace @h3code/agent-runtime-server` passes.
- [ ] Composition tests prove the server registers `PiProviderAdapter` with `AgentRuntime`.
- [ ] Tests prove WebSocket clients receive `UiSessionEvent`s produced by runtime, not server-local projection.
- [ ] `npm run test --workspace @h3code/agent-runtime` still passes.
- [ ] `npm run test --workspace @h3code/agent-runtime-ws` still passes.

#### Manual Verification
- [ ] `agent-runtime-server` contains composition/orchestration only.
- [ ] Read-model projector code remains in `packages/agent-runtime`.
- [ ] Provider adapter code remains in `packages/agent-provider-pi`.

---

## Phase 6: Desktop UI Migration

### Overview

Move desktop startup and client consumption from the old `agent-server`/`agent-core`/`pi-provider` path to the new `agent-runtime-server`/`agent-protocol` runtime read model path.

### Target Areas

- `apps/desktop`
- desktop Electron server startup code
- desktop WebSocket client/store code
- temporary compatibility adapters, if needed

### Changes Required

1. Update Electron/main startup to launch `@h3code/agent-runtime-server` instead of the old `@h3code/agent-server` path when using the new runtime architecture.
2. Update desktop client/store types to consume `@h3code/agent-protocol` `SessionReadModel` snapshots/patches or `UiSessionEvent`s.
3. Remove or quarantine PI-specific projection code under `apps/desktop/src/lib/pi-session` once equivalent `agent-runtime` read-model behavior exists.
4. Ensure pending interactions, tool output, runtime errors, abort, and streaming assistant text render through provider-neutral UI state.
5. Update targeted desktop tests for session cache/transcript normalization to assert read-model inputs rather than PI event inputs.
6. Keep compatibility decisions minimal and local to the new runtime path; broader old-package retirement is outside this plan.

### Success Criteria

#### Automated Verification
- [ ] Relevant desktop targeted tests pass, especially transcript/session-cache tests named in `STACK.md` if still present.
- [ ] `npm run check --workspace @h3code/desktop` passes.
- [ ] No desktop renderer import depends on `@h3code/agent-provider-pi`, `@h3code/pi-provider`, or PI SDK types.

#### Manual Verification
- [ ] A live PI prompt streams text and tool activity in the desktop UI through the new runtime server.
- [ ] UI reconnect/remount can request and render the current server read-model snapshot.
- [ ] Approval/user input requests round-trip from PI provider through runtime/server to UI and back.

---

## Testing Strategy

### Narrow Checks

- `npm run check --workspace @h3code/agent-protocol`
- `npm run test --workspace @h3code/agent-runtime`
- `npm run test --workspace @h3code/agent-runtime-ws`
- `npm run check --workspace @h3code/agent-provider-pi`
- `npm run test --workspace @h3code/agent-provider-pi`
- `npm run check --workspace @h3code/agent-runtime-server`
- `npm run test --workspace @h3code/agent-runtime-server`

### Integration/Smoke

- PI provider smoke prompt using the new package chain.
- Desktop live session: start/resume, send turn, stream assistant text, tool call, approval/user input request, runtime error, abort, stop/dispose, reconnect.

## Scope and Integration Notes

- This plan creates and integrates the new PI provider path; it does not delete or retire old packages.
- Make `agent-protocol` finalization compatible with existing `agent-runtime` before building the PI adapter.
- Keep read-model projector changes in `agent-runtime`, not in `agent-runtime-server`.
- Avoid broad workspace/package cleanup unless it is directly required to compile or test the new package path.

## Review Focus

- `agent-protocol` contract completeness and stability.
- Runtime event field completeness and stable PI correlation strategy.
- Ensuring no read-model projection leaks into `agent-provider-pi` or `agent-runtime-server`.
- `agent-runtime-server` as composition only.
- First-pass PI provider scope staying limited to essential runtime operations.
- Clear capability flags or unsupported behavior for deferred advanced PI controls.

## References

- `docs/h3code-runtime-read-model-architecture.md`
- `STACK.md`
- `packages/agent-protocol/src/*`
- `packages/agent-runtime/src/*`
- `packages/agent-runtime-ws/src/*`
- `packages/pi-provider/README.md` (reference only)
- `packages/pi-provider/src/agent-provider-adapter.ts` (reference only)
- `packages/pi-provider/src/event-mapper.ts` (reference only)
