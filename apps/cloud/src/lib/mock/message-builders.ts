import type {
  MockTranscriptAssistantMessage,
  MockTranscriptAssistantPart,
  MockTranscriptToolResultMessage,
  MockTranscriptUserMessage,
} from '#/lib/mock/types.ts'

export function userMessage(
  id: string,
  content: string,
): MockTranscriptUserMessage {
  return { id, role: 'user', content }
}

export function assistantMessage(
  id: string,
  content: MockTranscriptAssistantPart[],
): MockTranscriptAssistantMessage {
  return { id, role: 'assistant', content }
}

export function thinking(text: string): MockTranscriptAssistantPart {
  return { type: 'thinking', thinking: text }
}

export function textPart(text: string): MockTranscriptAssistantPart {
  return { type: 'text', text }
}

export function toolCall(
  id: string,
  name: string,
  args: Record<string, unknown>,
): MockTranscriptAssistantPart {
  return { type: 'toolCall', id, name, arguments: args }
}

export function toolResult(
  id: string,
  toolCallId: string,
  toolName: string,
  text: string,
  options?: { isError?: boolean; args?: Record<string, unknown> },
): MockTranscriptToolResultMessage {
  return {
    id,
    role: 'toolResult',
    toolCallId,
    toolName,
    content: [{ type: 'text', text }],
    isError: options?.isError,
    args: options?.args,
  }
}

export function systemMessage(id: string, content: string) {
  return { id, role: 'system' as const, content }
}
