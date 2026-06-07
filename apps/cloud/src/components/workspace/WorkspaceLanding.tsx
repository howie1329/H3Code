'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircleIcon, ArrowUpIcon, FolderPlusIcon } from 'lucide-react'

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '#/components/ai-elements/prompt-input.tsx'
import { LandingRepoSelector } from '#/components/workspace/LandingRepoSelector.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Kbd } from '#/components/ui/kbd.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import {
  getDefaultMockRepositoryId,
  listMockRepositories,
} from '#/lib/mock/index.ts'
import type { MockRepository } from '#/lib/mock/types.ts'
import { cn } from '#/lib/utils.ts'

const landingStackClass = cn(
  'relative w-full max-w-2xl',
  'animate-in fade-in-0 slide-in-from-bottom-1 duration-150 ease-out motion-reduce:animate-none motion-reduce:opacity-100',
)

/** Landing-only composer: hairline border, flat canvas, operator focus ring. */
const landingPromptInputClass = cn(
  'w-full',
  '[&_[data-slot=input-group]]:rounded-md [&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-none',
  'dark:[&_[data-slot=input-group]]:bg-background',
  '[&_[data-slot=input-group]:has([data-slot=input-group-control]:focus-visible)]:ring-2',
  '[&_[data-slot=input-group]:has([data-slot=input-group-control]:focus-visible)]:ring-ring/30',
  '[&_[data-slot=input-group]:has([data-slot=input-group-control]:disabled)]:opacity-60',
)

const landingTextareaClass = cn(
  'min-h-16 px-3 py-2.5 text-xs leading-normal text-foreground md:text-xs',
  'placeholder:text-foreground/55',
)

const landingSubmitClass = cn(
  'size-7 rounded-md p-0 active:translate-y-px',
  'focus-visible:ring-2 focus-visible:ring-ring/30',
  '[&_svg]:size-3.5',
)

type WorkspaceLandingProps = {
  /** When true, shows a composer-shaped skeleton (preferences / workspace bootstrap). */
  isLoadingWorkspace?: boolean
  /** Pre-select a repository from navigation (e.g. sidebar new-session link). */
  initialRepositoryId?: string
  repositories?: readonly MockRepository[]
}

export function WorkspaceLanding({
  isLoadingWorkspace = false,
  initialRepositoryId,
  repositories = listMockRepositories(),
}: WorkspaceLandingProps) {
  const navigate = useNavigate()
  const enterHintId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | undefined>(
    () => getDefaultMockRepositoryId(repositories),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const hasRepositories = repositories.length > 0
  const hasSelectedRepository = Boolean(selectedRepositoryId)
  const selectedRepository = useMemo(
    () => repositories.find((repo) => repo.id === selectedRepositoryId),
    [repositories, selectedRepositoryId],
  )

  const composerDisabled = useMemo(
    () =>
      isLoadingWorkspace ||
      !hasRepositories ||
      !hasSelectedRepository ||
      isSubmitting,
    [hasRepositories, hasSelectedRepository, isLoadingWorkspace, isSubmitting],
  )

  const canSubmit = useMemo(
    () => !composerDisabled && prompt.trim().length > 0,
    [composerDisabled, prompt],
  )

  const showEnterHint = hasSelectedRepository && !isLoadingWorkspace && hasRepositories

  const placeholder = useMemo(() => {
    if (isLoadingWorkspace) {
      return 'Loading…'
    }

    if (!hasRepositories) {
      return 'Add a repository to start…'
    }

    if (!hasSelectedRepository) {
      return 'Select a repository to continue…'
    }

    return `Ask Pi about ${selectedRepository?.name ?? 'this repo'}…`
  }, [
    hasRepositories,
    hasSelectedRepository,
    isLoadingWorkspace,
    selectedRepository?.name,
  ])

  const focusComposerWhenReady = useCallback(() => {
    if (composerDisabled || isLoadingWorkspace) {
      return
    }

    textareaRef.current?.focus()
  }, [composerDisabled, isLoadingWorkspace])

  useEffect(() => {
    focusComposerWhenReady()
  }, [focusComposerWhenReady, hasSelectedRepository, isLoadingWorkspace])

  useEffect(() => {
    if (!hasRepositories) {
      setSelectedRepositoryId(undefined)
      return
    }

    setSelectedRepositoryId((current) => {
      if (current && repositories.some((repo) => repo.id === current)) {
        return current
      }

      return getDefaultMockRepositoryId(repositories)
    })
  }, [hasRepositories, repositories])

  useEffect(() => {
    if (!initialRepositoryId || !hasRepositories) {
      return
    }

    if (repositories.some((repo) => repo.id === initialRepositoryId)) {
      setSelectedRepositoryId(initialRepositoryId)
    }
  }, [hasRepositories, initialRepositoryId, repositories])

  function handleAddRepository() {
    void navigate({ to: '/app' })
  }

  async function handleSubmit(message: PromptInputMessage, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = message.text?.trim() ?? prompt.trim()
    if (!selectedRepositoryId || !text || isSubmitting || composerDisabled) {
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      // Session create + navigation — wired in a later pass.
      await new Promise((resolve) => setTimeout(resolve, 400))
      setPrompt('')
    } catch {
      setErrorMessage('Could not start session. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6"
      aria-label="Start session"
    >
      <div className={landingStackClass}>
        <div className="mb-7 text-center">
          <h1 className="text-balance text-xl font-semibold leading-tight tracking-tight text-foreground">
            What should Pi work on?
          </h1>
        </div>

        {errorMessage ? (
          <div
            className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircleIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {isLoadingWorkspace ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading workspace">
            <Skeleton className="h-[7.5rem] w-full rounded-lg" />
            <Skeleton className="mx-auto h-3 w-32 rounded-md" />
          </div>
        ) : (
          <>
            {!hasRepositories ? (
              <div className="mb-5 flex flex-col items-center gap-2 text-center">
                <Button
                  type="button"
                  className="h-7 gap-1.5 text-xs active:translate-y-px"
                  disabled={isSubmitting}
                  onClick={handleAddRepository}
                >
                  <FolderPlusIcon className="size-3.5" aria-hidden />
                  Add repository…
                </Button>
                <p className="max-w-sm text-[11px] leading-snug text-muted-foreground">
                  Choose a repository for Pi to work in.
                </p>
              </div>
            ) : null}

            <PromptInput className={landingPromptInputClass} onSubmit={handleSubmit}>
              <PromptInputBody>
                <label htmlFor="workspace-landing-prompt" className="sr-only">
                  Prompt
                </label>
                <PromptInputTextarea
                  ref={textareaRef}
                  id="workspace-landing-prompt"
                  className={landingTextareaClass}
                  value={prompt}
                  onChange={(event) => setPrompt(event.currentTarget.value)}
                  placeholder={placeholder}
                  title="Enter to start session and send"
                  disabled={composerDisabled}
                  aria-describedby={showEnterHint ? enterHintId : undefined}
                />
              </PromptInputBody>

              <PromptInputFooter className="gap-1.5">
                <PromptInputTools>
                  <LandingRepoSelector
                    repositories={repositories}
                    value={selectedRepositoryId}
                    onValueChange={setSelectedRepositoryId}
                    disabled={isSubmitting || isLoadingWorkspace || !hasRepositories}
                  />
                </PromptInputTools>

                <PromptInputSubmit
                  className={landingSubmitClass}
                  variant={canSubmit ? 'default' : 'ghost'}
                  disabled={!canSubmit}
                  status={isSubmitting ? 'submitted' : undefined}
                  title="Start session"
                >
                  <ArrowUpIcon aria-hidden />
                </PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>

            {showEnterHint ? (
              <p
                id={enterHintId}
                className="mt-3.5 text-center text-[11px] leading-tight text-muted-foreground"
              >
                <Kbd>Enter</Kbd>
                <span className="px-1">starts session</span>
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
