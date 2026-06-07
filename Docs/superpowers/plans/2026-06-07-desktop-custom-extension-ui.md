# Desktop `ui.custom()` Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable PI extensions that call `ctx.ui.custom()` — starting with `ask_user_question` (`@juicesharp/rpiv-ask-user-question`) — by bridging custom UI intent from the PI SDK to native desktop dialogs.

**Architecture:** PI's `custom()` passes a pi-tui component factory that cannot run in Electron. H3Code treats `custom()` as an async host-rendered overlay: the bridge correlates a pending `custom()` call with a serializable payload (extension event `rpiv:ask-user:prompt` and/or `tool_execution_start` args), emits `kind: "custom"` over the existing `provider.ui.request` / `respond` channel, and the desktop renders a registered Svelte component that returns the extension's expected JSON result.

**Tech Stack:** TypeScript, `@h3code/agent-core`, `@h3code/pi-provider`, `@h3code/agent-server`, Svelte 5, shadcn-svelte (`apps/desktop`), `@earendil-works/pi-coding-agent` EventBus

**Branch:** `feature/desktop-custom-extension-ui`

---

## Background

| What | Detail |
| --- | --- |
| Broken today | `PiExtensionUiBridge.custom()` throws; `ask_user_question` hangs or fails |
| Extension | `@juicesharp/rpiv-ask-user-question` in `~/.pi/agent/npm/` |
| Event hook | `rpiv:ask-user:prompt` emitted **before** `ui.custom()` |
| Response shape | `QuestionnaireResult` (`answers`, `cancelled`) |
| Existing UI path | `select` / `confirm` / `input` / `editor` via `ExtensionUiDialog.svelte` |

## File map

| File | Responsibility |
| --- | --- |
| `packages/agent-core/src/provider-ui.ts` | `custom` request/response types |
| `packages/pi-provider/src/types.ts` | Mirror `PiProviderUiRequest` / `PiProviderUiResponse` |
| `packages/pi-provider/src/extension-ui.ts` | `custom()` promise + emit |
| `packages/pi-provider/src/custom-ui-correlation.ts` | **New** — EventBus stash + tool-arg fallback |
| `packages/pi-provider/src/runtime.ts` | Pass shared `EventBus` into PI services |
| `packages/pi-provider/src/agent-provider-adapter.ts` | Map `custom` through to agent-core |
| `packages/pi-provider/test/custom-ui.test.ts` | **New** — bridge + correlation tests |
| `apps/desktop/src/app.d.ts` | Desktop `PiExtensionUiRequest` union |
| `apps/desktop/src/lib/agent-adapters.ts` | Desktop ↔ provider adapters |
| `apps/desktop/src/lib/agent-adapters.test.ts` | Adapter round-trip tests |
| `apps/desktop/src/lib/custom-extension-ui/types.ts` | **New** — shared questionnaire types |
| `apps/desktop/src/lib/custom-extension-ui/registry.ts` | **New** — `componentId` → renderer key |
| `apps/desktop/src/lib/components/desktop/ExtensionUiHost.svelte` | **New** — routes simple + custom UI |
| `apps/desktop/src/lib/components/desktop/custom/AskUserQuestionDialog.svelte` | **New** — first custom renderer |
| `apps/desktop/src/lib/components/desktop/custom/ask-user-question.ts` | **New** — pure answer → `QuestionnaireResult` |
| `apps/desktop/src/lib/components/desktop/custom/ask-user-question.test.ts` | **New** — result builder tests |
| `apps/desktop/src/routes/+layout.svelte` | Swap `ExtensionUiDialog` → `ExtensionUiHost` |
| `apps/desktop/src/lib/desktop-state.svelte.ts` | Handle `custom` responses |

---

## Phase 1 — Protocol & bridge (no UI yet)

### Task 1: Add `custom` to agent-core UI types

**Files:**
- Modify: `packages/agent-core/src/provider-ui.ts`
- Test: `packages/agent-core` (typecheck only this phase)

- [ ] **Step 1: Extend `ProviderUiRequest`**

```ts
export type CustomOverlayOptions = {
  anchor?: "center" | "bottom-center";
  width?: string;
  maxHeight?: string;
};

export type ProviderUiRequest =
  | /* existing select | confirm | input | editor */
  | {
      id: string;
      kind: "custom";
      componentId: string;
      payload: unknown;
      overlay?: CustomOverlayOptions;
    };

export type ProviderUiResponse =
  | /* existing */
  | { requestId: string; kind: "custom"; value?: unknown; canceled?: boolean };
```

- [ ] **Step 2: Run typecheck**

```bash
npm run check --workspace @h3code/agent-core
```

Expected: PASS

---

### Task 2: Mirror types in pi-provider

**Files:**
- Modify: `packages/pi-provider/src/types.ts`
- Modify: `packages/pi-provider/src/agent-provider-adapter.ts` (`mapUiRequest`, response mapping if present)

- [ ] **Step 1: Add to `PiProviderUiRequestKind`**

```ts
export type PiProviderUiRequestKind = "select" | "confirm" | "input" | "editor" | "custom";
```

- [ ] **Step 2: Extend `PiProviderUiRequest` and `PiProviderUiResponse`**

```ts
export interface PiProviderUiRequest {
  id: string;
  kind: PiProviderUiRequestKind;
  title?: string;
  // ...existing optional fields...
  componentId?: string;
  payload?: unknown;
  overlay?: CustomOverlayOptions;
}

export type PiProviderUiResponse =
  | /* existing */
  | { requestId: string; kind: "custom"; value?: unknown; canceled?: boolean };
```

- [ ] **Step 3: Add `custom` arm to `mapUiRequest` in `agent-provider-adapter.ts`**

```ts
case "custom":
  return {
    id: request.id,
    kind: "custom",
    componentId: request.componentId ?? "unknown",
    payload: request.payload,
    overlay: request.overlay,
  };
```

- [ ] **Step 4: Run pi-provider check**

```bash
npm run check --workspace @h3code/pi-provider
```

Expected: PASS

---

### Task 3: Custom UI correlation module

**Files:**
- Create: `packages/pi-provider/src/custom-ui-correlation.ts`
- Test: `packages/pi-provider/test/custom-ui-correlation.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { CustomUiCorrelation } from "../src/custom-ui-correlation.js";

test("consumes rpiv ask-user prompt for next custom call", () => {
  const correlation = new CustomUiCorrelation();
  correlation.onExtensionEvent("rpiv:ask-user:prompt", {
    questions: [{ question: "Pick?", header: "Scope", multiSelect: false, options: [] }],
  });
  const match = correlation.consumeForCustom();
  assert.equal(match?.componentId, "rpiv:ask-user:prompt");
  assert.ok(Array.isArray((match?.payload as { questions: unknown[] }).questions));
});

test("falls back to ask_user_question tool args", () => {
  const correlation = new CustomUiCorrelation();
  correlation.onToolExecutionStart("ask_user_question", {
    questions: [{ question: "Go?", header: "Plan", options: [{ label: "Yes", description: "d" }, { label: "No", description: "d" }] }],
  });
  const match = correlation.consumeForCustom();
  assert.equal(match?.componentId, "rpiv:ask-user:prompt");
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
npm run test --workspace @h3code/pi-provider
```

- [ ] **Step 3: Implement `CustomUiCorrelation`**

```ts
export type CustomUiMatch = {
  componentId: string;
  payload: unknown;
  overlay?: CustomOverlayOptions;
};

const ASK_USER_COMPONENT_ID = "rpiv:ask-user:prompt";

export class CustomUiCorrelation {
  #extensionStash: CustomUiMatch[] = [];
  #toolStash: CustomUiMatch[] = [];

  onExtensionEvent(channel: string, data: unknown) {
    if (channel === ASK_USER_COMPONENT_ID) {
      this.#extensionStash.push({ componentId: ASK_USER_COMPONENT_ID, payload: data });
    }
  }

  onToolExecutionStart(toolName: string, args: unknown) {
    if (toolName !== "ask_user_question") return;
    const record = args as { questions?: unknown };
    if (!Array.isArray(record.questions)) return;
    this.#toolStash.push({
      componentId: ASK_USER_COMPONENT_ID,
      payload: { questions: record.questions },
      overlay: { anchor: "bottom-center", width: "100%", maxHeight: "100%" },
    });
  }

  consumeForCustom(): CustomUiMatch | undefined {
    return this.#extensionStash.shift() ?? this.#toolStash.shift();
  }

  clear() {
    this.#extensionStash = [];
    this.#toolStash = [];
  }
}
```

- [ ] **Step 4: Re-run tests — expect PASS**

---

### Task 4: Wire EventBus + tool events into pi-provider runtime

**Files:**
- Modify: `packages/pi-provider/src/runtime.ts`
- Modify: `packages/pi-provider/src/pi-provider.ts`
- Modify: `packages/pi-provider/src/event-mapper.ts` (export tool name for correlation hook)

- [ ] **Step 1: Create shared EventBus in `PiSdkProvider`**

In `pi-provider.ts`, add:

```ts
import { createEventBus, type EventBus } from "@earendil-works/pi-coding-agent";
import { CustomUiCorrelation } from "./custom-ui-correlation.js";

// in class fields:
readonly #eventBus: EventBus = createEventBus();
readonly #customUiCorrelation = new CustomUiCorrelation();

// in constructor or start():
this.#eventBus.on("rpiv:ask-user:prompt", (data) => {
  this.#customUiCorrelation.onExtensionEvent("rpiv:ask-user:prompt", data);
});
```

- [ ] **Step 2: Pass `eventBus` into `createAgentSessionServices`**

In `runtime.ts`:

```ts
import { createEventBus } from "@earendil-works/pi-coding-agent";

// extend PiRuntimeFactoryOptions with optional eventBus?: EventBus

const services = await createAgentSessionServices({
  cwd,
  agentDir,
  eventBus: options.eventBus,
  // ...
});
```

Pass `this.#eventBus` from `PiSdkProvider.start()`.

- [ ] **Step 3: Feed tool starts into correlation**

In `pi-provider.ts` `bindSession` subscribe handler, before `mapPiSessionEvent`:

```ts
if (event?.type === "tool_execution_start") {
  const record = event as { toolName?: string; args?: unknown };
  if (record.toolName) {
    this.#customUiCorrelation.onToolExecutionStart(record.toolName, record.args);
  }
}
```

- [ ] **Step 4: Clear correlation on dispose**

```ts
this.#customUiCorrelation.clear();
```

---

### Task 5: Implement `custom()` in extension bridge

**Files:**
- Modify: `packages/pi-provider/src/extension-ui.ts`
- Test: `packages/pi-provider/test/custom-ui.test.ts`

- [ ] **Step 1: Write failing test**

```ts
test("custom() emits extension.ui.request and resolves from respondToUiRequest", async () => {
  const correlation = new CustomUiCorrelation();
  correlation.onExtensionEvent("rpiv:ask-user:prompt", { questions: [] });
  const events: PiProviderEvent[] = [];
  const bridge = new PiExtensionUiBridge((e) => events.push(e), correlation);
  const ctx = bridge.createContext();

  const pending = ctx.custom(async () => ({ render: () => [], handleInput: () => {} }));
  const request = events.find((e) => e.type === "extension.ui.request")?.request;
  assert.equal(request?.kind, "custom");
  assert.equal(request?.componentId, "rpiv:ask-user:prompt");

  bridge.respond({ requestId: request!.id, kind: "custom", value: { answers: [], cancelled: false } });
  assert.deepEqual(await pending, { answers: [], cancelled: false });
});
```

Refactor `PiExtensionUiBridge` constructor to accept optional `CustomUiCorrelation` (default `new CustomUiCorrelation()`).

- [ ] **Step 2: Replace `custom()` throw**

```ts
custom<T>(_factory, options?) {
  void options;
  return this.request<T>({
    kind: "custom",
    title: "",
    componentId: "unknown",
    payload: null,
  });
}

private request<T>(request: Omit<PiProviderUiRequest, "id">): Promise<T> {
  const id = `pi-ui-${this.#nextRequestId++}`;
  const match = this.#correlation.consumeForCustom();
  const fullRequest: PiProviderUiRequest = {
    ...request,
    id,
    kind: "custom",
    componentId: match?.componentId ?? "unknown",
    payload: match?.payload ?? null,
    overlay: match?.overlay,
  };
  // ...existing promise + emit logic...
}
```

- [ ] **Step 3: Handle `custom` in `responseToValue`**

```ts
case "custom":
  return response.canceled ? undefined : (response.value as T);
```

- [ ] **Step 4: Run pi-provider tests**

```bash
npm run test --workspace @h3code/pi-provider
```

Expected: PASS

---

## Phase 2 — Desktop protocol wiring

### Task 6: Desktop types + adapters

**Files:**
- Modify: `apps/desktop/src/app.d.ts`
- Modify: `apps/desktop/src/lib/agent-adapters.ts`
- Modify: `apps/desktop/src/lib/agent-adapters.test.ts`

- [ ] **Step 1: Extend `PiExtensionUiRequest`**

```ts
| {
    type: "extension_ui_request";
    id: string;
    agentId?: string;
    method: "custom";
    componentId: string;
    payload: unknown;
    overlay?: { anchor?: string; width?: string; maxHeight?: string };
  }
```

- [ ] **Step 2: Extend `PiExtensionUiResponse`**

```ts
| { type: "extension_ui_response"; id: string; method: "custom"; value: unknown }
| { type: "extension_ui_response"; id: string; method: "custom"; cancelled: true }
```

- [ ] **Step 3: Update `providerUiToPiRequest`**

```ts
case "custom":
  return {
    ...base,
    method: "custom",
    componentId: request.componentId,
    payload: request.payload,
    overlay: request.overlay,
  };
```

- [ ] **Step 4: Update `piExtensionUiResponseToProvider`**

```ts
if (response.method === "custom") {
  if ("cancelled" in response && response.cancelled) {
    return { requestId: response.id, kind: "custom", canceled: true };
  }
  return { requestId: response.id, kind: "custom", value: "value" in response ? response.value : undefined };
}
```

- [ ] **Step 5: Add adapter test + run**

```bash
npm run test --workspace @h3code/desktop
```

---

### Task 7: Desktop state handles custom responses

**Files:**
- Modify: `apps/desktop/src/lib/desktop-state.svelte.ts`

- [ ] **Step 1: Widen `applyExtensionUiRequest`**

No logic change needed if `PiExtensionUiRequest` union is updated; verify `extensionUiRequest` binding works for `method: "custom"`.

- [ ] **Step 2: Update `respondToExtensionUi` callers**

Ensure `clearExtensionUiRequest` runs after custom respond (already does).

- [ ] **Step 3: Typecheck desktop**

```bash
npm run check --workspace @h3code/desktop
```

---

## Phase 3 — UI: questionnaire dialog

### Task 8: Pure result builder (TDD)

**Files:**
- Create: `apps/desktop/src/lib/components/desktop/custom/ask-user-question.ts`
- Create: `apps/desktop/src/lib/components/desktop/custom/ask-user-question.test.ts`

- [ ] **Step 1: Define minimal types (mirror extension)**

```ts
export type AskUserOption = { label: string; description: string; preview?: string };
export type AskUserQuestion = {
  question: string;
  header: string;
  multiSelect?: boolean;
  options: AskUserOption[];
};
export type QuestionAnswer = {
  questionIndex: number;
  question: string;
  kind: "option" | "custom" | "chat" | "multi";
  answer: string | null;
  selected?: string[];
};
export type QuestionnaireResult = { answers: QuestionAnswer[]; cancelled: boolean };
```

- [ ] **Step 2: Write failing tests for `buildQuestionnaireResult`**

Cases:
- single option pick → `kind: "option"`
- custom text → `kind: "custom"`
- chat escape → `kind: "chat"`, `answer: "Chat about this"`
- multi select → `kind: "multi"`, `selected: string[]`
- cancel → `{ answers: [], cancelled: true }`

- [ ] **Step 3: Implement builder + run tests**

```bash
npm run test --workspace @h3code/desktop
```

---

### Task 9: `AskUserQuestionDialog.svelte`

**Files:**
- Create: `apps/desktop/src/lib/components/desktop/custom/AskUserQuestionDialog.svelte`
- Create: `apps/desktop/src/lib/custom-extension-ui/types.ts`

Use existing shadcn components: `Dialog`, `Button`, `Input`, `Tabs` (if available; else stepper with header chips).

**MVP UI behavior:**
1. One question visible at a time when multiple questions
2. Option list: label + description; click to select
3. Footer actions: Back (if not first), Next / Submit
4. "Type your answer" expands inline input (single-select only)
5. "Chat about this" button → `kind: "chat"`
6. Cancel → `cancelled: true`
7. Submit tab on last question (or inline Submit on single-question)

- [ ] **Step 1: Scaffold dialog with fixture payload from session log**

Use payload shape from `~/.pi/agent/sessions/...` `ask_user_question` tool call.

- [ ] **Step 2: Wire `onSubmit(result: QuestionnaireResult)` and `onCancel()` props**

- [ ] **Step 3: Manual smoke in dev**

```bash
npm run dev:desktop
```

Temporarily mount dialog with hardcoded payload in a test route or Storybook-like page if needed.

---

### Task 10: `ExtensionUiHost.svelte` router

**Files:**
- Create: `apps/desktop/src/lib/components/desktop/ExtensionUiHost.svelte`
- Create: `apps/desktop/src/lib/custom-extension-ui/registry.ts`
- Modify: `apps/desktop/src/routes/+layout.svelte`

- [ ] **Step 1: Registry**

```ts
export const CUSTOM_UI_COMPONENT_IDS = {
  askUserQuestion: "rpiv:ask-user:prompt",
} as const;
```

- [ ] **Step 2: Host routes by `request.method`**

```svelte
{#if request?.method === "custom"}
  {#if request.componentId === CUSTOM_UI_COMPONENT_IDS.askUserQuestion}
    <AskUserQuestionDialog payload={request.payload} onSubmit={...} onCancel={...} />
  {:else}
    <!-- unsupported custom UI fallback -->
  {/if}
{:else if request}
  <!-- existing ExtensionUiDialog markup -->
{/if}
```

- [ ] **Step 3: Replace import in `+layout.svelte`**

```svelte
import ExtensionUiHost from "$lib/components/desktop/ExtensionUiHost.svelte";
// ...
<ExtensionUiHost />
```

- [ ] **Step 4: Delete or keep `ExtensionUiDialog.svelte` as child import**

Prefer: move existing dialog body into host; don't duplicate.

---

## Phase 4 — Integration & hardening

### Task 11: End-to-end manual verification

- [ ] **Step 1: Connect repo in desktop with PI using your normal extensions**

- [ ] **Step 2: Prompt that triggers `ask_user_question`**

Example: use a skill that references the tool (blueprint skill) or ask agent to clarify with structured options.

- [ ] **Step 3: Verify**

| Check | Expected |
| --- | --- |
| Dialog appears | Question + options visible |
| Submit | Agent continues; tool result in transcript |
| Cancel | Agent receives decline envelope; no hang |
| Switch session mid-dialog | Dialog clears; no stale pending UI |
| Abort run mid-dialog | Pending UI cleared |

---

### Task 12: Unknown `componentId` fallback

**Files:**
- Modify: `ExtensionUiHost.svelte`

- [ ] **Step 1: Show minimal dialog**

Title: "Unsupported extension UI"
Body: `componentId: {id}`
Actions: Cancel only → `{ cancelled: true }`

- [ ] **Step 2: Emit diagnostic via existing notify path if available**

---

### Task 13: Documentation touch-up

**Files:**
- Modify: `docs/h3code-desktop-mvp.md` (Implementation Status bullet)

- [ ] **Step 1: Add line**

"Extension custom UI (`ui.custom()`), including `ask_user_question` questionnaire dialog."

---

## Verification commands (full PR)

```bash
npm run check --workspace @h3code/agent-core
npm run test --workspace @h3code/pi-provider
npm run test --workspace @h3code/agent-server
npm run check --workspace @h3code/desktop
npm run test --workspace @h3code/desktop
npm run build --workspace @h3code/desktop
```

## Out of scope (follow-up PRs)

| Item | Why defer |
| --- | --- |
| Option preview side-by-side pane | Needs full `options[].preview` from tool args; event only has `hasPreview` |
| rpiv-i18n localized sentinel labels | English literals OK for MVP |
| Generic custom UI for arbitrary extensions | Registry pattern is enough; add renderers per extension |
| Timeout on custom dialogs | Match `select` timeout later |
| `desktop-zero` app | Separate app; port after desktop proves pattern |

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Event arrives after `custom()` | Tool-arg stash as fallback; extension emits event first today |
| Payload shape drift | Pin fixtures from real `.pi` session JSONL in tests |
| Hang if respond never arrives | `rejectAll` on dispose; cancel button always responds |
| Multiple concurrent custom calls | MVP: single pending map (same as select); document limitation |

## Self-review (spec coverage)

| Requirement | Task |
| --- | --- |
| `custom()` no longer throws | Task 5 |
| `ask_user_question` works | Tasks 3–5, 8–11 |
| Protocol end-to-end | Tasks 1–2, 6–7 |
| Graceful unknown UI | Task 12 |
| Tests | Tasks 3, 5, 6, 8 |
| Docs | Task 13 |

---

## Suggested commit sequence

1. `feat(agent-core): add custom extension UI request types`
2. `feat(pi-provider): bridge ui.custom with event correlation`
3. `feat(desktop): wire custom extension UI protocol`
4. `feat(desktop): add ask_user_question dialog`
5. `docs: note custom extension UI support in desktop MVP`
