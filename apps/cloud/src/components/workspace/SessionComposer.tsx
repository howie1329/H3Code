'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { ArrowUpIcon } from 'lucide-react'

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '#/components/ai-elements/prompt-input.tsx'
import {
  SESSION_COLUMN_INSET_CLASS,
  sessionColumnClass,
  sessionPromptInputClass,
  sessionSubmitClass,
  sessionTextareaClass,
} from '#/components/workspace/session-layout.ts'
import { Kbd } from '#/components/ui/kbd.tsx'
import { cn } from '#/lib/utils.ts'

type SessionComposerProps = {
  sessionTitle?: string
  disabled?: boolean
  isStreaming?: boolean
  onSubmit?: (text: string) => void | Promise<void>
  onStop?: () => void
}

export function SessionComposer({
  sessionTitle,
  disabled = false,
  isStreaming = false,
  onSubmit,
  onStop,
}: SessionComposerProps) {
  const enterHintId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const composerDisabled = disabled || isSubmitting
  const canSubmit = useMemo(
    () => !composerDisabled && !isStreaming && prompt.trim().length > 0,
    [composerDisabled, isStreaming, prompt],
  )

  const placeholder = sessionTitle
    ? `Follow up on ${sessionTitle}…`
    : 'Send a follow-up…'

  const focusComposer = useCallback(() => {
    if (composerDisabled) {
      return
    }

    textareaRef.current?.focus()
  }, [composerDisabled])

  useEffect(() => {
    focusComposer()
  }, [focusComposer])

  async function handleSubmit(
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const text = message.text?.trim() ?? prompt.trim()
    if (!text || composerDisabled || isStreaming) {
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await onSubmit?.(text)
      setPrompt('')
    } catch {
      setErrorMessage('Could not send message. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        'shrink-0 border-t border-border/60 bg-background',
        SESSION_COLUMN_INSET_CLASS,
        'pb-4 pt-3',
      )}
    >
      <div className={sessionColumnClass}>
        {errorMessage ? (
          <p
            className="mb-2 text-[11px] text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {errorMessage}
          </p>
        ) : null}

        <PromptInput
          className={sessionPromptInputClass}
          onSubmit={handleSubmit}
        >
          <PromptInputBody>
            <label htmlFor="session-composer-prompt" className="sr-only">
              Session prompt
            </label>
            <PromptInputTextarea
              ref={textareaRef}
              id="session-composer-prompt"
              className={sessionTextareaClass}
              value={prompt}
              onChange={(event) => setPrompt(event.currentTarget.value)}
              placeholder={placeholder}
              title={isStreaming ? 'Stop generation first' : 'Enter to send'}
              disabled={composerDisabled || isStreaming}
              aria-describedby={enterHintId}
            />
          </PromptInputBody>

          <PromptInputFooter className="gap-1.5">
            <p
              id={enterHintId}
              className="text-[11px] leading-tight text-muted-foreground"
            >
              <Kbd>Enter</Kbd>
              <span className="px-1">to send</span>
            </p>

            <PromptInputSubmit
              className={sessionSubmitClass}
              variant={canSubmit || isStreaming ? 'default' : 'ghost'}
              disabled={!canSubmit && !isStreaming}
              status={
                isStreaming
                  ? 'streaming'
                  : isSubmitting
                    ? 'submitted'
                    : undefined
              }
              onStop={onStop}
              title={isStreaming ? 'Stop' : 'Send'}
            >
              <ArrowUpIcon aria-hidden />
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
