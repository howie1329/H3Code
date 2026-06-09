<script lang="ts">
  import { connectionStatusDotClass, connectionStatusLabel } from "$lib/connection-status.js";

  let {
    status,
    class: className = "",
    showLabel = true,
  }: { status: import("$lib/connection-status.js").ConnectionStatus; class?: string; showLabel?: boolean } = $props();

  const label = $derived(connectionStatusLabel(status));
  const dotClass = $derived(connectionStatusDotClass(status));
</script>

<div class={`flex shrink-0 items-center gap-2 text-xs ${className}`} role="status" aria-label={label}>
  <span class={`size-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true"></span>
  {#if showLabel}
    <span class="hidden font-medium text-foreground/90 sm:inline">{label}</span>
  {/if}
</div>
