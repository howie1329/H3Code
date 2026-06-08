type ClerkOAuthTokenResponse = {
  data?: Array<{
    token?: string
  }>
}

export async function getGitHubTokenForClerkUser(
  clerkUserId: string,
): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is not configured in Convex.')
  }

  for (const provider of ['oauth_github', 'github'] as const) {
    const response = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}/oauth_access_tokens/${provider}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    )

    if (response.status === 404) {
      continue
    }

    if (!response.ok) {
      throw new Error(
        `Failed to load GitHub token from Clerk (${response.status}).`,
      )
    }

    const payload = (await response.json()) as ClerkOAuthTokenResponse
    const token = payload.data?.[0]?.token
    if (token) {
      return token
    }
  }

  return null
}
