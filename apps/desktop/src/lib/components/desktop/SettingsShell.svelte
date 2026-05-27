<script lang="ts">
  import { goto } from "$app/navigation";
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
    { id: "worktrees", label: "Worktrees", href: "/settings#worktrees" },
    { id: "about", label: "About", href: "/settings#about" },
  ] as const;

  type SectionId = (typeof sections)[number]["id"];

  function hashToSectionId(hash: string): SectionId {
    const id = hash.replace("#", "");
    return sections.some((section) => section.id === id) ? (id as SectionId) : "appearance";
  }

  let activeSection = $state<SectionId>(hashToSectionId(page.url.hash));
  let scrollSpyEnabled = $state(true);
  let didInitialHashScroll = false;

  function updateActiveFromScroll() {
    const container = contentRef;

    if (!container || !scrollSpyEnabled) {
      return;
    }

    const anchor = container.getBoundingClientRect().top + 72;

    let current: SectionId = sections[0].id;

    for (const section of sections) {
      const target = container.querySelector(`#${CSS.escape(section.id)}`);

      if (target instanceof HTMLElement && target.getBoundingClientRect().top <= anchor) {
        current = section.id;
      }
    }

    if (activeSection !== current) {
      activeSection = current;
    }
  }

  async function scrollToSection(sectionId: SectionId, updateHash = true) {
    activeSection = sectionId;

    const container = contentRef;
    const target = container?.querySelector(`#${CSS.escape(sectionId)}`);

    if (container && target instanceof HTMLElement) {
      scrollSpyEnabled = false;

      const offset =
        target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8;
      container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });

      window.setTimeout(() => {
        scrollSpyEnabled = true;
        updateActiveFromScroll();
      }, 400);
    }

    if (updateHash) {
      await goto(`/settings#${sectionId}`, { replaceState: true, noScroll: true, keepFocus: true });
    }
  }

  function handleNavClick(event: MouseEvent, sectionId: SectionId) {
    event.preventDefault();
    void scrollToSection(sectionId);
  }

  $effect(() => {
    activeSection = hashToSectionId(page.url.hash);
  });

  $effect(() => {
    const container = contentRef;

    if (!container) {
      return;
    }

    if (!didInitialHashScroll && page.url.hash) {
      didInitialHashScroll = true;
      const sectionId = hashToSectionId(page.url.hash);
      void tick().then(() => scrollToSection(sectionId, false));
    }

    const onScroll = () => updateActiveFromScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    updateActiveFromScroll();

    return () => container.removeEventListener("scroll", onScroll);
  });
</script>

<PageShell>
  <div class="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row">
    <nav
      class="flex shrink-0 gap-1 overflow-x-auto border-b border-border/50 px-4 py-2 md:w-44 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:px-0 md:py-4"
      aria-label="Settings"
    >
      {#each sections as section (section.id)}
        <a
          href={section.href}
          class={cn(
            "shrink-0 rounded-full px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors md:mx-4",
            activeSection === section.id
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          aria-current={activeSection === section.id ? "page" : undefined}
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
