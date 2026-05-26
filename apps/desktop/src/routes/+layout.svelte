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
    const cleanup = desktopState.initializeListeners();
    void desktopState.initializePreferences();

    return cleanup;
  });
</script>

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
