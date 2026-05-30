import { cn } from "$lib/utils.js";

export const COMPOSER_MENU_SHELL_CLASS =
  "overflow-hidden rounded-md border border-border/50 bg-popover text-popover-foreground shadow-none transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none";

export const COMPOSER_MENU_HEADER_TITLE_CLASS = "text-xs font-medium leading-tight text-foreground";

export const COMPOSER_MENU_HEADER_DESC_CLASS = "mt-0.5 text-[11px] leading-tight text-muted-foreground";

export const COMPOSER_MENU_GROUP_LABEL_CLASS =
  "px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/80 first:pt-1";

/** Footer session-settings trigger: explicit size/weight beats UA button bold. */
export const SESSION_SETTINGS_TRIGGER_CLASS =
	"session-settings-trigger inline-flex h-6 max-w-[min(100%,12rem)] shrink-0 items-center gap-0.5 rounded-md border-0 bg-transparent px-1.5 font-sans text-[0.625rem] font-light leading-none tracking-normal text-muted-foreground shadow-none outline-none transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

export function composerMenuRowClass(highlighted: boolean, multiline = false) {
  return cn(
    "flex w-full gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    multiline ? "items-start px-3 py-2" : "h-7 items-center px-3",
    highlighted ? "bg-accent" : "hover:bg-accent",
  );
}
