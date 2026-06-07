import { useCallback, useMemo } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { createFileRoute } from '@tanstack/react-router'

import { api } from '../../../convex/_generated/api'
import { WorkspaceLanding } from '#/components/workspace/WorkspaceLanding.tsx'
import { mapWorkspaceRepositories } from '#/lib/session/repositories.ts'

type AppWorkspaceSearch = {
  repo?: string
}

export const Route = createFileRoute('/app/')({
  validateSearch: (search: Record<string, unknown>): AppWorkspaceSearch => ({
    repo: typeof search.repo === 'string' ? search.repo : undefined,
  }),
  head: () => ({
    meta: [{ title: 'New session · H3Code Cloud' }],
  }),
  component: AppWorkspaceLandingRoute,
})

function AppWorkspaceLandingRoute() {
  const { repo } = Route.useSearch()
  const workspaceRepoRows = useQuery(api.workspaceRepositories.list)
  const createSession = useMutation(api.sessions.create)

  const repositories = useMemo(
    () => mapWorkspaceRepositories(workspaceRepoRows ?? []),
    [workspaceRepoRows],
  )

  const handleCreateSession = useCallback(
    async (repositoryId: string, baseBranch: string, prompt: string) => {
      const result = await createSession({
        repositoryFullName: repositoryId,
        baseBranch,
        initialPrompt: prompt,
      })

      return result.sessionId
    },
    [createSession],
  )

  return (
    <WorkspaceLanding
      initialRepositoryId={repo}
      isLoadingWorkspace={workspaceRepoRows === undefined}
      repositories={repositories}
      onCreateSession={handleCreateSession}
    />
  )
}
