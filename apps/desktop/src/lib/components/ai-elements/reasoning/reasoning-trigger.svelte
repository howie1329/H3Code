<script lang="ts">
	import { cn } from "$lib/utils";
	import { CollapsibleTrigger } from "$lib/components/ui/collapsible/index.js";
	import { getReasoningContext } from "./reasoning-context.svelte.js";
	import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
	import { HugeiconsIcon } from "@hugeicons/svelte";
	import BrainIcon from "@lucide/svelte/icons/brain";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

	type ReasoningVariant = "default" | "transcript";

	interface Props {
		class?: string;
		variant?: ReasoningVariant;
		children?: import("svelte").Snippet;
	}

	let { class: className = "", variant = "default", children, ...props }: Props = $props();

	let reasoningContext = getReasoningContext();

	let getThinkingMessage = $derived.by(() => {
		let { isStreaming, duration } = reasoningContext;

		if (isStreaming || duration === 0) {
			return "Thinking…";
		}
		if (duration === undefined) {
			return "Reasoning";
		}
		return `Thought for ${duration}s`;
	});
</script>

{#if variant === "transcript"}
	<CollapsibleTrigger
		class={cn(
			"flex h-7 w-full items-center gap-2 rounded-md px-1 text-left text-xs text-muted-foreground outline-none transition-[background-color,color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
			className
		)}
		{...props}
	>
		{#if children}
			{@render children()}
		{:else}
			{#if reasoningContext.isStreaming}
				<span class="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>
			{:else}
				<span class="size-1.5 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden="true"></span>
			{/if}
			<span class="min-w-0 flex-1 truncate font-medium">{getThinkingMessage}</span>
			<HugeiconsIcon
				icon={ArrowDown01Icon}
				class={cn(
					"size-3 shrink-0 text-muted-foreground transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
					reasoningContext.isOpen && "rotate-180"
				)}
			/>
		{/if}
	</CollapsibleTrigger>
{:else}
	<CollapsibleTrigger
		class={cn(
			"text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm transition-colors motion-reduce:transition-none",
			className
		)}
		{...props}
	>
		{#if children}
			{@render children()}
		{:else}
			<BrainIcon class="size-4" />
			<p>{getThinkingMessage}</p>
			<ChevronDownIcon
				class={cn(
					"size-4 transition-transform",
					reasoningContext.isOpen ? "rotate-180" : "rotate-0"
				)}
			/>
		{/if}
	</CollapsibleTrigger>
{/if}
