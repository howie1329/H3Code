import {
  assistantMessage,
  textPart,
  thinking,
  toolCall,
  toolResult,
  userMessage,
} from '#/lib/mock/message-builders.ts'
import { idleDetail, sessionRecord } from '#/lib/mock/session-builders.ts'
import type { MockSessionRecord } from '#/lib/mock/types.ts'

const REPO_ID = 'api-gateway'
const REPO_PATH = '/workspace/api-gateway'

export const API_GATEWAY_SESSIONS: readonly MockSessionRecord[] = [
  sessionRecord({
    id: 'api-rate-limit-research',
    repositoryId: REPO_ID,
    title: 'Research rate limits',
    preview: 'web_search + WebFetch',
    repoPath: REPO_PATH,
    status: 'idle',
    detail: idleDetail([
      userMessage(
        'u1',
        'What rate limits does GitHub apply to the REST API for authenticated users? Summarize for our gateway proxy.',
      ),
      assistantMessage('a1', [
        thinking('Search docs and fetch the rate limit headers page.'),
        textPart('I will search and fetch official GitHub documentation.'),
        toolCall('tc-search', 'web_search', {
          query: 'GitHub REST API rate limit authenticated user 2024',
        }),
      ]),
      toolResult(
        'tr-search',
        'tc-search',
        'web_search',
        'Results:\n1. docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api\n2. github.blog/changelog rate limit updates',
      ),
      assistantMessage('a2', [
        toolCall('tc-fetch', 'WebFetch', {
          url: 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api',
        }),
      ]),
      toolResult(
        'tr-fetch',
        'tc-fetch',
        'WebFetch',
        'Primary rate limit: 5,000 requests/hour per user for OAuth apps. GraphQL has a separate point budget. Search API: 30 requests/minute.',
      ),
      assistantMessage('a3', [
        textPart(
          '**Summary for gateway:** enforce per-user 5k/hr budget on REST upstream; expose `X-RateLimit-Remaining` to clients; throttle search routes at 30/min.',
        ),
      ]),
    ]),
  }),

  sessionRecord({
    id: 'api-migration',
    repositoryId: REPO_ID,
    title: 'Add users table migration',
    preview: 'bash migrate + read schema',
    repoPath: REPO_PATH,
    status: 'idle',
    detail: idleDetail([
      userMessage(
        'u1',
        'Add a users table migration with email, clerk_id, and created_at. Run migrate locally.',
      ),
      assistantMessage('a1', [
        thinking('Read existing migrations for naming convention.'),
        toolCall('tc-read-migrations', 'read', {
          path: 'migrations/',
        }),
      ]),
      toolResult(
        'tr-read-migrations',
        'tc-read-migrations',
        'read',
        '001_init.sql\n002_sessions.sql',
      ),
      assistantMessage('a2', [
        toolCall('tc-write-migration', 'write', {
          path: 'migrations/003_users.sql',
        }),
      ]),
      toolResult(
        'tr-write-migration',
        'tc-write-migration',
        'write',
        'CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email TEXT NOT NULL,\n  clerk_id TEXT UNIQUE,\n  created_at TIMESTAMPTZ DEFAULT now()\n);',
      ),
      assistantMessage('a3', [
        toolCall('tc-bash-migrate', 'bash', {
          command: 'npm run db:migrate',
        }),
      ]),
      toolResult(
        'tr-bash-migrate',
        'tc-bash-migrate',
        'bash',
        'Applying 003_users.sql ... OK\nMigrations complete (3 applied).',
      ),
      assistantMessage('a4', [
        toolCall('tc-read-schema', 'read', {
          path: 'src/db/schema.ts',
        }),
      ]),
      toolResult(
        'tr-read-schema',
        'tc-read-schema',
        'read',
        'export const users = pgTable("users", { id, email, clerkId, createdAt })',
      ),
      assistantMessage('a5', [
        textPart(
          'Migration applied. Schema types updated. You can seed a test user in the next step.',
        ),
      ]),
    ]),
  }),

  sessionRecord({
    id: 'api-auth-bug',
    repositoryId: REPO_ID,
    title: 'Fix 401 on /sessions',
    preview: 'Failed read — invalid token',
    repoPath: REPO_PATH,
    status: 'error',
    detail: idleDetail([
      userMessage(
        'u1',
        'GET /sessions returns 401 after Clerk sign-in. Find why.',
      ),
      assistantMessage('a1', [
        thinking('Reproduce with curl and inspect auth middleware.'),
        toolCall('tc-bash-curl', 'bash', {
          command:
            'curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/sessions',
        }),
      ]),
      toolResult('tr-bash-curl', 'tc-bash-curl', 'bash', '401'),
      assistantMessage('a2', [
        toolCall('tc-read-auth', 'read', {
          path: 'src/middleware/auth.ts',
        }),
      ]),
      toolResult(
        'tr-read-auth',
        'tc-read-auth',
        'read',
        'const token = req.headers.authorization?.replace("Bearer ", "")\nif (!token) return 401',
      ),
      assistantMessage('a3', [
        toolCall('tc-grep-clerk', 'grep', {
          pattern: 'getToken|Authorization',
          path: 'apps/cloud/src',
        }),
      ]),
      toolResult(
        'tr-grep-clerk',
        'tc-grep-clerk',
        'grep',
        'No matches in cloud client fetch wrapper.',
        { isError: false },
      ),
      assistantMessage('a4', [
        toolCall('tc-read-fetch', 'read', {
          path: 'src/client/api.ts',
        }),
      ]),
      toolResult(
        'tr-read-fetch',
        'tc-read-fetch',
        'read',
        'fetch("/sessions") // missing Clerk session token',
        { isError: true, args: { path: 'src/client/api.ts' } },
      ),
      assistantMessage('a5', [
        textPart(
          'The API client never attaches the Clerk JWT. I can patch `api.ts` to call `getToken()` and set `Authorization: Bearer …` on session routes.',
        ),
      ]),
    ]),
  }),
]
