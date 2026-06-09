<script lang="ts">
  import type { ComposerPhaseLine } from "$lib/transcript-selectors.js";

  let { phase }: { phase: ComposerPhaseLine } = $props();

  const dotClass = $derived.by(() => {
    if (phase.tone === "error") {
      return "size-1.5 shrink-0 rounded-full bg-destructive";
    }

    if (phase.tone === "warning") {
      return "size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none";
    }

    if (phase.tone === "working") {
      return "size-1.5 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none";
    }

    return "size-1.5 shrink-0 rounded-full bg-muted-foreground/60";
  });

  const textClass = $derived(
    phase.tone === "error" ? "text-destructive" : "text-muted-foreground",
  );
</script>

<div
  class="flex h-6 w-full items-center gap-1.5 rounded-md px-1 text-[10px] leading-tight {textClass}"
  role={phase.tone === "error" ? "alert" : "status"}
  aria-live={phase.tone === "error" ? "assertive" : "polite"}
>
  <span class={dotClass} aria-hidden="true"></span>
  <span class="min-w-0 flex-1 truncate font-normal">{phase.text}</span>
</div>
