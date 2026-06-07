import type { SessionSummary } from '@h3code/agent-core'

export type {
  TranscriptAssistantMessage as MockTranscriptAssistantMessage,
  TranscriptAssistantPart as MockTranscriptAssistantPart,
  TranscriptMessage as MockTranscriptMessage,
  TranscriptSystemMessage as MockTranscriptSystemMessage,
  TranscriptTextPart as MockTranscriptTextPart,
  TranscriptThinkingPart as MockTranscriptThinkingPart,
  TranscriptToolCallPart as MockTranscriptToolCallPart,
  TranscriptToolResultMessage as MockTranscriptToolResultMessage,
  TranscriptUserMessage as MockTranscriptUserMessage,
  WorkspaceRepository as MockRepository,
} from '#/lib/session/types.ts'

import type {
  SessionDetail,
  SidebarSession,
  WorkspaceRepository,
} from '#/lib/session/types.ts'

export type MockSession = SidebarSession

export type MockSessionDetail = SessionDetail

export type MockSessionRecord = {
  session: MockSession
  detail: MockSessionDetail
}

export type { SessionSummary }
