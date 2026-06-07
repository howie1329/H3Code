'use client'

import { useMemo } from 'react'

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '#/components/ai-elements/conversation.tsx'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '#/components/ai-elements/message.tsx'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '#/components/ai-elements/reasoning.tsx'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '#/components/ai-elements/tool.tsx'
import {
  SESSION_COLUMN_INSET_CLASS,
  sessionColumnClass,
} from '#/components/workspace/session-layout.ts'
import {
  buildToolResultIndex,
  toolCallTitle,
  toolResultText,
} from '#/lib/session/transcript-model.ts'
import type {
  MockTranscriptMessage,
  MockTranscriptToolResultMessage,
} from '#/lib/mock/types.ts'
import { cn } from '#/lib/utils.ts'

type SessionTranscriptProps = {
  messages: readonly MockTranscriptMessage[]
  isStreaming?: boolean
  isCompacting?: boolean
}

export function SessionTranscript({
  messages,
  isStreaming = false,
  isCompacting = false,
}: SessionTranscriptProps) {
  const toolResults = useMemo(() => buildToolResultIndex(messages), [messages])
  const hasMessages = messages.length > 0

  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent
        className={cn(
          'gap-6 py-4',
          SESSION_COLUMN_INSET_CLASS,
          sessionColumnClass,
        )}
      >
        {isCompacting ? (
          <p
            className="text-center text-[11px] text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Compacting transcript…
          </p>
        ) : null}

        {!hasMessages ? (
          <ConversationEmptyState
            className="min-h-[12rem]"
            title="Transcript is empty"
            description="Send a prompt from the composer below."
          />
        ) : (
          messages.map((message) => (
            <SessionTranscriptItem
              key={message.id}
              message={message}
              toolResults={toolResults}
            />
          ))
        )}

        {isStreaming ? (
          <div className={sessionColumnClass}>
            <Reasoning isStreaming defaultOpen>
              <ReasoningTrigger />
            </Reasoning>
          </div>
        ) : null}
      </ConversationContent>

      <ConversationScrollButton />
    </Conversation>
  )
}

function SessionTranscriptItem({
  message,
  toolResults,
}: {
  message: MockTranscriptMessage
  toolResults: ReadonlyMap<string, MockTranscriptToolResultMessage>
}) {
  if (message.role === 'toolResult') {
    return null
  }

  if (message.role === 'system') {
    return (
      <p className="text-center text-[11px] leading-snug text-muted-foreground">
        {message.content}
      </p>
    )
  }

  if (message.role === 'user') {
    return (
      <Message from="user" className="max-w-full">
        <MessageContent className="ml-auto max-w-[min(36rem,78%)] rounded-md bg-accent/40 px-2.5 py-1.5">
          <p className="whitespace-pre-wrap text-[13px] leading-snug">
            {message.content}
          </p>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent className="w-full max-w-full gap-3 overflow-visible">
        {message.content.map((part, index) => {
          if (part.type === 'thinking') {
            return (
              <Reasoning
                key={`${message.id}-thinking-${index}`}
                defaultOpen={false}
              >
                <ReasoningTrigger />
                <ReasoningContent>{part.thinking}</ReasoningContent>
              </Reasoning>
            )
          }

          if (part.type === 'text') {
            return (
              <MessageResponse
                key={`${message.id}-text-${index}`}
                className="text-[13px] leading-snug"
              >
                {part.text}
              </MessageResponse>
            )
          }

          const result = toolResults.get(part.id)
          const output = result ? toolResultText(result) : undefined

          return (
            <Tool key={part.id} defaultOpen={false} className="mb-0">
              <ToolHeader
                type="dynamic-tool"
                state={output ? 'output-available' : 'input-available'}
                toolName={part.name}
                title={toolCallTitle(part.name, part.arguments)}
              />
              <ToolContent>
                <ToolInput input={part.arguments} />
                {output ? (
                  <ToolOutput
                    output={output}
                    errorText={result?.isError ? output : undefined}
                  />
                ) : null}
              </ToolContent>
            </Tool>
          )
        })}
      </MessageContent>
    </Message>
  )
}
