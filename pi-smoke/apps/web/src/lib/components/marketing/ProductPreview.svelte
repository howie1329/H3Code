<!-- Static workbench preview for marketing; decorative, not interactive. -->
<div
  class="overflow-hidden rounded-xl border border-border bg-card"
  role="img"
  aria-label="Preview of the H3 Code desktop workbench with sidebar, transcript, and composer"
>
  <div class="flex items-center justify-between border-b border-border/80 px-3 py-2">
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full bg-primary" aria-hidden="true"></span>
      <span class="text-[11px] font-medium text-foreground">Agent Server connected</span>
    </div>
    <span class="font-mono text-[10px] text-muted-foreground">ws://127.0.0.1</span>
  </div>

  <div class="flex min-h-[min(28rem,62vh)]">
    <aside class="hidden w-[13.5rem] shrink-0 border-r border-border bg-sidebar sm:flex sm:flex-col">
      <div class="border-b border-sidebar-border px-2 py-2">
        <div class="flex h-7 items-center gap-2 rounded-md bg-sidebar-accent px-2">
          <span class="size-3 rounded-sm bg-muted-foreground/30" aria-hidden="true"></span>
          <span class="truncate text-[11px] font-medium text-sidebar-foreground">h3code</span>
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-1 p-1.5">
        <p class="px-2 pt-1 text-[10px] font-medium text-sidebar-foreground/60">Sessions</p>
        <div class="rounded-md bg-sidebar-accent px-2 py-1.5">
          <p class="truncate text-[11px] font-medium text-sidebar-accent-foreground">Fix WebSocket reconnect</p>
          <p class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">feature/cache · 2m</p>
        </div>
        <div class="rounded-md px-2 py-1.5 hover:bg-sidebar-accent/60">
          <p class="truncate text-[11px] text-sidebar-foreground">Refactor session cache</p>
          <p class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">main · 1h</p>
        </div>
        <div class="rounded-md px-2 py-1.5 hover:bg-sidebar-accent/60">
          <p class="truncate text-[11px] text-sidebar-foreground">Add provider registry UI</p>
          <p class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">main · yesterday</p>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col bg-background">
      <div class="flex-1 space-y-3 overflow-hidden p-4">
        <div class="max-w-[85%]">
          <p class="text-[11px] font-medium text-muted-foreground">You</p>
          <p class="mt-1 text-xs leading-relaxed text-foreground">
            Trace the WebSocket reconnect path when the Agent Server restarts mid-run.
          </p>
        </div>
        <div class="max-w-[92%]">
          <p class="text-[11px] font-medium text-muted-foreground">Assistant</p>
          <p class="mt-1 text-xs leading-relaxed text-foreground">
            I will read the connection manager and desktop client handshake, then list where state is lost on reconnect.
          </p>
          <div class="mt-2 rounded-md border border-border/80 bg-muted/40 px-2 py-1.5">
            <p class="font-mono text-[10px] text-muted-foreground">Read packages/agent-runtime/src/agent-runtime.ts</p>
          </div>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span class="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden="true"></span>
          <span>Running tools…</span>
        </div>
      </div>

      <div class="border-t border-border p-3">
        <div class="rounded-lg border border-border bg-card px-3 py-2">
          <p class="text-[11px] text-muted-foreground">Message the agent…</p>
          <div class="mt-2 flex items-center justify-between gap-2">
            <span class="text-[10px] text-muted-foreground">gpt-4.1 · thinking off</span>
            <span class="inline-flex h-6 items-center rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground">
              Send
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
