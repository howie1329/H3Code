import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { requireUser } from './lib/auth'

type DbCtx = QueryCtx | MutationCtx

const TITLE_MAX_LENGTH = 60
const PREVIEW_MAX_LENGTH = 120

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}

function parseRepositoryFullName(fullName: string): {
  githubOwner: string
  githubRepo: string
} {
  const separatorIndex = fullName.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === fullName.length - 1) {
    throw new Error('Repository name must be in owner/repo format.')
  }

  return {
    githubOwner: fullName.slice(0, separatorIndex),
    githubRepo: fullName.slice(separatorIndex + 1),
  }
}

async function requireOwnedSession(
  ctx: DbCtx,
  sessionId: Id<'sessions'>,
  userId: Id<'users'>,
) {
  const session = await ctx.db.get(sessionId)
  if (!session || session.userId !== userId) {
    return null
  }

  return session
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

export const listForUser = query({
  handler: async (ctx) => {
    const clerkUserId = await ctx.auth.getUserIdentity()
    if (!clerkUserId) {
      return []
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', clerkUserId.subject),
      )
      .unique()

    if (!user) {
      return []
    }

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_user_and_execution', (q) =>
        q.eq('userId', user._id).eq('execution', 'cloud'),
      )
      .collect()

    return sessions
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((session) => ({
        _id: session._id,
        title: session.title,
        preview: session.preview,
        githubOwner: session.githubOwner,
        githubRepo: session.githubRepo,
        status: session.status,
        providerId: session.providerId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }))
  },
})

export const get = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await ctx.auth.getUserIdentity()
    if (!clerkUserId) {
      return null
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', clerkUserId.subject),
      )
      .unique()

    if (!user) {
      return null
    }

    const session = await requireOwnedSession(ctx, args.sessionId, user._id)
    if (!session) {
      return null
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session_and_seq', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    return {
      session,
      messages: messages.sort((a, b) => a.seq - b.seq),
    }
  },
})

export const create = mutation({
  args: {
    repositoryFullName: v.string(),
    baseBranch: v.string(),
    initialPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const { clerkUserId, userId } = await requireUser(ctx)
    const prompt = args.initialPrompt.trim()
    if (!prompt) {
      throw new Error('Enter a prompt to start a session.')
    }

    const repository = await ctx.db
      .query('githubRepositories')
      .withIndex('by_clerk_user_id_full_name', (q) =>
        q
          .eq('clerkUserId', clerkUserId)
          .eq('fullName', args.repositoryFullName),
      )
      .unique()

    if (!repository) {
      throw new Error('Sync GitHub repositories before starting a session.')
    }

    const { githubOwner, githubRepo } = parseRepositoryFullName(
      args.repositoryFullName,
    )
    const now = Date.now()

    const sessionId = await ctx.db.insert('sessions', {
      userId,
      execution: 'cloud',
      status: 'ready',
      providerId: 'pi',
      githubOwner,
      githubRepo,
      baseBranch: args.baseBranch,
      title: truncate(prompt, TITLE_MAX_LENGTH),
      preview: truncate(prompt, PREVIEW_MAX_LENGTH),
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })

    await ctx.db.insert('messages', {
      sessionId,
      seq: 1,
      role: 'user',
      content: prompt,
      createdAt: now,
    })

    return { sessionId }
  },
})

export const sendMessage = mutation({
  args: {
    sessionId: v.id('sessions'),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const text = args.text.trim()
    if (!text) {
      throw new Error('Message cannot be empty.')
    }

    const session = await requireOwnedSession(ctx, args.sessionId, userId)
    if (!session) {
      throw new Error('Session not found.')
    }

    const now = Date.now()
    const seq = await nextMessageSeq(ctx, args.sessionId)

    await ctx.db.insert('messages', {
      sessionId: args.sessionId,
      seq,
      role: 'user',
      content: text,
      createdAt: now,
    })

    await ctx.db.patch(args.sessionId, {
      preview: truncate(text, PREVIEW_MAX_LENGTH),
      updatedAt: now,
      lastActivityAt: now,
    })

    return { seq }
  },
})
