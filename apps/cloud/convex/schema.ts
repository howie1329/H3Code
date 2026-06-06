import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

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

  githubRepositories: defineTable({
    clerkUserId: v.string(),
    defaultBranch: v.optional(v.string()),
    fullName: v.string(),
    githubId: v.number(),
    isPrivate: v.boolean(),
    name: v.string(),
    ownerLogin: v.string(),
    pushedAt: v.optional(v.string()),
    syncedAt: v.number(),
    url: v.string(),
  })
    .index('by_clerk_user_id', ['clerkUserId'])
    .index('by_clerk_user_id_full_name', ['clerkUserId', 'fullName']),

  users: defineTable({
    clerkUserId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_clerk_user_id', ['clerkUserId']),
})
