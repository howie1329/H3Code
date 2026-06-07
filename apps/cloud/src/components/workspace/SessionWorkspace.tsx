'use client'

import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'

import { SessionComposer } from '#/components/workspace/SessionComposer.tsx'
import { SessionInspector } from '#/components/workspace/SessionInspector.tsx'
import { SessionTranscript } from '#/components/workspace/SessionTranscript.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  getMockSession,
  getMockSessionDetail,
  listMockRepositories,
} from '#/lib/mock/index.ts'

type SessionWorkspaceProps = {
  sessionId: string
}

export function SessionWorkspace({ sessionId }: SessionWorkspaceProps) {
  const session = getMockSession(sessionId)
  const detail = getMockSessionDetail(sessionId)

  const repositoryName = useMemo(() => {
    if (!session) {
      return undefined
    }

    return listMockRepositories().find(
      (repo) => repo.id === session.repositoryId,
    )?.name
  }, [session])

  if (!session || !detail) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">
            Session not found
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground">
            {sessionId}
          </p>
        </div>
        <Button asChild size="sm" className="h-7 text-xs">
          <Link to="/app">Back to workspace</Link>
        </Button>
      </main>
    )
  }

  const title = session.summary.title ?? session.id

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-label={title}
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <SessionTranscript
            messages={detail.messages}
            isStreaming={detail.isStreaming}
            isCompacting={detail.isCompacting}
          />
          <SessionComposer
            sessionTitle={title}
            isStreaming={detail.isStreaming}
            onSubmit={async () => {
              // Steer / send — wired when Convex session mutations land.
            }}
            onStop={() => {
              // Abort — wired when cloud sandbox control lands.
            }}
          />
        </div>

        <SessionInspector
          session={session}
          detail={detail}
          repositoryName={repositoryName}
        />
      </div>
    </main>
  )
}
