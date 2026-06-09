import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { internalMutation, internalQuery } from './_generated/server'
import type { MutationCtx } from './_generated/server'

const SYSTEM_MESSAGE_MAX_LENGTH = 500

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}

async function nextMessageSeq(
  ctx: MutationCtx,
  sessionId: Id<'sessions'>,
): Promise<number> {
  const latestMessage = await ctx.db
    .query('messages')
    .withIndex('by_session_and_seq', (q) => q.eq('sessionId', sessionId))
    .order('desc')
    .first()

  return (latestMessage?.seq ?? 0) + 1
}

export const getSessionForProvision = internalQuery({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      return null
    }

    const user = await ctx.db.get(session.userId)
    if (!user) {
      return null
    }

    return {
      session,
      clerkUserId: user.clerkUserId,
    }
  },
})

export const markProvisionSuccess = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    sandboxId: v.string(),
    probeOutput: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.status !== 'provisioning') {
      return
    }

    const now = Date.now()
    const seq = await nextMessageSeq(ctx, args.sessionId)

    await ctx.db.insert('messages', {
      sessionId: args.sessionId,
      seq,
      role: 'system',
      content: truncate(
        `Sandbox provisioned (${args.sandboxId}). Probe output:\n${args.probeOutput}`,
        SYSTEM_MESSAGE_MAX_LENGTH,
      ),
      createdAt: now,
    })

    await ctx.db.patch(args.sessionId, {
      status: 'ready',
      sandboxId: args.sandboxId,
      provisionError: undefined,
      updatedAt: now,
      lastActivityAt: now,
    })
  },
})

export const markProvisionError = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    provisionError: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.status !== 'provisioning') {
      return
    }

    const now = Date.now()
    const seq = await nextMessageSeq(ctx, args.sessionId)
    const message = truncate(args.provisionError, SYSTEM_MESSAGE_MAX_LENGTH)

    await ctx.db.insert('messages', {
      sessionId: args.sessionId,
      seq,
      role: 'system',
      content: `Sandbox provisioning failed: ${message}`,
      createdAt: now,
    })

    await ctx.db.patch(args.sessionId, {
      status: 'error',
      provisionError: message,
      updatedAt: now,
      lastActivityAt: now,
    })
  },
})
