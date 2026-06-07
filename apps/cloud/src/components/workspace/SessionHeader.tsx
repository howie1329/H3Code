'use client'

import type { SessionStatus } from '@h3code/agent-core'

import { SessionHeaderActions } from '#/components/workspace/SessionHeaderActions.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import HeaderUser from '#/integrations/clerk/header-user'

type SessionHeaderProps = {
  title: string
  status?: SessionStatus
  hasDiff?: boolean
}

export function SessionHeader({
  title,
  status = 'idle',
  hasDiff = false,
}: SessionHeaderProps) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-xs font-medium leading-snug text-foreground">
          {title}
        </h1>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {status}
        </Badge>
      </div>

      <SessionHeaderActions hasDiff={hasDiff} />

      <HeaderUser />
    </header>
  )
}
