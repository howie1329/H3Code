<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	type TextareaProps = WithElementRef<HTMLTextareaAttributes>;

	let {
		class: className,
		ref = $bindable(null),
		value = $bindable(),
		...restProps
	}: TextareaProps = $props();
</script>

<textarea
	bind:this={ref}
	class={cn(
		"border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-xs shadow-none outline-none transition-[color,box-shadow] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:value
	{...restProps}
></textarea>
