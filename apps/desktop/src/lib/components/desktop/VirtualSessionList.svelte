<script lang="ts">
  import { WasteIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";

  import { desktopState, type SidebarRepo } from "$lib/desktop-state.svelte";
  import { formatSessionModified, getSessionDisplayTitle } from "$lib/session-display-title.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let {
    repo,
    sessions,
    onSessionClick,
    onSessionDeleteClick,
  }: {
    repo: SidebarRepo;
    sessions: PiSessionSummary[];
    onSessionClick: (sessionPath: string, repoPath: string) => Promise<void>;
    onSessionDeleteClick: (event: MouseEvent, repo: SidebarRepo, session: PiSessionSummary) => void;
  } = $props();

  let scrollElement = $state<HTMLUListElement | null>(null);

  const sessionVirtualizer = createVirtualizer<HTMLUListElement, HTMLLIElement>({
    count: 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => 30,
    getItemKey: (index) => sessions[index]?.path ?? index,
    overscan: 8,
  });

  $effect(() => {
    get(sessionVirtualizer).setOptions({ count: sessions.length });
  });
</script>

<Sidebar.MenuSub
  bind:ref={scrollElement}
  class="relative block max-h-[min(50svh,18rem)] min-h-0 overflow-y-auto transition-[height,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
>
  <div class="relative w-full" style={`height: ${$sessionVirtualizer.getTotalSize()}px;`}>
    {#each $sessionVirtualizer.getVirtualItems() as virtualItem (virtualItem.key)}
      {@const session = sessions[virtualItem.index]}
      {#if session}
        {@const isSessionActive = session.path === desktopState.selectedSessionPath}
        {@const sessionLabel = getSessionDisplayTitle(session)}
        {@const sessionModified = formatSessionModified(session.modified)}
        {@const sessionStatus = desktopState.getSessionRowStatus(session)}
        <li
          data-slot="sidebar-menu-sub-item"
          data-sidebar="menu-sub-item"
          class="group/menu-sub-item absolute top-0 left-0 w-full"
          style={`height: ${virtualItem.size}px; transform: translateY(${virtualItem.start}px);`}
        >
          <Sidebar.MenuSubButton
            isActive={isSessionActive}
            aria-disabled={desktopState.isBusy}
            class="h-7 w-full max-w-full rounded-full px-2.5 pr-8 text-[11px] leading-snug [&_svg]:size-3"
          >
            {#snippet child({ props })}
              <button
                {...props}
                type="button"
                title={`${sessionLabel} · ${repo.name} · ${sessionStatus.label}`}
                aria-current={isSessionActive ? "page" : undefined}
                aria-label={`${sessionLabel}, ${sessionStatus.label}`}
                disabled={desktopState.isBusy}
                onclick={() => onSessionClick(session.path, repo.path)}
              >
                <span
                  class="size-2 shrink-0 rounded-full {sessionStatus.dotClass}"
                  title={sessionStatus.label}
                  aria-hidden="true"
                ></span>
                <span class="min-w-0 flex-1 truncate text-left">{sessionLabel}</span>
                {#if sessionModified}
                  <span class="shrink-0 text-[10px] tabular-nums text-muted-foreground">{sessionModified}</span>
                {/if}
              </button>
            {/snippet}
          </Sidebar.MenuSubButton>
          <button
            type="button"
            class="absolute right-1 top-1/2 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground opacity-100 outline-none transition-colors hover:bg-sidebar-accent hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 sm:opacity-0 sm:group-hover/menu-sub-item:opacity-100 sm:group-focus-within/menu-sub-item:opacity-100"
            aria-label={`Delete ${sessionLabel}`}
            title="Delete PI session"
            disabled={desktopState.isBusy}
            onclick={(event) => onSessionDeleteClick(event, repo, session)}
          >
            <HugeiconsIcon icon={WasteIcon} class="size-3" />
          </button>
        </li>
      {/if}
    {/each}
  </div>
</Sidebar.MenuSub>
