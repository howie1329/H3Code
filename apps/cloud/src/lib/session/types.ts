import type { SessionSummary } from '@h3code/agent-protocol'

export type TranscriptUserMessage = {
  id: string
  role: 'user'
  content: string
}

export type TranscriptThinkingPart = {
  type: 'thinking'
  thinking: string
}

export type TranscriptTextPart = {
  type: 'text'
  text: string
}

export type TranscriptToolCallPart = {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type TranscriptAssistantPart =
  | TranscriptThinkingPart
  | TranscriptTextPart
  | TranscriptToolCallPart

export type TranscriptAssistantMessage = {
  id: string
  role: 'assistant'
  content: TranscriptAssistantPart[]
}

export type TranscriptToolResultMessage = {
  id: string
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
  args?: Record<string, unknown>
}

export type TranscriptSystemMessage = {
  id: string
  role: 'system'
  content: string
}

export type TranscriptMessage =
  | TranscriptUserMessage
  | TranscriptAssistantMessage
  | TranscriptToolResultMessage
  | TranscriptSystemMessage

export type WorkspaceRepository = {
  id: string
  name: string
  owner: string
  defaultBranch: string
  defaultOpen?: boolean
}

export type SidebarSession = {
  id: string
  repositoryId: string
  summary: CloudSessionSummary
  preview?: string
}

export type SessionDetail = {
  messages: readonly TranscriptMessage[]
  steering: readonly string[]
  followUp: readonly string[]
  isStreaming: boolean
  isCompacting: boolean
}

export type ConvexSessionStatus =
  | 'provisioning'
  | 'ready'
  | 'hibernating'
  | 'suspended'
  | 'error'
  | 'archived'

export type CloudSessionDisplayStatus =
  | SessionSummary['status']
  | 'waiting'
  | 'archived'

export type CloudSessionSummary = Omit<SessionSummary, 'status'> & {
  status: CloudSessionDisplayStatus
}
