# H3Code Convex Schema

> Status: Draft. Data model for cloud sessions and optional desktop display cache.
>
> Cloud behavior: [h3code-cloud-saas-prd.md](./h3code-cloud-saas-prd.md). Client wiring: [h3code-unified-client.md](./h3code-unified-client.md).

## Principles

1. **Store H3Code protocol shapes only**—messages, runs, capabilities as defined in `@h3code/agent-protocol`, not PI/Codex-native payloads.
2. **Convex is the UI’s source of truth** for subscribed clients. The provider runtime (PI in sandbox or locally) owns **live** conversation context while connected.
3. **Coalesce writes** (~150–250ms) from the adapter; do not persist per-token rows.
4. **Large blobs** (full diffs, huge tool output) may exceed Convex’s per-document size limit (~1 MiB)—store artifact references or chunked rows (see `diffArtifacts` / `messageChunks`).
5. **One sandbox per cloud session.** `sessions.sandboxId` is unique to that session’s Daytona environment. Parallel sessions on the same `githubOwner`/`githubRepo` are isolated by separate sandboxes and separate `workBranch` values; git reconciliation happens on GitHub (PR merge), not via shared sandbox state.

## Execution Modes

```ts
type Execution = "local" | "cloud";
```

| Field | `local` | `cloud` |
|-------|---------|---------|
| Workspace | `repoPath` on disk | `githubOwner`, `githubRepo`, `baseBranch` |
| Agent runs in | User machine (Agent Server) | Daytona sandbox |
| Sandbox | — | One Daytona sandbox per session (`sandboxId`); lifecycle on session row |
| Git remote | User’s own git | Clone via Clerk GitHub token; per-session `workBranch`; PR via API |

Filter session lists by `execution` so desktop does not surface cloud sessions until product enables it.

## Entity Overview

```txt
users (Clerk subject id as key or mapped table)
  └── sessions
        ├── runs
        ├── messages (append-only, coalesced chunks)
        ├── control (steer / abort / openPr intent)
        ├── diffs (summary per run or snapshot)
        └── usageEvents (metering)
```

## Tables (Conceptual)

### `users`

Synced from Clerk webhooks or created on first sign-in.

| Field | Type | Notes |
|-------|------|-------|
| `clerkId` | string | Primary external id |
| `email` | string? | |
| `githubLinked` | boolean | GitHub OAuth via Clerk |
| `createdAt` | number | |

### `sessions`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | id → users | |
| `execution` | `"local" \| "cloud"` | |
| `status` | enum | `provisioning`, `ready`, `hibernating`, `suspended`, `error`, `archived` |
| `providerId` | string | e.g. `"pi"` |
| `providerSessionRef` | string? | Opaque PI session id/path for reconnect |
| `repoPath` | string? | `local` only |
| `githubOwner` | string? | `cloud` |
| `githubRepo` | string? | |
| `baseBranch` | string? | |
| `workBranch` | string? | Session-owned branch (e.g. `h3code/<shortId>`); created at provision for parallel sessions on same repo |
| `sandboxId` | string? | Daytona id; 1:1 with this session |
| `prUrl` | string? | |
| `prNumber` | number? | |
| `title` | string? | User or generated summary |
| `createdAt` | number | |
| `updatedAt` | number | |
| `lastActivityAt` | number | Idle hibernation input |

**Indexes:** `by_user`, `by_user_and_execution`, `by_sandboxId`.

### `runs`

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | id → sessions | |
| `status` | enum | `running`, `completed`, `aborted`, `error` |
| `startedAt` | number | |
| `endedAt` | number? | |
| `errorMessage` | string? | User-safe |

**Indexes:** `by_session`, `by_session_and_status`.

### `messages`

Append-only H3Code-shaped transcript rows. UI subscribes `by_session` ordered by `seq` or `createdAt`.

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | id → sessions | |
| `runId` | id → runs? | |
| `seq` | number | Monotonic per session |
| `role` | enum | `user`, `assistant`, `tool`, `system` |
| `content` | string | Or structured JSON matching agent-protocol |
| `toolCallId` | string? | |
| `toolName` | string? | |
| `isPartial` | boolean | true until chunk flush completes |
| `createdAt` | number | |

**Indexes:** `by_session_and_seq`.

For streaming: adapter may **patch** the latest assistant row during coalesce, or insert new rows per flush—pick one strategy and keep client idempotent.

### `control`

Latest intent for sandbox/local subscriber (steer, abort, openPr).

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | id → sessions | |
| `kind` | enum | `steer`, `abort`, `openPr`, `userMessage` |
| `payload` | any | Prompt text, PR options, etc. |
| `version` | number | Increment so subscriber detects change |
| `createdAt` | number | |

Sandbox holds Convex client subscription on `control` for `sessionId` (or polls via lightweight query).

### `diffs`

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | id → sessions | |
| `runId` | id → runs? | |
| `summary` | object | Paths changed, stats—agent-protocol `WorkspaceDiffSummary` |
| `patch` | string? | Optional; if large, use `artifactId` |
| `artifactId` | id? | → file storage |
| `createdAt` | number | |

### `usageEvents`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | id | |
| `sessionId` | id? | |
| `kind` | enum | `compute_minute`, `input_tokens`, `output_tokens` |
| `quantity` | number | |
| `createdAt` | number | |

Stripe reporting via scheduled action aggregating these rows.

### `pushSubscriptions` (optional)

Web Push endpoint + keys per user/device for run-completed notifications.

## Write Paths

### Cloud (sandbox adapter)

```txt
PI (or provider) event
  → map to agent-protocol
  → debounce buffer
  → mutation: appendMessage / patchMessage
  → optional: upsertDiff after run segment
```

HTTP action or Convex client from sandbox using **deploy key / session-scoped token**—never expose user Clerk token to logs.

### Desktop (optional cache)

Same mutations with `execution: "local"` when mirroring for reload. Local Agent Server may still be canonical for **continue** until provider reconnect completes.

## Read Paths (UI)

| Query | Use |
|-------|-----|
| `sessions.list({ userId, execution? })` | Sidebar |
| `messages.list({ sessionId })` | Transcript (reactive) |
| `runs.getActive({ sessionId })` | Composer disabled state |
| `diffs.latest({ sessionId })` | Diff panel |
| `sessions.get({ sessionId })` | Header, PR link, status |

## Actions (Orchestration)

| Action | Trigger |
|--------|---------|
| `provisionSandbox` | `createSession` (cloud) |
| `suspendSandbox` | idle timeout |
| `resumeSandbox` | user opens hibernated session |
| `destroySandbox` | archive/delete |
| `mintGithubToken` | clone/push (short-lived, from Clerk) |
| `openPullRequest` | user approves Open PR |
| `reportUsage` | cron + run hooks |

## Mutations (User)

| Mutation | Effect |
|----------|--------|
| `createSession` | Insert session, schedule provision |
| `sendMessage` | Insert user message, start run, signal control |
| `abortRun` | control.abort + provider hook |
| `archiveSession` | destroy sandbox, set archived |

## Reconnect Semantics

**Fast reload (read-only):** Query `messages` + `sessions`—no provider required.

**Continue agent:**

1. Load `providerId`, `providerSessionRef`, workspace fields from `sessions`.
2. Cloud: ensure sandbox resumed; local: ensure Agent Server connected.
3. Provider `connect` / `switchSession` with stored ref.
4. If provider state lost and no native resume: replay recent `messages` into provider (lossy) or show read-only history.

Store everything needed for step 1 on the session row at connect time.

## Conflict Policy

| Mode | Policy |
|------|--------|
| Cloud UI | Convex wins for display; adapter is sole writer during run |
| Desktop + PI | While connected, provider events overwrite/extend cache; on reconnect, prefer provider snapshot reconcile or “Convex wins until reconnect completes” (pick one, document in code) |

## Security

- Row-level auth: `userId` on all session-scoped tables; Clerk identity in Convex auth config.
- Sandbox authentication: scoped token per session, minimal lifetime.
- Never store raw GitHub or provider API keys in `messages` or client-readable fields.

## Testing (`convex-test`)

- Session lifecycle transitions (`provisioning` → `ready` → `suspended`).
- Two reactive subscribers see identical message order after concurrent writes.
- Control `version` bump visible to subscriber.
- Message coalescing: N rapid appends → bounded row count per run.

## Related Types

Implement validators alongside tables using shapes from `@h3code/agent-protocol` (`SessionDomainEvent`, `WorkspaceDiffSummary`, `ProviderCapabilities`) to avoid drift.

## Open Questions

- Patch-vs-append strategy for streaming assistant rows.
- Separate `messageChunks` table vs inline `content` growth.
- Retention job for archived sessions and GDPR delete-user cascade.
