import { API_GATEWAY_SESSIONS } from '#/lib/mock/sessions/api-gateway.ts'
import { DESIGN_SYSTEM_SESSIONS } from '#/lib/mock/sessions/design-system.ts'
import { H3CODE_CLOUD_SESSIONS } from '#/lib/mock/sessions/h3code-cloud.ts'
import type {
  MockRepository,
  MockSession,
  MockSessionDetail,
  MockSessionRecord,
} from '#/lib/mock/types.ts'

export const MOCK_REPOSITORIES: readonly MockRepository[] = [
  {
    id: 'h3code-cloud',
    name: 'h3code-cloud',
    owner: 'h3code',
    defaultBranch: 'main',
    defaultOpen: true,
  },
  {
    id: 'api-gateway',
    name: 'api-gateway',
    owner: 'h3code',
    defaultBranch: 'main',
    defaultOpen: false,
  },
  {
    id: 'design-system',
    name: 'design-system',
    owner: 'h3code',
    defaultBranch: 'main',
    defaultOpen: false,
  },
] as const

const ALL_SESSION_RECORDS: readonly MockSessionRecord[] = [
  ...H3CODE_CLOUD_SESSIONS,
  ...API_GATEWAY_SESSIONS,
  ...DESIGN_SYSTEM_SESSIONS,
]

const sessionById = new Map<string, MockSessionRecord>(
  ALL_SESSION_RECORDS.map((record) => [record.session.id, record]),
)

const sessionsByRepositoryId = new Map<string, MockSession[]>()

for (const record of ALL_SESSION_RECORDS) {
  const { repositoryId } = record.session
  const existing = sessionsByRepositoryId.get(repositoryId) ?? []
  existing.push(record.session)
  sessionsByRepositoryId.set(repositoryId, existing)
}

export function listMockRepositories(): readonly MockRepository[] {
  return MOCK_REPOSITORIES
}

export function getDefaultMockRepositoryId(
  repos: readonly MockRepository[] = MOCK_REPOSITORIES,
): string | undefined {
  if (repos.length === 0) {
    return undefined
  }

  return repos.find((repo) => repo.defaultOpen)?.id ?? repos[0]?.id
}

export function listMockSessions(repositoryId: string): readonly MockSession[] {
  return sessionsByRepositoryId.get(repositoryId) ?? []
}

export function getMockSession(sessionId: string): MockSession | undefined {
  return sessionById.get(sessionId)?.session
}

export function getMockSessionDetail(
  sessionId: string,
): MockSessionDetail | undefined {
  return sessionById.get(sessionId)?.detail
}
