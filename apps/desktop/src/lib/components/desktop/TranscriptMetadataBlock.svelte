<script lang="ts">
  import type { MetadataEntry } from "$lib/components/desktop/transcript-metadata.js";

  let { title = "Context", entries }: { title?: string; entries: MetadataEntry[] } = $props();
</script>

<div class="grid gap-2 py-1">
  <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
  {#if entries.length > 0}
    <dl class="grid gap-1.5">
      {#each entries as entry (entry.label)}
        <div class="grid grid-cols-[minmax(4rem,auto)_1fr] gap-x-3 gap-y-0.5 text-xs leading-snug">
          <dt class="text-muted-foreground">{entry.label}</dt>
          <dd class="min-w-0 truncate font-mono font-medium text-foreground" title={entry.value}>{entry.value}</dd>
        </div>
      {/each}
    </dl>
  {:else}
    <p class="text-xs leading-snug text-muted-foreground">No metadata</p>
  {/if}
</div>
