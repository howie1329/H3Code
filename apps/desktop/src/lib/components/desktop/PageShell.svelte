<script lang="ts">
  import type { Snippet } from "svelte";

  import AppHeader from "$lib/components/desktop/AppHeader.svelte";
  import SettingsHeader from "$lib/components/desktop/SettingsHeader.svelte";

  let {
    children,
    actions,
    header = "workspace",
    headerContent,
  }: {
    children: Snippet;
    actions?: Snippet;
    header?: "workspace" | "settings" | "none";
    headerContent?: Snippet;
  } = $props();
</script>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  {#if headerContent}
    {@render headerContent()}
  {:else if header === "settings"}
    <SettingsHeader />
  {:else if header === "workspace"}
    <AppHeader {actions} />
  {/if}

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    {@render children()}
  </div>
</div>
