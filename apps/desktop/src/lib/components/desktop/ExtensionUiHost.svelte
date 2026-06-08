<script lang="ts">
  import { desktopState } from "$lib/desktop-state.svelte";
  import { CUSTOM_UI_COMPONENT_IDS } from "$lib/custom-extension-ui/registry.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";

  import AskUserQuestionDialog from "./custom/AskUserQuestionDialog.svelte";
  import ExtensionUiDialog from "./ExtensionUiDialog.svelte";

  const request = $derived(desktopState.providerUiRequest);
  const open = $derived(Boolean(request));

  function respondCustom(value: unknown) {
    if (!request || request.kind !== "custom") {
      return;
    }

    void desktopState.respondToProviderUi({
      requestId: request.id,
      kind: "custom",
      value,
    });
  }

  function cancelCustom() {
    if (!request || request.kind !== "custom") {
      return;
    }

    void desktopState.respondToProviderUi({
      requestId: request.id,
      kind: "custom",
      canceled: true,
    });
  }
</script>

{#if request?.kind === "custom"}
  {#if request.componentId === CUSTOM_UI_COMPONENT_IDS.askUserQuestion}
    <AskUserQuestionDialog
      {open}
      payload={request.payload}
      onSubmit={respondCustom}
      onCancel={cancelCustom}
    />
  {:else}
    <Dialog.Root {open} onOpenChange={(nextOpen) => !nextOpen && cancelCustom()}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Unsupported extension UI</Dialog.Title>
          <Dialog.Description>
            No renderer is registered for component <code>{request.componentId}</code>.
          </Dialog.Description>
        </Dialog.Header>

        <Dialog.Footer>
          <Button variant="outline" onclick={cancelCustom}>Cancel</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  {/if}
{:else if request}
  <ExtensionUiDialog />
{/if}
