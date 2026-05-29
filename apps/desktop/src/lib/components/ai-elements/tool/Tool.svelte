<script lang="ts">
	import { Collapsible } from "$lib/components/ui/collapsible/index.js";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type ToolVariant = "default" | "transcript";

	interface ToolProps {
		class?: string;
		variant?: ToolVariant;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		class: className = "",
		variant = "default",
		open = $bindable(false),
		children,
		...restProps
	}: ToolProps = $props();

	let id = $derived.by(() => crypto.randomUUID());
</script>

<Collapsible
	{id}
	bind:open
	class={cn(
		"not-prose w-full",
		variant === "transcript" ? "mb-0 rounded-none border-0" : "mb-4 rounded-md border",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</Collapsible>
