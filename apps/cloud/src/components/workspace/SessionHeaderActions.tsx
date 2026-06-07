'use client'

import {
  FileDiffIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from 'lucide-react'

import { useSessionWorkspace } from '#/components/workspace/session-workspace-context.tsx'
import { Button } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'

const headerActionClass = cn(
  'size-7 shrink-0 text-muted-foreground',
  'hover:bg-accent hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-ring/30',
  'active:translate-y-px motion-reduce:active:translate-y-0',
  '[&_svg]:size-3.5',
)

type SessionHeaderActionsProps = {
  hasDiff?: boolean
}

export function SessionHeaderActions({
  hasDiff = false,
}: SessionHeaderActionsProps) {
  const { activePanel, toggleContextPanel, toggleDiffPanel } =
    useSessionWorkspace()

  const contextToggleLabel =
    activePanel === 'context' ? 'Hide context panel' : 'Show context panel'
  const diffToggleLabel =
    activePanel === 'diff' ? 'Hide session diff' : 'Show session diff'

  return (
    <div className="flex items-center gap-0.5">
      {hasDiff ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={headerActionClass}
          aria-label={diffToggleLabel}
          aria-pressed={activePanel === 'diff'}
          title={diffToggleLabel}
          onClick={toggleDiffPanel}
        >
          <FileDiffIcon aria-hidden />
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={headerActionClass}
        aria-label={contextToggleLabel}
        aria-pressed={activePanel === 'context'}
        title={contextToggleLabel}
        onClick={toggleContextPanel}
      >
        {activePanel === 'context' ? (
          <PanelRightCloseIcon aria-hidden />
        ) : (
          <PanelRightOpenIcon aria-hidden />
        )}
      </Button>
    </div>
  )
}
