<script lang="ts">
  import type { SessionSummary } from "$lib/session-types.js";
  import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";

  import { desktopState, type SidebarRepo } from "$lib/desktop-state.svelte";
  import { formatSessionUpdatedAt, getSessionUpdatedAt } from "$lib/session-summary.js";
  import { getSessionDisplayTitle } from "$lib/session-display-title.js";
  import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  /** Max height per repo session list before it scrolls internally. */
  const MAX_VIEWPORT_HEIGHT_PX = 280;

  let {
    repo,
    sessions,
    onSessionClick,
    onSessionDeleteRequest,
  }: {
    repo: SidebarRepo;
    sessions: SessionSummary[];
    onSessionClick: (sessionId: string, repoPath: string) => void;
    onSessionDeleteRequest: (repo: SidebarRepo, session: SessionSummary) => void;
  } = $props();

  let scrollElement = $state<HTMLDivElement | null>(null);

  const sessionRowHeight = 28;
  const sessionRowGap = 4;

  const orderedSessions = $derived(
    [...sessions].sort(
      (left, right) => getSessionUpdatedAt(right) - getSessionUpdatedAt(left),
    ),
  );

  const sessionVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => sessionRowHeight,
    gap: sessionRowGap,
    getItemKey: (index) => orderedSessions[index]?.id ?? index,
    overscan: 8,
  });

  $effect(() => {
    get(sessionVirtualizer).setOptions({ count: orderedSessions.length });
  });

  const totalContentHeight = $derived($sessionVirtualizer.getTotalSize());

  /** Explicit height reserves layout space so the next repo row cannot overlap. */
  const viewportHeight = $derived(
    Math.min(MAX_VIEWPORT_HEIGHT_PX, Math.max(totalContentHeight, sessionRowHeight)),
  );
</script>

<div
  bind:this={scrollElement}
  role="list"
  aria-label={`Sessions in ${repo.name}`}
  class="relative w-full shrink-0 overflow-y-auto rounded-md outline-none transition-[height] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
  style:height="{viewportHeight}px"
>
  <div class="relative w-full" style:height="{totalContentHeight}px">
    {#each $sessionVirtualizer.getVirtualItems() as virtualItem (virtualItem.key)}
      {@const session = orderedSessions[virtualItem.index]}
      {#if session}
        {@const isSessionActive = session.id === desktopState.selectedSessionId}
        {@const isSessionSwitching = isSessionActive && desktopState.isSwitchingSession}
        {@const sessionLabel = getSessionDisplayTitle(session)}
        {@const sessionModified = formatSessionUpdatedAt(session)}
        {@const sessionStatus = desktopState.getSessionRowStatus(session)}
        <div
          role="listitem"
          class="group/menu-sub-item absolute top-0 left-0 w-full"
          style:height="{virtualItem.size}px"
          style:transform="translateY({virtualItem.start}px)"
        >
          <ContextMenu.Root>
            <ContextMenu.Trigger class="w-full">
              <Sidebar.MenuSubButton
                isActive={isSessionActive}
                class="h-7 w-full max-w-full translate-x-0 rounded-md px-2 pr-8 text-[11px] leading-snug [&_svg]:size-3"
              >
                {#snippet child({ props })}
                  <button
                    {...props}
                    type="button"
                    title={`${sessionLabel} · ${repo.name} · ${sessionStatus.label}`}
                    aria-current={isSessionActive ? "page" : undefined}
                    aria-busy={isSessionSwitching}
                    aria-label={`${sessionLabel}, ${sessionStatus.label}`}
                    onclick={() => onSessionClick(session.id, repo.path)}
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
        </div>
      {/if}
    {/each}
  </div>
</div>
