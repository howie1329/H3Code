<script lang="ts">

  let {
    status,
    class: className = "",
    showLabel = true,
  }: { status: PiStatus; class?: string; showLabel?: boolean } = $props();

  const label = $derived.by(() => {
    switch (status.state) {
      case "connected":
        return "Pi connected";
      case "starting":
        return "Pi starting";
      case "exited":
        return "Pi exited";
      case "error":
        return "Pi error";
      case "disconnected":
        return "Pi disconnected";
      default:
        return `Pi ${status.state}`;
    }
  });

  const dotClass = $derived.by(() => {
    switch (status.state) {
      case "connected":
        return "bg-primary";
      case "starting":
        return "bg-muted-foreground animate-pulse";
      case "exited":
      case "error":
      case "disconnected":
        return "bg-destructive/80";
      default:
        return "bg-muted-foreground";
    }
  });
</script>

<div class={`flex shrink-0 items-center gap-2 text-xs ${className}`} role="status" aria-label={label}>
  <span class={`size-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true"></span>
  {#if showLabel}
    <span class="hidden font-medium text-foreground/90 sm:inline">{label.replace(/^Pi /, "")}</span>
  {/if}
</div>
