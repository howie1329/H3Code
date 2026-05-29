<script lang="ts">
	import { CollapsibleTrigger } from "$lib/components/ui/collapsible/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { cn } from "$lib/utils";
	import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
	import { HugeiconsIcon } from "@hugeicons/svelte";

	import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import CircleIcon from "@lucide/svelte/icons/circle";
	import ClockIcon from "@lucide/svelte/icons/clock";
	import WrenchIcon from "@lucide/svelte/icons/wrench";
	import XCircleIcon from "@lucide/svelte/icons/x-circle";

	type ToolUIPartType = string;
	type ToolUIPartState =
		| "input-streaming"
		| "input-available"
		| "output-available"
		| "output-error";

	type ToolVariant = "default" | "transcript";

	interface ToolHeaderProps {
		type: ToolUIPartType;
		state: ToolUIPartState;
		variant?: ToolVariant;
		class?: string;
		[key: string]: any;
	}

	let { type, state, variant = "default", class: className = "", ...restProps }: ToolHeaderProps = $props();

	let getStatusBadge = $derived.by(() => {
		const labels = {
			"input-streaming": "Pending",
			"input-available": "Running",
			"output-available": "Completed",
			"output-error": "Error",
		} as const;

		const icons = {
			"input-streaming": CircleIcon,
			"input-available": ClockIcon,
			"output-available": CheckCircleIcon,
			"output-error": XCircleIcon,
		} as const;

		const IconComponent = icons[state];
		const label = labels[state];

		return { IconComponent, label };
	});
	let IconComponent = $derived(getStatusBadge.IconComponent);

	const isRunning = $derived(state === "input-available" || state === "input-streaming");
	const isError = $derived(state === "output-error");

	const statusClass = $derived(
		cn(
			"size-1.5 shrink-0 rounded-full",
			isRunning && "animate-pulse bg-primary",
			isError && "bg-destructive",
			!isRunning && !isError && "bg-muted-foreground/60"
		)
	);

	let id = $props.id();
</script>

{#if variant === "transcript"}
	<CollapsibleTrigger
		{id}
		class={cn(
			"flex h-7 w-full items-center gap-2 rounded-md px-1 text-left text-xs text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
			className
		)}
		{...restProps}
	>
		<span class={statusClass} aria-hidden="true"></span>
		<span class="min-w-0 flex-1 truncate font-medium">{type}</span>
		<HugeiconsIcon
			icon={ArrowDown01Icon}
			class="size-3 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
		/>
	</CollapsibleTrigger>
{:else}
	<CollapsibleTrigger
		{id}
		class={cn("flex w-full items-center justify-between gap-4 p-3", className)}
		{...restProps}
	>
		<div class="flex items-center gap-2">
			<WrenchIcon class="text-muted-foreground size-4" />
			<span class="text-sm font-medium">{type}</span>
			<Badge class="gap-1.5 rounded-full text-xs" variant="secondary">
				<IconComponent
					class={cn(
						"size-4",
						state === "input-available" && "animate-pulse",
						state === "output-available" && "text-green-600",
						state === "output-error" && "text-red-600"
					)}
				/>

				{getStatusBadge.label}
			</Badge>
		</div>
		<ChevronDownIcon
			class="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
		/>
	</CollapsibleTrigger>
{/if}
