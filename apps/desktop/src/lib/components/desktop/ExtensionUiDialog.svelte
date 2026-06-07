<script lang="ts">
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  let inputValue = $state("");
  let editorValue = $state("");

  const request = $derived(
    desktopState.extensionUiRequest?.method === "custom" ? undefined : desktopState.extensionUiRequest,
  );
  const open = $derived(Boolean(request));

  $effect(() => {
    if (!request) {
      inputValue = "";
      editorValue = "";
      return;
    }

    if (request.method === "input") {
      inputValue = "";
    }

    if (request.method === "editor") {
      editorValue = request.prefill ?? "";
    }
  });

  function close() {
    desktopState.clearExtensionUiRequest();
  }

  function cancel() {
    if (!request) {
      return;
    }

    desktopState.respondToExtensionUi({ type: "extension_ui_response", id: request.id, method: request.method, cancelled: true });
    close();
  }

  function confirmSelect(option: string) {
    if (!request) {
      return;
    }

    desktopState.respondToExtensionUi({ type: "extension_ui_response", id: request.id, method: "select", value: option });
    close();
  }

  function confirmInput() {
    if (!request) {
      return;
    }

    desktopState.respondToExtensionUi({ type: "extension_ui_response", id: request.id, method: "input", value: inputValue });
    close();
  }

  function confirmEditor() {
    if (!request) {
      return;
    }

    desktopState.respondToExtensionUi({ type: "extension_ui_response", id: request.id, method: "editor", value: editorValue });
    close();
  }

  function confirmDialog(confirmed: boolean) {
    if (!request) {
      return;
    }

    desktopState.respondToExtensionUi({ type: "extension_ui_response", id: request.id, method: "confirm", confirmed });
    close();
  }
</script>

{#if request}
  <Dialog.Root {open} onOpenChange={(nextOpen) => !nextOpen && cancel()}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title class="whitespace-pre-wrap break-words">{request.title}</Dialog.Title>
        {#if request.method === "confirm"}
          <Dialog.Description class="whitespace-pre-wrap break-words">{request.message}</Dialog.Description>
        {:else if request.method === "input" && request.placeholder}
          <Dialog.Description class="whitespace-pre-wrap break-words">{request.placeholder}</Dialog.Description>
        {/if}
      </Dialog.Header>

      {#if request.method === "select"}
        <div class="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {#each request.options as option (option)}
            <Button variant="outline" class="h-auto min-h-9 justify-start whitespace-normal text-left" onclick={() => confirmSelect(option)}
              >{option}</Button
            >
          {/each}
        </div>
      {:else if request.method === "input"}
        <div class="space-y-2">
          <label for="extension-ui-input" class="text-xs font-medium">Response</label>
          <Input id="extension-ui-input" bind:value={inputValue} onkeydown={(event) => event.key === "Enter" && confirmInput()} />
        </div>
      {:else if request.method === "editor"}
        <textarea
          class="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          bind:value={editorValue}
        ></textarea>
      {/if}

      <Dialog.Footer>
        <Button variant="outline" onclick={cancel}>Cancel</Button>
        {#if request.method === "confirm"}
          <Button variant="outline" onclick={() => confirmDialog(false)}>No</Button>
          <Button onclick={() => confirmDialog(true)}>Yes</Button>
        {:else if request.method === "input"}
          <Button onclick={confirmInput}>Submit</Button>
        {:else if request.method === "editor"}
          <Button onclick={confirmEditor}>Submit</Button>
        {/if}
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
