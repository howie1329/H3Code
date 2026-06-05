import {
  assistantMessage,
  systemMessage,
  textPart,
  thinking,
  toolCall,
  toolResult,
  userMessage,
} from '#/lib/mock/message-builders.ts'
import { idleDetail, sessionRecord } from '#/lib/mock/session-builders.ts'
import type { MockSessionRecord } from '#/lib/mock/types.ts'

const REPO_ID = 'h3code-cloud'
const REPO_PATH = '/workspace/h3code-cloud'

export const H3CODE_CLOUD_SESSIONS: readonly MockSessionRecord[] = [
  sessionRecord({
    id: 'cloud-sidebar-active',
    repositoryId: REPO_ID,
    title: 'Fix sidebar active route',
    preview: 'grep + StrReplace on AppSidebar',
    repoPath: REPO_PATH,
    status: 'idle',
    detail: idleDetail([
      userMessage(
        'u1',
        'The sidebar session link does not show an active state when I am on /app/sessions/:id. Fix it.',
      ),
      assistantMessage('a1', [
        thinking(
          'I need to read AppSidebar and see how session links set isActive.',
        ),
        textPart(
          'I will inspect the sidebar and match the active route against the current session id.',
        ),
        toolCall('tc-read-sidebar', 'read', {
          path: 'apps/cloud/src/components/app-shell/AppSidebar.tsx',
        }),
      ]),
      toolResult(
        'tr-read-sidebar',
        'tc-read-sidebar',
        'read',
        'export function AppSidebar() {\n  const repositories = listMockRepositories()\n  ...\n}',
      ),
      assistantMessage('a2', [
        toolCall('tc-grep-active', 'grep', {
          pattern: 'isActive|useParams',
          path: 'apps/cloud/src',
        }),
      ]),
      toolResult(
        'tr-grep-active',
        'tc-grep-active',
        'grep',
        'AppSidebar.tsx: useRouterState\n$sessionId.tsx: Route.useParams',
      ),
      assistantMessage('a3', [
        toolCall('tc-strreplace', 'StrReplace', {
          path: 'apps/cloud/src/components/app-shell/AppSidebar.tsx',
          old_string: 'RepositoryCollapsible({',
          new_string: 'RepositoryCollapsible({ sessions,',
        }),
      ]),
      toolResult(
        'tr-strreplace',
        'tc-strreplace',
        'StrReplace',
        '1 file updated.',
      ),
      assistantMessage('a4', [
        textPart(
          'Session rows now use `useRouterState` to mark the active link when `sessionId` matches the URL. Ready for you to verify in the sidebar.',
        ),
      ]),
    ]),
  }),

  sessionRecord({
    id: 'cloud-session-mocks',
    repositoryId: REPO_ID,
    title: 'Add mock fixtures',
    preview: 'Plan: mock catalog under lib/mock',
    repoPath: REPO_PATH,
    status: 'idle',
    detail: idleDetail([
      userMessage(
        'u1',
        'Add static mock repositories and sessions so we can build the session UI without Convex.',
      ),
      assistantMessage('a1', [
        thinking(
          'Plan:\n1. Add types from agent-core\n2. Create lib/mock with 3 repos × 3 sessions\n3. Wire sidebar links only',
        ),
        textPart(
          '## Plan\n\n1. **Types** — `MockRepository`, `MockSession`, `MockSessionDetail` using `SessionSummary`.\n2. **Catalog** — getters `listMockRepositories`, `getMockSessionDetail`.\n3. **Sidebar** — list sessions per repo; no transcript UI yet.',
        ),
        toolCall('tc-write-types', 'write', {
          path: 'apps/cloud/src/lib/mock/types.ts',
        }),
      ]),
      toolResult(
        'tr-write-types',
        'tc-write-types',
        'write',
        'Wrote types.ts (MockRepository, MockSession, MockSessionDetail).',
      ),
      assistantMessage('a2', [
        toolCall('tc-write-catalog', 'write', {
          path: 'apps/cloud/src/lib/mock/catalog.ts',
        }),
      ]),
      toolResult(
        'tr-write-catalog',
        'tc-write-catalog',
        'write',
        'Wrote catalog with 9 sessions across h3code-cloud, api-gateway, design-system.',
      ),
      assistantMessage('a3', [
        textPart(
          'Mock catalog is in place. Next pass can render transcripts from `getMockSessionDetail`.',
        ),
      ]),
    ]),
  }),

  sessionRecord({
    id: 'cloud-transcript-streaming',
    repositoryId: REPO_ID,
    title: 'Polish transcript layout',
    preview: 'Thinking + read, grep, bash tools',
    repoPath: REPO_PATH,
    status: 'running',
    detail: {
      messages: [
        userMessage(
          'u1',
          'Polish the transcript layout: thinking blocks, tool cards, and streaming partial text.',
        ),
        assistantMessage('a1', [
          thinking(
            'Check existing ai-elements: Message, Tool, ChainOfThought, Plan.',
          ),
          textPart(
            'I will prototype layout using mock messages with multiple tool types.',
          ),
          toolCall('tc-read-message', 'read', {
            path: 'apps/cloud/src/components/ai-elements/message.tsx',
          }),
          toolCall('tc-read-tool', 'read', {
            path: 'apps/cloud/src/components/ai-elements/tool.tsx',
          }),
        ]),
        toolResult(
          'tr-read-message',
          'tc-read-message',
          'read',
          'export const Message = ({ from, ... }) => ...',
        ),
        toolResult(
          'tr-read-tool',
          'tc-read-tool',
          'read',
          'export const Tool = ({ ... }) => Collapsible tool card',
        ),
        assistantMessage('a2', [
          toolCall('tc-grep-streamdown', 'grep', {
            pattern: 'Streamdown',
            path: 'apps/cloud/src/components/ai-elements',
          }),
        ]),
        toolResult(
          'tr-grep-streamdown',
          'tc-grep-streamdown',
          'grep',
          'message.tsx: Streamdown for assistant text',
        ),
        assistantMessage('a3', [
          thinking(
            'Group thinking + tools into work blocks when we add the adapter.',
          ),
          textPart(
            'Streaming partial row: layout should tolerate `isPartial` on the last assistant message…',
          ),
        ]),
        systemMessage(
          'sys1',
          'Context compaction skipped — transcript within token budget.',
        ),
      ],
      steering: [],
      followUp: [],
      isStreaming: true,
      isCompacting: false,
    },
  }),
]
