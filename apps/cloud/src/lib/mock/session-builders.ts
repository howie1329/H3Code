import type { SessionStatus, SessionSummary } from '@h3code/agent-core'

import type {
  MockSession,
  MockSessionDetail,
  MockSessionRecord,
} from '#/lib/mock/types.ts'

export function sessionSummary(input: {
  sessionRef: string
  title: string
  status?: SessionStatus
  preview?: string
  repoPath?: string
  updatedAt?: number
}): SessionSummary {
  const now = input.updatedAt ?? Date.now()
  return {
    providerId: 'pi',
    sessionRef: input.sessionRef,
    status: input.status ?? 'idle',
    title: input.title,
    preview: input.preview,
    repoPath: input.repoPath,
    updatedAt: now,
    createdAt: now - 86_400_000,
  }
}

export function sessionRecord(input: {
  id: string
  repositoryId: string
  title: string
  status?: SessionStatus
  preview?: string
  repoPath?: string
  detail: MockSessionDetail
}): MockSessionRecord {
  const session: MockSession = {
    id: input.id,
    repositoryId: input.repositoryId,
    preview: input.preview,
    summary: sessionSummary({
      sessionRef: input.id,
      title: input.title,
      status: input.status,
      preview: input.preview,
      repoPath: input.repoPath,
    }),
  }

  return { session, detail: input.detail }
}

export function idleDetail(
  messages: MockSessionDetail['messages'],
): MockSessionDetail {
  return {
    messages,
    steering: [],
    followUp: [],
    isStreaming: false,
    isCompacting: false,
  }
}
