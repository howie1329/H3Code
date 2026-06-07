import type { MockTranscriptMessage } from '#/lib/mock/types.ts'

const DIFF_TOOL_NAMES = new Set([
  'StrReplace',
  'write',
  'search_replace',
  'edit',
  'apply_patch',
])

export function sessionHasDiff(
  messages: readonly MockTranscriptMessage[],
): boolean {
  return collectSessionChangedPaths(messages).length > 0
}

export function collectSessionChangedPaths(
  messages: readonly MockTranscriptMessage[],
): string[] {
  const paths = new Set<string>()

  for (const message of messages) {
    if (message.role !== 'assistant') {
      continue
    }

    for (const part of message.content) {
      if (part.type !== 'toolCall' || !DIFF_TOOL_NAMES.has(part.name)) {
        continue
      }

      const path = part.arguments.path
      if (typeof path === 'string' && path.length > 0) {
        paths.add(path)
      }
    }
  }

  return [...paths]
}
