'use client'

import { FileDiffIcon } from 'lucide-react'

import { cn } from '#/lib/utils.ts'

type SessionDiffPanelProps = {
  changedPaths: readonly string[]
  className?: string
}

export function SessionDiffPanel({
  changedPaths,
  className,
}: SessionDiffPanelProps) {
  const hasPaths = changedPaths.length > 0

  return (
    <aside
      aria-label="Session diff"
      className={cn(
        'flex min-h-0 w-64 shrink-0 flex-col overflow-hidden border-l border-border/60 bg-background',
        className,
      )}
    >
      <div className="border-b border-border/60 px-4 py-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Session diff
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!hasPaths ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileDiffIcon
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              No file changes in this session yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {changedPaths.map((path) => (
              <li
                key={path}
                className="rounded-md border border-border/60 px-2.5 py-2"
              >
                <p className="break-all font-mono text-[11px] leading-snug text-foreground">
                  {path}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Unified diff — wired in a later pass.
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
