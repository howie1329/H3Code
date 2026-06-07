'use client'

import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

import { SessionComposer } from '#/components/workspace/SessionComposer.tsx'
import { SessionDiffPanel } from '#/components/workspace/SessionDiffPanel.tsx'
import { SessionHeader } from '#/components/workspace/SessionHeader.tsx'
import { SessionInspector } from '#/components/workspace/SessionInspector.tsx'
import { SessionTranscript } from '#/components/workspace/SessionTranscript.tsx'
import {
  SessionWorkspaceProvider,
  useSessionWorkspace,
} from '#/components/workspace/session-workspace-context.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import {
  mapConvexMessagesToTranscript,
  mapSessionStatus,
  repositoryFullName,
} from '#/lib/session/convex-mappers.ts'
import {
  collectSessionChangedPaths,
  sessionHasDiff,
} from '#/lib/session/session-diff.ts'

type SessionWorkspaceProps = {
  sessionId: string
}

export function SessionWorkspace({ sessionId }: SessionWorkspaceProps) {
  return (
    <SessionWorkspaceProvider>
      <SessionWorkspaceContent sessionId={sessionId} />
    </SessionWorkspaceProvider>
  )
}

function SessionWorkspaceContent({ sessionId }: SessionWorkspaceProps) {
  const sessionData = useQuery(api.sessions.get, {
    sessionId: sessionId as Id<'sessions'>,
  })
  const sendMessage = useMutation(api.sessions.sendMessage)
  const { activePanel } = useSessionWorkspace()

  const messages = useMemo(
    () =>
      sessionData?.messages
        ? mapConvexMessagesToTranscript(sessionData.messages)
        : [],
    [sessionData?.messages],
  )

  const detail = useMemo(
    () => ({
      messages,
      steering: [] as const,
      followUp: [] as const,
      isStreaming: false,
      isCompacting: false,
    }),
    [messages],
  )

  const repoFullName = useMemo(
    () =>
      sessionData?.session
        ? repositoryFullName(
            sessionData.session.githubOwner,
            sessionData.session.githubRepo,
          )
        : undefined,
    [sessionData?.session],
  )

  const repositoryName = sessionData?.session.githubRepo

  const changedPaths = useMemo(
    () => collectSessionChangedPaths(detail.messages),
    [detail.messages],
  )

  const hasDiff = useMemo(
    () => sessionHasDiff(detail.messages),
    [detail.messages],
  )

  if (sessionData === undefined) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center border-b border-border/60 px-4">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-24 w-full max-w-xl" />
          <Skeleton className="h-24 w-full max-w-lg" />
        </div>
      </main>
    )
  }

  if (sessionData === null) {
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

  const title = sessionData.session.title ?? sessionId
  const status = mapSessionStatus(sessionData.session.status)

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-label={title}
    >
      <SessionHeader title={title} status={status} hasDiff={hasDiff} />

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
            onSubmit={async (text) => {
              await sendMessage({
                sessionId: sessionId as Id<'sessions'>,
                text,
              })
            }}
            onStop={() => {
              // Abort — wired when cloud sandbox control lands.
            }}
          />
        </div>

        {activePanel === 'context' && repoFullName ? (
          <SessionInspector
            title={title}
            status={status}
            repositoryFullName={repoFullName}
            repositoryName={repositoryName}
            detail={detail}
          />
        ) : null}

        {activePanel === 'diff' ? (
          <SessionDiffPanel changedPaths={changedPaths} />
        ) : null}
      </div>
    </main>
  )
}
