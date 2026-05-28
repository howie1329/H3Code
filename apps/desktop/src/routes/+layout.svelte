<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { onMount } from "svelte";

  import AppSidebar from "$lib/components/desktop/AppSidebar.svelte";
  import ExtensionUiDialog from "$lib/components/desktop/ExtensionUiDialog.svelte";
  import { desktopState } from "$lib/desktop-state.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import "../app.css";

  let { children } = $props();

  onMount(() => {
    console.info("[h3code] agent transport: ws");

    const cleanup = desktopState.initializeListeners();
    void desktopState.initializePreferences();

    return cleanup;
  });

  function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    const modifier = event.metaKey || event.ctrlKey;

    if (!modifier) {
      return;
    }

    const key = event.key.toLowerCase();
    const isTyping = isEditableTarget(event.target);

    if (isTyping) {
      return;
    }

    if (key === "l") {
      event.preventDefault();
      desktopState.focusComposer();
      return;
    }

    if (key === "i") {
      event.preventDefault();
      desktopState.toggleContextPanel();
      return;
    }

    if (key === "d" && desktopState.hasSessionDiff) {
      event.preventDefault();
      desktopState.toggleSessionDiffPanel();
      return;
    }

    if (key === "n" && desktopState.repoPath && !desktopState.isBusy) {
      event.preventDefault();
      void desktopState.handleNewSession();
      return;
    }

    if (key === "." && (desktopState.isAgentRunning || desktopState.sessionState?.isStreaming) && !desktopState.isBusy) {
      event.preventDefault();
      void desktopState.handleAbort();
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<ModeWatcher />

<ExtensionUiDialog />

<Sidebar.Provider
  open={desktopState.desktopSettings.sidebarOpen}
  onOpenChange={(open) => desktopState.setSidebarOpen(open)}
  class="h-screen min-h-0 overflow-hidden bg-background text-foreground"
>
  <AppSidebar />

  <Sidebar.Inset class="min-h-0 min-w-0 flex-1 overflow-hidden">
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
