import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { createFileRoute } from '@tanstack/react-router'

import { api } from '../../../convex/_generated/api'

import { WorkspaceLanding } from '#/components/workspace/WorkspaceLanding.tsx'
import type { MockRepository } from '#/lib/mock/types.ts'

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
  const githubState = useQuery(api.github.getConnection)
  const repositories = useMemo<MockRepository[]>(
    () =>
      githubState?.repositories.map((repository) => ({
        defaultBranch: repository.defaultBranch ?? 'main',
        id: repository.fullName,
        name: repository.name,
        owner: repository.ownerLogin,
      })) ?? [],
    [githubState?.repositories],
  )

  return (
    <WorkspaceLanding
      initialRepositoryId={repo}
      isLoadingWorkspace={githubState === undefined}
      repositories={repositories}
    />
  )
}
