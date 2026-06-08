<script lang="ts">
  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  let inputValue = $state("");
  let editorValue = $state("");

  const request = $derived(
    desktopState.providerUiRequest?.kind === "custom" ? undefined : desktopState.providerUiRequest,
  );
  const open = $derived(Boolean(request));

  $effect(() => {
    if (!request) {
      inputValue = "";
      editorValue = "";
      return;
    }

    if (request.kind === "input") {
      inputValue = request.value ?? "";
    }

    if (request.kind === "editor") {
      editorValue = request.value ?? "";
    }
  });

  function close() {
    desktopState.clearProviderUiRequest();
  }

  function cancel() {
    if (!request) {
      return;
    }

    switch (request.kind) {
      case "select":
        desktopState.respondToProviderUi({ requestId: request.id, kind: "select", canceled: true });
        break;
      case "confirm":
        desktopState.respondToProviderUi({ requestId: request.id, kind: "confirm", accepted: false, canceled: true });
        break;
      case "input":
        desktopState.respondToProviderUi({ requestId: request.id, kind: "input", canceled: true });
        break;
      case "editor":
        desktopState.respondToProviderUi({ requestId: request.id, kind: "editor", canceled: true });
        break;
    }

    close();
  }

  function confirmSelect(option: string) {
    if (!request || request.kind !== "select") {
      return;
    }

    desktopState.respondToProviderUi({ requestId: request.id, kind: "select", value: option });
    close();
  }

  function confirmInput() {
    if (!request || request.kind !== "input") {
      return;
    }

    desktopState.respondToProviderUi({ requestId: request.id, kind: "input", value: inputValue });
    close();
  }

  function confirmEditor() {
    if (!request || request.kind !== "editor") {
      return;
    }

    desktopState.respondToProviderUi({ requestId: request.id, kind: "editor", value: editorValue });
    close();
  }

  function confirmDialog(confirmed: boolean) {
    if (!request || request.kind !== "confirm") {
      return;
    }

    desktopState.respondToProviderUi({ requestId: request.id, kind: "confirm", accepted: confirmed });
    close();
  }
</script>

{#if request}
  <Dialog.Root {open} onOpenChange={(nextOpen) => !nextOpen && cancel()}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title class="whitespace-pre-wrap break-words">{request.title}</Dialog.Title>
        {#if request.kind === "confirm" && request.message}
          <Dialog.Description class="whitespace-pre-wrap break-words">{request.message}</Dialog.Description>
        {:else if request.kind === "input" && request.placeholder}
          <Dialog.Description class="whitespace-pre-wrap break-words">{request.placeholder}</Dialog.Description>
        {/if}
      </Dialog.Header>

      {#if request.kind === "select"}
        <div class="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {#each request.options as option (option)}
            <Button variant="outline" class="h-auto min-h-9 justify-start whitespace-normal text-left" onclick={() => confirmSelect(option)}
              >{option}</Button
            >
          {/each}
        </div>
      {:else if request.kind === "input"}
        <div class="space-y-2">
          <label for="extension-ui-input" class="text-xs font-medium">Response</label>
          <Input id="extension-ui-input" bind:value={inputValue} onkeydown={(event) => event.key === "Enter" && confirmInput()} />
        </div>
      {:else if request.kind === "editor"}
        <textarea
          class="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          bind:value={editorValue}
        ></textarea>
      {/if}

      <Dialog.Footer>
        <Button variant="outline" onclick={cancel}>Cancel</Button>
        {#if request.kind === "confirm"}
          <Button variant="outline" onclick={() => confirmDialog(false)}>No</Button>
          <Button onclick={() => confirmDialog(true)}>Yes</Button>
        {:else if request.kind === "input"}
          <Button onclick={confirmInput}>Submit</Button>
        {:else if request.kind === "editor"}
          <Button onclick={confirmEditor}>Submit</Button>
        {/if}
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
