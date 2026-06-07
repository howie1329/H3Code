import { createServerFn } from '@tanstack/react-start'
import { auth, clerkClient } from '@clerk/tanstack-react-start/server'

export type GitHubRepository = {
  defaultBranch: string
  fullName: string
  githubId: number
  isPrivate: boolean
  name: string
  ownerLogin: string
  url: string
}

type GitHubConnectionPayload = {
  connection: {
    errorMessage?: string
    githubAccountId?: string
    githubLogin?: string
    scopes: string[]
    status: 'connected' | 'missing_scopes' | 'token_unavailable'
  }
  user: {
    displayName?: string
    email?: string
    imageUrl?: string
  }
}

type GitHubPickerPayload = {
  errorMessage?: string
  repositories: GitHubRepository[]
  status: 'connected' | 'missing_scopes' | 'token_unavailable'
}

type GitHubApiUser = {
  id: number
  login: string
  name?: string | null
  email?: string | null
  avatar_url?: string | null
}

type GitHubApiRepository = {
  default_branch?: string
  full_name: string
  html_url: string
  id: number
  name: string
  owner: {
    login: string
  }
  private: boolean
}

const MAX_PICKER_REPOS = 300
const REPOS_PER_PAGE = 100

function parseScopes(scopeHeader: string | null) {
  if (!scopeHeader) {
    return []
  }

  return scopeHeader
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
}

async function fetchGitHub<T>(path: string, token: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  return {
    data: response.ok ? ((await response.json()) as T) : null,
    ok: response.ok,
    scopes: parseScopes(response.headers.get('x-oauth-scopes')),
    status: response.status,
  }
}

function mapRepository(repo: GitHubApiRepository): GitHubRepository {
  return {
    defaultBranch: repo.default_branch ?? 'main',
    fullName: repo.full_name,
    githubId: repo.id,
    isPrivate: repo.private,
    name: repo.name,
    ownerLogin: repo.owner.login,
    url: repo.html_url,
  }
}

async function getGitHubAuthContext() {
  const { userId } = await auth()
  if (!userId) {
    return null
  }

  const clerk = clerkClient()
  const user = await clerk.users.getUser(userId)
  const tokens = await clerk.users.getUserOauthAccessToken(userId, 'github')
  const token = tokens.data[0]?.token

  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress
  const displayName =
    user.fullName ?? user.username ?? primaryEmail ?? user.id

  return {
    token,
    userId,
    userProfile: {
      displayName,
      email: primaryEmail,
      imageUrl: user.imageUrl,
    },
  }
}

async function fetchAllUserRepositories(token: string): Promise<{
  errorMessage?: string
  repositories: GitHubRepository[]
  scopes: string[]
  status: 'connected' | 'missing_scopes' | 'token_unavailable'
}> {
  const repositories: GitHubRepository[] = []
  let page = 1
  let scopes: string[] = []

  while (repositories.length < MAX_PICKER_REPOS) {
    const response = await fetchGitHub<GitHubApiRepository[]>(
      `/user/repos?per_page=${REPOS_PER_PAGE}&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`,
      token,
    )

    if (response.scopes.length > 0) {
      scopes = response.scopes
    }

    if (!response.ok || !response.data) {
      return {
        errorMessage: `GitHub repository request failed with status ${response.status}.`,
        repositories: [],
        scopes,
        status: response.status === 403 ? 'missing_scopes' : 'token_unavailable',
      }
    }

    if (response.data.length === 0) {
      break
    }

    for (const repo of response.data) {
      repositories.push(mapRepository(repo))
      if (repositories.length >= MAX_PICKER_REPOS) {
        break
      }
    }

    if (response.data.length < REPOS_PER_PAGE) {
      break
    }

    page += 1
  }

  return {
    repositories,
    scopes,
    status: 'connected',
  }
}

export const loadGitHubConnectionPayload = createServerFn({
  method: 'GET',
}).handler(async (): Promise<GitHubConnectionPayload> => {
  const authContext = await getGitHubAuthContext()
  if (!authContext) {
    return {
      connection: {
        errorMessage: 'Sign in before connecting GitHub.',
        scopes: [],
        status: 'token_unavailable',
      },
      user: {},
    }
  }

  const { token, userProfile } = authContext

  if (!token) {
    return {
      connection: {
        errorMessage:
          'GitHub is not connected to this Clerk account, or Clerk has no GitHub OAuth token.',
        scopes: [],
        status: 'token_unavailable',
      },
      user: userProfile,
    }
  }

  const githubUser = await fetchGitHub<GitHubApiUser>('/user', token)
  if (!githubUser.ok || !githubUser.data) {
    return {
      connection: {
        errorMessage: `GitHub profile request failed with status ${githubUser.status}.`,
        scopes: githubUser.scopes,
        status:
          githubUser.status === 403 ? 'missing_scopes' : 'token_unavailable',
      },
      user: userProfile,
    }
  }

  return {
    connection: {
      githubAccountId: String(githubUser.data.id),
      githubLogin: githubUser.data.login,
      scopes: githubUser.scopes,
      status: 'connected',
    },
    user: {
      ...userProfile,
      displayName: githubUser.data.name ?? userProfile.displayName,
      email: githubUser.data.email ?? userProfile.email,
      imageUrl: githubUser.data.avatar_url ?? userProfile.imageUrl,
    },
  }
})

export const listGitHubRepositoriesForPicker = createServerFn({
  method: 'GET',
}).handler(async (): Promise<GitHubPickerPayload> => {
  const authContext = await getGitHubAuthContext()
  if (!authContext) {
    return {
      errorMessage: 'Sign in before loading GitHub repositories.',
      repositories: [],
      status: 'token_unavailable',
    }
  }

  const { token } = authContext
  if (!token) {
    return {
      errorMessage:
        'GitHub is not connected to this Clerk account, or Clerk has no GitHub OAuth token.',
      repositories: [],
      status: 'token_unavailable',
    }
  }

  const result = await fetchAllUserRepositories(token)
  return {
    errorMessage: result.errorMessage,
    repositories: result.repositories,
    status: result.status,
  }
})
