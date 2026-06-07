import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { requireUser } from './lib/auth'

const repositoryInput = v.object({
  defaultBranch: v.string(),
  fullName: v.string(),
  githubId: v.number(),
  isPrivate: v.boolean(),
  name: v.string(),
  ownerLogin: v.string(),
  url: v.string(),
})

async function getUserIdForQuery(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    return null
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', identity.subject))
    .unique()

  return user?._id ?? null
}

export const list = query({
  handler: async (ctx) => {
    const userId = await getUserIdForQuery(ctx)
    if (!userId) {
      return []
    }

    const repositories = await ctx.db
      .query('workspaceRepositories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    return repositories.sort((a, b) => b.addedAt - a.addedAt)
  },
})

export const add = mutation({
  args: repositoryInput,
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const now = Date.now()

    const existing = await ctx.db
      .query('workspaceRepositories')
      .withIndex('by_user_full_name', (q) =>
        q.eq('userId', userId).eq('fullName', args.fullName),
      )
      .unique()

    if (existing) {
      return { repositoryId: existing._id }
    }

    const repositoryId = await ctx.db.insert('workspaceRepositories', {
      userId,
      fullName: args.fullName,
      name: args.name,
      ownerLogin: args.ownerLogin,
      defaultBranch: args.defaultBranch,
      githubId: args.githubId,
      isPrivate: args.isPrivate,
      url: args.url,
      sortOrder: now,
      addedAt: now,
    })

    return { repositoryId }
  },
})

export const remove = mutation({
  args: {
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)

    const existing = await ctx.db
      .query('workspaceRepositories')
      .withIndex('by_user_full_name', (q) =>
        q.eq('userId', userId).eq('fullName', args.fullName),
      )
      .unique()

    if (!existing) {
      return { removed: false }
    }

    await ctx.db.delete(existing._id)
    return { removed: true }
  },
})
