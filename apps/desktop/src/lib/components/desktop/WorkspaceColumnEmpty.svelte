<script lang="ts">
  import type { Snippet } from "svelte";

  import { WORKSPACE_COLUMN_MAX_W_CLASS } from "$lib/components/desktop/workspace-column.js";

  type Props = {
    title: string;
    description?: string;
    actions?: Snippet;
  };

  let { title, description, actions }: Props = $props();
</script>

<div class={["mx-auto flex w-full flex-col items-center gap-3 text-center", WORKSPACE_COLUMN_MAX_W_CLASS]}>
  <p class="text-xs font-medium text-foreground">{title}</p>
  {#if description}
    <p class="max-w-sm text-[11px] leading-snug text-muted-foreground">{description}</p>
  {/if}
  {#if actions}
    <div class="flex flex-col items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
