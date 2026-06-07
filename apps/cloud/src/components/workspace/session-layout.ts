import { cn } from '#/lib/utils.ts'

/** Centered transcript column — cloud session workspace only. */
export const SESSION_COLUMN_MAX_W_CLASS = 'max-w-3xl'

export const SESSION_COLUMN_INSET_CLASS = 'px-4 sm:px-6'

export const sessionColumnClass = cn(
  'mx-auto w-full',
  SESSION_COLUMN_MAX_W_CLASS,
)

/** Session composer: hairline border, flat canvas, operator focus ring. */
export const sessionPromptInputClass = cn(
  'w-full',
  '[&_[data-slot=input-group]]:rounded-md [&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-none',
  'dark:[&_[data-slot=input-group]]:bg-background',
  '[&_[data-slot=input-group]:has([data-slot=input-group-control]:focus-visible)]:ring-2',
  '[&_[data-slot=input-group]:has([data-slot=input-group-control]:focus-visible)]:ring-ring/30',
  '[&_[data-slot=input-group]:has([data-slot=input-group-control]:disabled)]:opacity-60',
)

export const sessionTextareaClass = cn(
  'min-h-14 px-3 py-2.5 text-xs leading-normal text-foreground md:text-xs',
  'placeholder:text-foreground/55',
)

export const sessionSubmitClass = cn(
  'size-7 rounded-md p-0 active:translate-y-px',
  'focus-visible:ring-2 focus-visible:ring-ring/30',
  '[&_svg]:size-3.5',
)
