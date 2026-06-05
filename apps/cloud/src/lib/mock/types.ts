import type { SessionSnapshot, SessionSummary } from '@h3code/agent-core'

/**
 * PI-compatible transcript rows stored in `SessionSnapshot.messages`.
 * Matches desktop `transcript-normalize` expectations.
 */
export type MockTranscriptUserMessage = {
  id: string
  role: 'user'
  content: string
}

export type MockTranscriptThinkingPart = {
  type: 'thinking'
  thinking: string
}

export type MockTranscriptTextPart = {
  type: 'text'
  text: string
}

export type MockTranscriptToolCallPart = {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type MockTranscriptAssistantPart =
  | MockTranscriptThinkingPart
  | MockTranscriptTextPart
  | MockTranscriptToolCallPart

export type MockTranscriptAssistantMessage = {
  id: string
  role: 'assistant'
  content: MockTranscriptAssistantPart[]
}

export type MockTranscriptToolResultMessage = {
  id: string
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
  args?: Record<string, unknown>
}

export type MockTranscriptSystemMessage = {
  id: string
  role: 'system'
  content: string
}

export type MockTranscriptMessage =
  | MockTranscriptUserMessage
  | MockTranscriptAssistantMessage
  | MockTranscriptToolResultMessage
  | MockTranscriptSystemMessage

export type MockRepository = {
  id: string
  name: string
  owner: string
  defaultBranch: string
  defaultOpen?: boolean
}

export type MockSession = {
  id: string
  repositoryId: string
  summary: SessionSummary
  preview?: string
}

export type MockSessionDetail = Pick<
  SessionSnapshot,
  'messages' | 'steering' | 'followUp' | 'isStreaming' | 'isCompacting'
>

export type MockSessionRecord = {
  session: MockSession
  detail: MockSessionDetail
}
