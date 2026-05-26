<script lang="ts">

  let { status, class: className = "" }: { status: PiStatus; class?: string } = $props();

  const label = $derived.by(() => {
    switch (status.state) {
      case "connected":
        return "PI connected";
      case "starting":
        return "PI starting";
      case "exited":
        return "PI exited";
      case "error":
        return "PI error";
      case "disconnected":
        return "PI disconnected";
      default:
        return `PI ${status.state}`;
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
  <span class="font-medium text-foreground/90">{label}</span>
</div>
