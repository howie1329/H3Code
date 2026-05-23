<script lang="ts">
  import { AlertCircleIcon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { desktopState } from "$lib/desktop-state.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";

  const sessionStatus = $derived(getSessionStatus(desktopState.sessionState));
  const sessionId = $derived(desktopState.sessionStats?.sessionId ?? desktopState.sessionState?.sessionId);
  const contextPercent = $derived(getContextPercent(desktopState.sessionStats));

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

  function getModelName(model: PiSessionState["model"] | undefined) {
    return model?.id ?? model?.modelId ?? "Unknown";
  }
</script>

<aside class="flex min-w-0 flex-col border-l border-border bg-background">
  <header class="flex h-10 items-center justify-between border-b border-border/50 px-4">
    <h2 class="text-xs font-semibold">Context</h2>
    <Badge variant="secondary">PI</Badge>
  </header>

  <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4">
    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current repo</h3>
      <div class="flex items-center justify-between gap-2 text-xs">
        <span class="min-w-0">
          <span class="block truncate font-medium">{desktopState.repoName}</span>
          <span class="block truncate font-mono text-[10px] text-muted-foreground">{desktopState.repoPath ?? "None"}</span>
        </span>
        <Badge variant="outline">{desktopState.repoPath ? "Selected" : "Empty"}</Badge>
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Session</h3>
        <Badge variant={desktopState.sessionState?.isStreaming ? "default" : "outline"}>{sessionStatus}</Badge>
      </div>

      <div class="grid gap-2 text-xs">
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Session ID</span>
          <span class="truncate text-right font-mono text-[11px] font-medium" title={sessionId}>{shortId(sessionId)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Messages</span>
          <span class="font-medium">{formatCount(desktopState.sessionStats?.totalMessages ?? desktopState.sessionState?.messageCount ?? desktopState.messages.length)}</span>
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
            <div class="h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`Context usage ${formatPercent(contextPercent)}`} role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={contextPercent}>
              <div class={`h-full rounded-full ${getContextBarClass(contextPercent)}`} style={`width: ${contextPercent}%;`}></div>
            </div>
            <div class="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>{formatCount(desktopState.sessionStats.contextUsage?.tokens)} used</span>
              <span>{formatCount(desktopState.sessionStats.contextUsage?.contextWindow)} window</span>
            </div>
          {:else}
            <p class="text-[11px] leading-snug text-muted-foreground">Context usage is unavailable until Pi reports a fresh estimate.</p>
          {/if}
        </div>
      {:else}
        <p class="text-xs text-muted-foreground">No session stats yet</p>
      {/if}
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Runtime diagnostics</h3>
      <div class="grid gap-2 text-xs">
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">PI RPC</span>
          <span class="truncate text-right font-medium">{desktopState.piStatus.state}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Model</span>
          <span class="truncate text-right font-medium">{getModelName(desktopState.sessionState?.model)}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-muted-foreground">Working dir</span>
          <span class="truncate text-right font-medium">{desktopState.repoPath ?? "None"}</span>
        </div>
        {#if desktopState.piStatus.diagnostic}
          <div class="text-muted-foreground">{desktopState.piStatus.diagnostic}</div>
        {/if}
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tool activity</h3>
      <div class="flex flex-col gap-1">
        {#if desktopState.activity.length === 0}
          <div class="px-2 py-1 text-xs text-muted-foreground">No activity yet</div>
        {:else}
          {#each desktopState.activity as event}
            <div class="flex h-8 items-center justify-between gap-2 rounded-md px-2 text-xs hover:bg-accent">
              <span class="flex min-w-0 items-center gap-2">
                <HugeiconsIcon icon={AlertCircleIcon} data-icon />
                <span class="truncate font-mono text-[11px]">{event.detail}</span>
              </span>
              <span class="text-[11px] text-muted-foreground">{event.type}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  </div>
</aside>
