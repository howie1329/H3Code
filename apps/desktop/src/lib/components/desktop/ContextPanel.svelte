<script lang="ts">
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { getActivityIcon } from "$lib/components/desktop/activity-icons.js";
  import { desktopState } from "$lib/desktop-state.svelte";
  import { getModelLabel } from "$lib/pi-model.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";

  const sessionStatus = $derived(getSessionStatus(desktopState.sessionState));
  const sessionId = $derived(desktopState.sessionStats?.sessionId ?? desktopState.sessionState?.sessionId);
  const contextPercent = $derived(getContextPercent(desktopState.sessionStats));
  const contextValueText = $derived(
    contextPercent !== undefined ? `${formatPercent(contextPercent)} of context window used` : undefined
  );

  function getSessionStatus(state: PiSessionState | undefined) {
    if (!state) {
      return "No session";
    }

    if (state.isCompacting) {
      return "Compacting";
    }

    return state.isStreaming ? "Running" : "Idle";
  }

  function shortId(value: string | undefined) {
    return value ? value.slice(0, 8) : "None";
  }

  function formatCount(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "Unknown";
    }

    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: value < 10_000 ? 1 : 0,
      notation: value >= 10_000 ? "compact" : "standard",
    }).format(value);
  }

  function formatCost(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "Not reported";
    }

    return new Intl.NumberFormat(undefined, {
      currency: "USD",
      maximumFractionDigits: value < 0.01 ? 4 : 3,
      minimumFractionDigits: 3,
      style: "currency",
    }).format(value);
  }

  function formatPercent(value: number) {
    return `${value.toFixed(Number.isInteger(value) ? 0 : 1)}%`;
  }

  function getContextPercent(stats: PiSessionStats | null) {
    const usage = stats?.contextUsage;

    if (!usage) {
      return undefined;
    }

    if (typeof usage.percent === "number" && Number.isFinite(usage.percent)) {
      return clampPercent(usage.percent);
    }

    if (typeof usage.tokens === "number" && typeof usage.contextWindow === "number" && usage.contextWindow > 0) {
      return clampPercent((usage.tokens / usage.contextWindow) * 100);
    }

    return undefined;
  }

  function clampPercent(value: number) {
    return Math.min(Math.max(value, 0), 100);
  }

  function getContextBarClass(value: number) {
    return value >= 85 ? "bg-destructive" : "bg-primary";
  }

</script>

<aside
  class="flex h-full max-h-full min-h-0 w-(--context-panel-width) shrink-0 flex-col overflow-hidden border-l border-border bg-background"
  aria-label="Session context"
>
  <header class="flex h-10 items-center justify-between border-b border-border/50 px-4">
    <h2 class="text-xs font-semibold">Context</h2>
    <Badge variant="secondary">{sessionStatus}</Badge>
  </header>

  <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4">
    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current repo</h3>
      <div class="flex items-center justify-between gap-2 text-xs">
        <span class="min-w-0">
          <span class="block truncate font-medium">{desktopState.repoName}</span>
          <span class="block truncate font-mono text-[10px] text-muted-foreground">{desktopState.repoPath ?? "None"}</span>
          {#if desktopState.worktreePath}
            <span class="mt-1 block truncate font-mono text-[10px] text-muted-foreground" title={desktopState.worktreePath}>
              {desktopState.worktreePath}
            </span>
          {/if}
        </span>
        <Badge variant="outline">{desktopState.repoPath ? "Selected" : "Empty"}</Badge>
      </div>
      {#if desktopState.repoPath}
        <Button variant="outline" size="sm" class="h-7 w-fit px-2 text-xs" onclick={() => desktopState.revealFolder()}>
          Reveal folder
        </Button>
      {/if}
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session</h3>
      </div>

      <div class="grid gap-2 text-xs">
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Session ID</span>
          <span class="truncate text-right font-mono text-[11px] font-medium" title={sessionId}>{shortId(sessionId)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Model</span>
          <span class="truncate text-right font-medium">{getModelLabel(desktopState.sessionState?.model)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Messages</span>
          <span class="font-medium">{formatCount(desktopState.sessionStats?.totalMessages ?? desktopState.sessionState?.messageCount ?? desktopState.sessionReadModel.messages.length)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">User / assistant</span>
          <span class="font-medium">{formatCount(desktopState.sessionStats?.userMessages)} / {formatCount(desktopState.sessionStats?.assistantMessages)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Tools</span>
          <span class="font-medium">{formatCount(desktopState.sessionStats?.toolCalls)} calls, {formatCount(desktopState.sessionStats?.toolResults)} results</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Thinking</span>
          <span class="font-medium">{desktopState.sessionState?.thinkingLevel ?? "Unknown"}</span>
        </div>
      </div>

      {#if desktopState.sessionStatsError}
        <p class="text-[11px] leading-snug text-muted-foreground">Stats unavailable: {desktopState.sessionStatsError}</p>
      {:else if desktopState.sessionStatsLoading && !desktopState.sessionStats}
        <p class="text-[11px] text-muted-foreground">Loading session stats...</p>
      {/if}
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session context</h3>
      {#if desktopState.sessionMetadata.length > 0}
        <dl class="grid gap-1.5">
          {#each desktopState.sessionMetadata as entry (entry.label)}
            <div class="grid grid-cols-[minmax(4rem,auto)_1fr] gap-x-3 gap-y-0.5 text-xs leading-snug">
              <dt class="text-muted-foreground">{entry.label}</dt>
              <dd class="min-w-0 truncate font-mono font-medium text-foreground" title={entry.value}>{entry.value}</dd>
            </div>
          {/each}
        </dl>
      {:else}
        <p class="text-xs leading-snug text-muted-foreground">No branch or commit metadata for this session yet.</p>
      {/if}
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Usage</h3>

      {#if desktopState.sessionStats}
        <div class="grid gap-2 text-xs">
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">Tokens</span>
            <span class="font-medium">{formatCount(desktopState.sessionStats.tokens.total)}</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">Input / output</span>
            <span class="font-medium">{formatCount(desktopState.sessionStats.tokens.input)} / {formatCount(desktopState.sessionStats.tokens.output)}</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">Cache R / W</span>
            <span class="font-medium">{formatCount(desktopState.sessionStats.tokens.cacheRead)} / {formatCount(desktopState.sessionStats.tokens.cacheWrite)}</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">Cost</span>
            <span class="font-medium">{formatCost(desktopState.sessionStats.cost)}</span>
          </div>
        </div>

        <div class="mt-1 grid gap-1.5">
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="text-muted-foreground">Context window</span>
            {#if contextPercent !== undefined}
              <span class="font-medium">{formatPercent(contextPercent)}</span>
            {:else}
              <span class="text-muted-foreground">Unavailable</span>
            {/if}
          </div>
          {#if contextPercent !== undefined}
            <div
              class="h-1.5 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label="Context window usage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={contextPercent}
              aria-valuetext={contextValueText}
            >
              <div class={`h-full rounded-full ${getContextBarClass(contextPercent)}`} style={`width: ${contextPercent}%;`}></div>
            </div>
            <div class="flex items-center justify-between gap-3 text-[11px] text-foreground/70">
              <span>{formatCount(desktopState.sessionStats.contextUsage?.tokens)} used</span>
              <span>{formatCount(desktopState.sessionStats.contextUsage?.contextWindow)} window</span>
            </div>
          {:else}
            <p class="text-[11px] leading-snug text-muted-foreground">Context usage is unavailable until Pi reports a fresh estimate.</p>
          {/if}
        </div>
      {:else}
        <p class="text-xs leading-5 text-muted-foreground">Select a session to see token usage, cost, and context window estimates.</p>
      {/if}
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tool activity</h3>
      {#if desktopState.activity.length === 0}
        <p class="px-2 py-1 text-xs leading-5 text-muted-foreground">Tool calls and PI runtime events appear here while a session runs.</p>
      {:else}
        <ul class="flex flex-col gap-1" role="list">
          {#each desktopState.activity as event (event.type + event.detail)}
            <li>
              <div class="flex h-8 items-center justify-between gap-2 rounded-full px-2 text-xs hover:bg-accent">
                <span class="flex min-w-0 items-center gap-2">
                  <HugeiconsIcon icon={getActivityIcon(event.type)} data-icon />
                  <span class="truncate font-mono text-[11px]">{event.detail}</span>
                </span>
                <span class="shrink-0 text-[11px] text-foreground/70">{event.type}</span>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</aside>
