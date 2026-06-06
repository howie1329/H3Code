import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const current = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    return await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()
  },
})

export const upsertCurrent = mutation({
  args: {
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Sign in to sync your user profile.')
    }

    const now = Date.now()
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()

    const user = {
      clerkUserId: identity.subject,
      displayName: args.displayName,
      email: args.email,
      imageUrl: args.imageUrl,
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, user)
      return existing._id
    }

    return await ctx.db.insert('users', user)
  },
})
