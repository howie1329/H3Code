<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Code from "$lib/components/ai-elements/code/index.js";

	type ToolVariant = "default" | "transcript";

	interface ToolInputProps {
		class?: string;
		input: unknown;
		variant?: ToolVariant;
		[key: string]: unknown;
	}

	let { class: className = "", input, variant = "default", ...restProps }: ToolInputProps = $props();

	let formattedInput = $derived.by(() => {
		return typeof input === "string" ? input : JSON.stringify(input, null, 2);
	});

	let id = $props.id();
</script>

{#if variant === "transcript"}
	<pre
		{id}
		class={cn("overflow-x-auto py-1 font-mono text-[11px] leading-snug text-muted-foreground", className)}
		{...restProps}
	>{formattedInput}</pre>
{:else}
	<div {id} class={cn("space-y-2 overflow-hidden p-4", className)} {...restProps}>
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">Parameters</h4>
		<div class="bg-muted/50 rounded-md">
			<Code.Root code={formattedInput} lang="json" hideLines>
				<Code.CopyButton />
			</Code.Root>
		</div>
	</div>
{/if}
