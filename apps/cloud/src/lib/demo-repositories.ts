export type DemoRepository = {
  id: string
  name: string
  defaultOpen?: boolean
}

/** Placeholder data until Convex / GitHub repos are wired. */
export const DEMO_REPOSITORIES: readonly DemoRepository[] = [
  { id: 'repo-1', name: 'Repository 1', defaultOpen: true },
  { id: 'repo-2', name: 'Repository 2', defaultOpen: false },
  { id: 'repo-3', name: 'Repository 3', defaultOpen: false },
] as const

export function getDefaultDemoRepositoryId(
  repos: readonly DemoRepository[] = DEMO_REPOSITORIES,
): string | undefined {
  if (repos.length === 0) {
    return undefined
  }

  return repos.find((repo) => repo.defaultOpen)?.id ?? repos[0]?.id
}
