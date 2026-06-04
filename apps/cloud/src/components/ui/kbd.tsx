import { cn } from '#/lib/utils.ts'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-xs bg-muted px-1 font-sans text-[0.625rem] font-medium text-muted-foreground [&_svg:not([class*="size-"])]:size-3',
        className,
      )}
      {...props}
    />
  )
}

export { Kbd }
