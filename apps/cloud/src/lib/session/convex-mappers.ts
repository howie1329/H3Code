import type { SessionStatus } from '@h3code/agent-core'

import type { Doc } from '../../../convex/_generated/dataModel'
import type {
  ConvexSessionStatus,
  SidebarSession,
  TranscriptMessage,
} from '#/lib/session/types.ts'

export function mapSessionStatus(status: ConvexSessionStatus): SessionStatus {
  switch (status) {
    case 'provisioning':
      return 'waiting'
    case 'ready':
      return 'idle'
    case 'hibernating':
    case 'suspended':
      return 'waiting'
    case 'error':
      return 'error'
    case 'archived':
      return 'archived'
    default:
      return 'idle'
  }
}

export function mapConvexMessageToTranscript(
  message: Doc<'messages'>,
): TranscriptMessage | null {
  switch (message.role) {
    case 'user':
      return {
        id: message._id,
        role: 'user',
        content: message.content,
      }
    case 'system':
      return {
        id: message._id,
        role: 'system',
        content: message.content,
      }
    case 'assistant':
    case 'tool':
      return null
    default:
      return null
  }
}

export function mapConvexMessagesToTranscript(
  messages: readonly Doc<'messages'>[],
): TranscriptMessage[] {
  const transcript: TranscriptMessage[] = []

  for (const message of messages) {
    const mapped = mapConvexMessageToTranscript(message)
    if (mapped) {
      transcript.push(mapped)
    }
  }

  return transcript
}

export function toSidebarSession(
  session: Pick<
    Doc<'sessions'>,
    | '_id'
    | 'title'
    | 'preview'
    | 'githubOwner'
    | 'githubRepo'
    | 'status'
    | 'providerId'
    | 'updatedAt'
    | 'createdAt'
  >,
): SidebarSession | null {
  if (!session.githubOwner || !session.githubRepo) {
    return null
  }

  return {
    id: session._id,
    repositoryId: `${session.githubOwner}/${session.githubRepo}`,
    preview: session.preview,
    summary: {
      providerId: session.providerId,
      sessionRef: session._id,
      status: mapSessionStatus(session.status),
      title: session.title,
      preview: session.preview,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
  }
}

export function repositoryFullName(
  owner: string | undefined,
  repo: string | undefined,
): string | undefined {
  if (!owner || !repo) {
    return undefined
  }

  return `${owner}/${repo}`
}
