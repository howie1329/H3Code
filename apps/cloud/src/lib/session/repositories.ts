import type { WorkspaceRepository } from '#/lib/session/types.ts'

export function getDefaultRepositoryId(
  repositories: readonly WorkspaceRepository[],
): string | undefined {
  if (repositories.length === 0) {
    return undefined
  }

  const preferred = repositories.find((repo) => repo.defaultOpen)
  return preferred?.id ?? repositories[0]?.id
}

export function mapGithubRepositories(
  repositories: readonly {
    defaultBranch?: string
    fullName: string
    name: string
    ownerLogin: string
  }[],
): WorkspaceRepository[] {
  return repositories.map((repository) => ({
    defaultBranch: repository.defaultBranch ?? 'main',
    id: repository.fullName,
    name: repository.name,
    owner: repository.ownerLogin,
  }))
}
