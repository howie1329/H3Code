import { cn } from "$lib/utils.js";

export const COMPOSER_MENU_SHELL_CLASS =
  "overflow-hidden rounded-md border border-border/50 bg-popover text-popover-foreground shadow-none transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none";

export const COMPOSER_MENU_HEADER_TITLE_CLASS = "text-xs font-medium leading-tight text-foreground";

export const COMPOSER_MENU_HEADER_DESC_CLASS = "mt-0.5 text-[11px] leading-tight text-muted-foreground";

export const COMPOSER_MENU_GROUP_LABEL_CLASS =
  "px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/80 first:pt-1";

/** Session settings control in composer toolbar; matches sidebar row density (h-7, 11px). */
export const SESSION_SETTINGS_TRIGGER_CLASS =
  "session-settings-trigger inline-flex h-7 max-w-[min(100%,14rem)] shrink-0 items-center gap-1 rounded-md border-0 bg-transparent px-2 font-sans text-[11px] font-medium leading-snug text-foreground shadow-none outline-none transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

export const SESSION_SETTINGS_STATIC_LABEL_CLASS =
  "inline-flex h-7 max-w-[min(100%,14rem)] shrink-0 items-center truncate px-2 text-[11px] font-medium leading-snug text-muted-foreground";

export function composerMenuRowClass(highlighted: boolean, multiline = false) {
  return cn(
    "flex w-full gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    multiline ? "items-start px-3 py-2" : "h-7 items-center px-3",
    highlighted ? "bg-accent" : "hover:bg-accent",
  );
}
