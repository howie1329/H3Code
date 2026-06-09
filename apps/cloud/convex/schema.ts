import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const sessionExecution = v.union(v.literal('local'), v.literal('cloud'))

const sessionStatus = v.union(
  v.literal('provisioning'),
  v.literal('ready'),
  v.literal('hibernating'),
  v.literal('suspended'),
  v.literal('error'),
  v.literal('archived'),
)

const messageRole = v.union(
  v.literal('user'),
  v.literal('assistant'),
  v.literal('tool'),
  v.literal('system'),
)

export default defineSchema({
  githubConnections: defineTable({
    clerkUserId: v.string(),
    errorMessage: v.optional(v.string()),
    githubAccountId: v.optional(v.string()),
    githubLogin: v.optional(v.string()),
    scopes: v.array(v.string()),
    status: v.union(
      v.literal('connected'),
      v.literal('missing_scopes'),
      v.literal('token_unavailable'),
    ),
    updatedAt: v.number(),
  }).index('by_clerk_user_id', ['clerkUserId']),

  users: defineTable({
    clerkUserId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_clerk_user_id', ['clerkUserId']),

  sessions: defineTable({
    userId: v.id('users'),
    execution: sessionExecution,
    status: sessionStatus,
    providerId: v.string(),
    githubOwner: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    title: v.optional(v.string()),
    preview: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    provisionError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastActivityAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_execution', ['userId', 'execution'])
    .index('by_user_and_repo', ['userId', 'githubOwner', 'githubRepo'])
    .index('by_sandboxId', ['sandboxId']),

  messages: defineTable({
    sessionId: v.id('sessions'),
    seq: v.number(),
    role: messageRole,
    content: v.string(),
    createdAt: v.number(),
  }).index('by_session_and_seq', ['sessionId', 'seq']),

  workspaceRepositories: defineTable({
    userId: v.id('users'),
    fullName: v.string(),
    name: v.string(),
    ownerLogin: v.string(),
    defaultBranch: v.string(),
    githubId: v.number(),
    isPrivate: v.boolean(),
    url: v.string(),
    sortOrder: v.number(),
    addedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_full_name', ['userId', 'fullName']),
})
