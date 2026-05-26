<script lang="ts">
  import { Clock04Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { getActivityIcon } from "$lib/components/desktop/activity-icons.js";
  import { desktopState } from "$lib/desktop-state.svelte";
</script>

{#if desktopState.activity.length === 0}
  <div class="flex min-h-full flex-col items-center justify-center px-6 py-10">
    <div class="grid w-full max-w-sm justify-items-center text-center">
      <div class="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
        <HugeiconsIcon icon={Clock04Icon} data-icon />
      </div>
      <p class="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No activity</p>
      <h2 class="mt-2 text-xl font-semibold leading-tight tracking-tight">PI events will show up here.</h2>
      <p class="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Run a session from the workspace to populate recent tool and agent activity.</p>
    </div>
  </div>
{:else}
  <div class="max-w-3xl space-y-4">
    <header>
      <h2 class="text-xl font-semibold tracking-tight">Activity</h2>
      <p class="mt-1 text-xs text-muted-foreground">Recent PI runtime events from the current app session.</p>
    </header>
    <ul class="flex flex-col gap-1" role="list">
      {#each desktopState.activity as event (event.type + event.detail)}
        <li>
          <div class="flex h-10 items-center justify-between gap-3 rounded-full px-3 text-xs hover:bg-accent">
            <span class="flex min-w-0 items-center gap-2">
              <HugeiconsIcon icon={getActivityIcon(event.type)} data-icon />
              <span class="truncate font-mono text-[11px]">{event.detail}</span>
            </span>
            <span class="shrink-0 text-[11px] text-foreground/70">{event.type}</span>
          </div>
        </li>
      {/each}
    </ul>
  </div>
{/if}
