<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";

  let {
    open = $bindable(false),
    title,
    description,
    confirmLabel,
    busy = false,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    busy?: boolean;
    onConfirm: () => Promise<void> | void;
  } = $props();

  async function handleConfirm() {
    await onConfirm();
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Dialog.Close>
        {#snippet child({ props })}
          <Button variant="outline" disabled={busy} {...props}>Cancel</Button>
        {/snippet}
      </Dialog.Close>
      <Button variant="destructive" disabled={busy} onclick={handleConfirm}>{confirmLabel}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
