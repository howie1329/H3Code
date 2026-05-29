<script lang="ts">
  import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";

  import { desktopState, type SidebarRepo } from "$lib/desktop-state.svelte";
  import { formatSessionModified, getSessionDisplayTitle } from "$lib/session-display-title.js";
  import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  let {
    repo,
    sessions,
    onSessionClick,
    onSessionDeleteRequest,
  }: {
    repo: SidebarRepo;
    sessions: PiSessionSummary[];
    onSessionClick: (sessionPath: string, repoPath: string) => Promise<void>;
    onSessionDeleteRequest: (repo: SidebarRepo, session: PiSessionSummary) => void;
  } = $props();

  let scrollElement = $state<HTMLUListElement | null>(null);

  const sessionRowHeight = 28;
  const sessionRowGap = 4;

  const sessionVirtualizer = createVirtualizer<HTMLUListElement, HTMLLIElement>({
    count: 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => sessionRowHeight,
    gap: sessionRowGap,
    getItemKey: (index) => sessions[index]?.path ?? index,
    overscan: 8,
  });

  $effect(() => {
    get(sessionVirtualizer).setOptions({ count: sessions.length });
  });
</script>

<Sidebar.MenuSub
  bind:ref={scrollElement}
  class="relative mx-0 block max-h-[min(50svh,18rem)] min-h-0 w-full translate-x-0 gap-1 overflow-y-auto border-0 px-0 py-0 transition-[height,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
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
          <ContextMenu.Root>
            <ContextMenu.Trigger class="w-full">
              <Sidebar.MenuSubButton
                isActive={isSessionActive}
                aria-disabled={desktopState.isBusy}
                class="h-7 w-full max-w-full translate-x-0 rounded-md px-2 pr-8 text-[11px] leading-snug [&_svg]:size-3"
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
                      class="size-1.5 shrink-0 rounded-full {sessionStatus.dotClass}"
                      title={sessionStatus.label}
                      aria-hidden="true"
                    ></span>
                    <span
                      class={isSessionActive
                        ? "min-w-0 flex-1 truncate text-left font-medium"
                        : "min-w-0 flex-1 truncate text-left"}
                    >
                      {sessionLabel}
                    </span>
                    {#if sessionModified}
                      <span class="shrink-0 text-[10px] tabular-nums text-muted-foreground">{sessionModified}</span>
                    {/if}
                  </button>
                {/snippet}
              </Sidebar.MenuSubButton>
            </ContextMenu.Trigger>
            <ContextMenu.Content class="w-44">
              <ContextMenu.Item
                variant="destructive"
                disabled={desktopState.isBusy}
                onSelect={() => onSessionDeleteRequest(repo, session)}
              >
                Delete session
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Root>

          <ContextMenu.Root>
            <ContextMenu.Trigger>
              <button
                type="button"
                class="absolute top-1/2 right-1 z-10 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-100 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 sm:opacity-0 sm:group-hover/menu-sub-item:opacity-100 sm:group-focus-within/menu-sub-item:opacity-100"
                aria-label={`Actions for ${sessionLabel}`}
                title="Session actions"
                disabled={desktopState.isBusy}
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} class="size-3" />
              </button>
            </ContextMenu.Trigger>
            <ContextMenu.Content class="w-44">
              <ContextMenu.Item
                variant="destructive"
                disabled={desktopState.isBusy}
                onSelect={() => onSessionDeleteRequest(repo, session)}
              >
                Delete session
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Root>
        </li>
      {/if}
    {/each}
  </div>
</Sidebar.MenuSub>
