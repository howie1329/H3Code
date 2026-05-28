<script lang="ts">
  import { goto } from "$app/navigation";

  import { desktopState } from "$lib/desktop-state.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const canStartNewSession = $derived(Boolean(desktopState.repoPath) && !desktopState.isBusy);
  const canRevealPreferences = $derived(Boolean(desktopState.preferencesDatabasePath));

  async function runAction(action: () => void | Promise<void>) {
    open = false;
    await action();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gap-3 p-3 sm:max-w-xs" showCloseButton={false}>
    <Dialog.Header class="gap-1 p-0 text-left">
      <Dialog.Title class="text-sm font-semibold">Command center</Dialog.Title>
      <Dialog.Description class="text-[11px] text-muted-foreground">
        Quick actions for this workspace.
      </Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-0.5" role="menu">
      <Button
        variant="ghost"
        size="sm"
        class="h-8 w-full justify-start px-2 text-xs"
        disabled={desktopState.isBusy}
        onclick={() => runAction(() => desktopState.handleSelectRepo())}
      >
        Add repository
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 w-full justify-start px-2 text-xs"
        onclick={() => runAction(() => goto("/settings"))}
      >
        Settings
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 w-full justify-start px-2 text-xs"
        disabled={!canStartNewSession}
        onclick={() =>
          runAction(async () => {
            await goto("/workspace");
            await desktopState.handleNewSession();
          })}
      >
        New session
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 w-full justify-start px-2 text-xs"
        disabled={!canRevealPreferences || desktopState.isBusy}
        onclick={() =>
          runAction(async () => {
            await desktopState.revealPreferencesDatabase();
          })}
      >
        Reveal preferences folder
      </Button>
    </div>
  </Dialog.Content>
</Dialog.Root>
