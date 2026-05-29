# Prompt input integration (H3 desktop)

Reference for how Svelte AI Elements `prompt-input` connects to the desktop app. Updated during the full registry reinstall.

## Vendor location

`apps/desktop/src/lib/components/ai-elements/prompt-input/`

Context modules (`attachments`, `provider`, `text-registration`, `types`) must live under `prompt-input/context/` (not `$lib/hooks`) so Svelte components can import them.

Install / refresh:

```bash
cd apps/desktop && npx shadcn-svelte@latest add https://svelte-ai-elements.vercel.app/r/prompt-input.json
```

## App consumers

| File | Exports used | Hook-up |
|------|----------------|---------|
| `PromptComposer.svelte` | `PromptInput`, `PromptInputHeader`, `PromptInputBody`, `PromptInputToolbar`, `PromptInputTools`, `PromptInputTextarea`, `PromptInputSubmit` | `onSubmit` → `desktopState.handlePromptSubmit`. `bind:value={desktopState.promptValue}`. Header: composer status. Toolbar tools: model/thinking. Submit: `status` + `onStop` when agent running. Slash/model/thinking menus above form via `wrapperRef`. |
| `SessionLanding.svelte` | Same canonical layout | `onSubmit` → `startSessionFromLanding`. `bind:value={desktopState.landingPromptValue}`. `LandingRepoSelector` in `PromptInputTools`. |
| `WorkspaceShell.svelte` | `<PromptComposer />` | Mounts workspace composer. |
| `desktop-state.svelte.ts` | `PromptInputMessage` type | `handlePromptSubmit` uses `message.text` only → `sendPromptText`. Does not send `files` / `attachments`. |

## Not related

`packages/pi-provider` `PiPromptInput` is the Pi RPC prompt type, not AI Elements UI.

## Local textarea patch

`PromptInputTextarea` should call the consumer `onkeydown` and skip Enter-to-submit when `event.defaultPrevented` (slash / model / thinking menus).

## Attachments

Registry includes attachment UI; Pi send path is text-only until product wires `message.files`.
