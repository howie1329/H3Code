import { createServerFn } from '@tanstack/react-start'
import { auth, clerkClient } from '@clerk/tanstack-react-start/server'

type GitHubRepository = {
  defaultBranch?: string
  fullName: string
  githubId: number
  isPrivate: boolean
  name: string
  ownerLogin: string
  pushedAt?: string
  url: string
}

type GitHubSyncPayload = {
  connection: {
    errorMessage?: string
    githubAccountId?: string
    githubLogin?: string
    scopes: string[]
    status: 'connected' | 'missing_scopes' | 'token_unavailable'
  }
  repositories: GitHubRepository[]
  user: {
    displayName?: string
    email?: string
    imageUrl?: string
  }
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
  pushed_at?: string | null
}

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

export const loadGitHubSyncPayload = createServerFn({
  method: 'GET',
}).handler(async (): Promise<GitHubSyncPayload> => {
  const { userId } = await auth()
  if (!userId) {
    return {
      connection: {
        errorMessage: 'Sign in before connecting GitHub.',
        scopes: [],
        status: 'token_unavailable',
      },
      repositories: [],
      user: {},
    }
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

  const userProfile = {
    displayName,
    email: primaryEmail,
    imageUrl: user.imageUrl,
  }

  if (!token) {
    return {
      connection: {
        errorMessage:
          'GitHub is not connected to this Clerk account, or Clerk has no GitHub OAuth token.',
        scopes: [],
        status: 'token_unavailable',
      },
      repositories: [],
      user: userProfile,
    }
  }

  const githubUser = await fetchGitHub<GitHubApiUser>('/user', token)
  if (!githubUser.ok || !githubUser.data) {
    return {
      connection: {
        errorMessage: `GitHub profile request failed with status ${githubUser.status}.`,
        scopes: githubUser.scopes,
        status: githubUser.status === 403 ? 'missing_scopes' : 'token_unavailable',
      },
      repositories: [],
      user: userProfile,
    }
  }

  const repos = await fetchGitHub<GitHubApiRepository[]>(
    '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member',
    token,
  )

  const scopes = repos.scopes.length > 0 ? repos.scopes : githubUser.scopes
  if (!repos.ok || !repos.data) {
    return {
      connection: {
        errorMessage: `GitHub repository request failed with status ${repos.status}.`,
        githubAccountId: String(githubUser.data.id),
        githubLogin: githubUser.data.login,
        scopes,
        status: repos.status === 403 ? 'missing_scopes' : 'token_unavailable',
      },
      repositories: [],
      user: {
        ...userProfile,
        displayName: githubUser.data.name ?? userProfile.displayName,
        email: githubUser.data.email ?? userProfile.email,
        imageUrl: githubUser.data.avatar_url ?? userProfile.imageUrl,
      },
    }
  }

  return {
    connection: {
      githubAccountId: String(githubUser.data.id),
      githubLogin: githubUser.data.login,
      scopes,
      status: 'connected',
    },
    repositories: repos.data.map((repo) => ({
      defaultBranch: repo.default_branch,
      fullName: repo.full_name,
      githubId: repo.id,
      isPrivate: repo.private,
      name: repo.name,
      ownerLogin: repo.owner.login,
      pushedAt: repo.pushed_at ?? undefined,
      url: repo.html_url,
    })),
    user: {
      ...userProfile,
      displayName: githubUser.data.name ?? userProfile.displayName,
      email: githubUser.data.email ?? userProfile.email,
      imageUrl: githubUser.data.avatar_url ?? userProfile.imageUrl,
    },
  }
})
