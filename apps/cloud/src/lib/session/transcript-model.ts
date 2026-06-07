import type {
  MockTranscriptMessage,
  MockTranscriptToolResultMessage,
} from '#/lib/mock/types.ts'

export function buildToolResultIndex(
  messages: readonly MockTranscriptMessage[],
): ReadonlyMap<string, MockTranscriptToolResultMessage> {
  const index = new Map<string, MockTranscriptToolResultMessage>()

  for (const message of messages) {
    if (message.role === 'toolResult') {
      index.set(message.toolCallId, message)
    }
  }

  return index
}

export function toolCallTitle(
  name: string,
  args: Record<string, unknown>,
): string {
  const path = args.path
  if (typeof path === 'string' && path.length > 0) {
    return `${name} · ${path}`
  }

  const pattern = args.pattern
  if (typeof pattern === 'string' && pattern.length > 0) {
    return `${name} · ${pattern}`
  }

  return name
}

export function toolResultText(
  result: MockTranscriptToolResultMessage,
): string {
  return result.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}
