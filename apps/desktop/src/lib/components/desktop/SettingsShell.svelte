<script lang="ts">
  import { page } from "$app/state";
  import type { Snippet } from "svelte";
  import { tick } from "svelte";

  import PageShell from "$lib/components/desktop/PageShell.svelte";
  import { cn } from "$lib/utils";

  let { children }: { children: Snippet } = $props();

  let contentRef = $state<HTMLDivElement | undefined>();

  const sections = [
    { id: "appearance", label: "Appearance", href: "/settings#appearance" },
    { id: "workspace", label: "Workspace", href: "/settings#workspace" },
    { id: "agent", label: "Agent", href: "/settings#agent" },
    { id: "data", label: "Data", href: "/settings#data" },
    { id: "about", label: "About", href: "/settings#about" },
  ];

  const activeSection = $derived(page.url.hash.replace("#", "") || "appearance");

  function scrollToSection(sectionId: string, updateHash = true) {
    const container = contentRef;
    const target = container?.querySelector(`#${CSS.escape(sectionId)}`);

    if (container && target instanceof HTMLElement) {
      const offset =
        target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8;
      container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    }

    if (updateHash) {
      history.replaceState(history.state, "", `/settings#${sectionId}`);
    }
  }

  function handleNavClick(event: MouseEvent, sectionId: string) {
    event.preventDefault();
    scrollToSection(sectionId);
  }

  $effect(() => {
    const sectionId = page.url.hash.replace("#", "") || "";

    if (!sectionId || !contentRef) {
      return;
    }

    void tick().then(() => scrollToSection(sectionId, false));
  });
</script>

<PageShell>
  <div class="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row">
    <nav
      class="flex shrink-0 gap-1 overflow-x-auto border-b border-border/50 px-4 py-2 md:w-44 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:px-0 md:py-4"
      aria-label="Settings"
    >
      {#each sections as section}
        <a
          href={section.href}
          class={cn(
            "shrink-0 rounded-full px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors md:mx-4",
            activeSection === section.id
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onclick={(event) => handleNavClick(event, section.id)}
        >
          {section.label}
        </a>
      {/each}
    </nav>
    <div bind:this={contentRef} class="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
      {@render children()}
    </div>
  </div>
</PageShell>
