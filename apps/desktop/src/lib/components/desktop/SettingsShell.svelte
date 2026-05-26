<script lang="ts">
  import { page } from "$app/state";
  import type { Snippet } from "svelte";

  import PageShell from "$lib/components/desktop/PageShell.svelte";
  import { cn } from "$lib/utils";

  let { children }: { children: Snippet } = $props();

  const sections = [
    { id: "appearance", label: "Appearance", href: "/settings#appearance" },
    { id: "workspace", label: "Workspace", href: "/settings#workspace" },
    { id: "runtime", label: "Runtime", href: "/settings#runtime" },
  ];

  const activeSection = $derived(page.url.hash.replace("#", "") || "appearance");
</script>

<PageShell>
  <div class="flex min-h-0 flex-1 overflow-hidden">
    <nav class="hidden w-44 shrink-0 flex-col gap-1 border-r border-border/50 p-4 md:flex" aria-label="Settings">
      {#each sections as section}
        <a
          href={section.href}
          class={cn(
            "rounded-full px-2.5 py-1.5 text-xs transition-colors",
            activeSection === section.id
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {section.label}
        </a>
      {/each}
    </nav>
    <div class="min-h-0 flex-1 overflow-auto p-6">
      {@render children()}
    </div>
  </div>
</PageShell>
