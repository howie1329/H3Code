import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const connectionStatus = v.union(
  v.literal('connected'),
  v.literal('missing_scopes'),
  v.literal('token_unavailable'),
)

async function getClerkUserId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> }
}) {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

export const getConnection = query({
  handler: async (ctx) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) {
      return { connection: null }
    }

    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .unique()

    return { connection }
  },
})

export const verifyConnection = mutation({
  args: {
    connection: v.object({
      errorMessage: v.optional(v.string()),
      githubAccountId: v.optional(v.string()),
      githubLogin: v.optional(v.string()),
      scopes: v.array(v.string()),
      status: connectionStatus,
    }),
    user: v.object({
      displayName: v.optional(v.string()),
      email: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) {
      throw new Error('Sign in to verify GitHub connection.')
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

    return { status: args.connection.status }
  },
})
