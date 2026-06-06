import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const connectionStatus = v.union(
  v.literal('connected'),
  v.literal('missing_scopes'),
  v.literal('token_unavailable'),
)

const repositoryInput = v.object({
  defaultBranch: v.optional(v.string()),
  fullName: v.string(),
  githubId: v.number(),
  isPrivate: v.boolean(),
  name: v.string(),
  ownerLogin: v.string(),
  pushedAt: v.optional(v.string()),
  url: v.string(),
})

async function getClerkUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

export const getConnection = query({
  handler: async (ctx) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) {
      return {
        connection: null,
        repositories: [],
      }
    }

    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .unique()

    const repositories = await ctx.db
      .query('githubRepositories')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .collect()

    return {
      connection,
      repositories: repositories.sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      ),
    }
  },
})

export const syncRepositories = mutation({
  args: {
    connection: v.object({
      errorMessage: v.optional(v.string()),
      githubAccountId: v.optional(v.string()),
      githubLogin: v.optional(v.string()),
      scopes: v.array(v.string()),
      status: connectionStatus,
    }),
    repositories: v.array(repositoryInput),
    user: v.object({
      displayName: v.optional(v.string()),
      email: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) {
      throw new Error('Sign in to sync GitHub repositories.')
    }

    const now = Date.now()
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .unique()

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        ...args.user,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('users', {
        clerkUserId,
        ...args.user,
        updatedAt: now,
      })
    }

    const existingConnection = await ctx.db
      .query('githubConnections')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .unique()

    const connection = {
      clerkUserId,
      ...args.connection,
      updatedAt: now,
    }

    if (existingConnection) {
      await ctx.db.patch(existingConnection._id, connection)
    } else {
      await ctx.db.insert('githubConnections', connection)
    }

    for (const repository of args.repositories) {
      const existingRepository = await ctx.db
        .query('githubRepositories')
        .withIndex('by_clerk_user_id_full_name', (q) =>
          q.eq('clerkUserId', clerkUserId).eq('fullName', repository.fullName),
        )
        .unique()

      const nextRepository = {
        clerkUserId,
        ...repository,
        syncedAt: now,
      }

      if (existingRepository) {
        await ctx.db.patch(existingRepository._id, nextRepository)
      } else {
        await ctx.db.insert('githubRepositories', nextRepository)
      }
    }

    return {
      repositoryCount: args.repositories.length,
      status: args.connection.status,
    }
  },
})
