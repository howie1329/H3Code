import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function getClerkUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

export async function requireUser(ctx: MutationCtx): Promise<{
  clerkUserId: string
  userId: Id<'users'>
}> {
  const clerkUserId = await getClerkUserId(ctx)
  if (!clerkUserId) {
    throw new Error('Sign in to continue.')
  }

  const existingUser = await ctx.db
    .query('users')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
    .unique()

  if (existingUser) {
    return { clerkUserId, userId: existingUser._id }
  }

  const now = Date.now()
  const userId = await ctx.db.insert('users', {
    clerkUserId,
    updatedAt: now,
  })

  return { clerkUserId, userId }
}
