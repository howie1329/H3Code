'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircleIcon, ArrowUpIcon } from 'lucide-react'

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
import { Alert, AlertDescription } from '#/components/ui/alert.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import {
  DEMO_REPOSITORIES,
  getDefaultDemoRepositoryId,
  type DemoRepository,
} from '#/lib/demo-repositories.ts'
import { cn } from '#/lib/utils.ts'

type WorkspaceLandingProps = {
  /** When true, shows a composer-shaped skeleton (preferences / workspace bootstrap). */
  isLoadingWorkspace?: boolean
  repositories?: readonly DemoRepository[]
}

export function WorkspaceLanding({
  isLoadingWorkspace = false,
  repositories = DEMO_REPOSITORIES,
}: WorkspaceLandingProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | undefined>(
    () => getDefaultDemoRepositoryId(repositories),
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

    const textarea = document.getElementById('workspace-landing-prompt')
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus()
    }
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

      return getDefaultDemoRepositoryId(repositories)
    })
  }, [hasRepositories, repositories])

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
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10"
      aria-label="Start session"
    >
      <div
        className={cn(
          'relative w-full max-w-xl',
          'animate-in fade-in-0 slide-in-from-bottom-1 duration-150 motion-reduce:animate-none motion-reduce:opacity-100',
        )}
      >
        {errorMessage ? (
          <Alert
            variant="destructive"
            className="mb-3 border-destructive/30 bg-destructive/5 px-3 py-2 text-xs [&>svg]:size-3"
          >
            <AlertCircleIcon />
            <AlertDescription className="text-destructive">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {isLoadingWorkspace ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading workspace">
            <Skeleton className="h-[7.5rem] w-full rounded-md" />
          </div>
        ) : (
          <PromptInput
            className="w-full"
            onSubmit={handleSubmit}
          >
            <PromptInputBody>
              <label htmlFor="workspace-landing-prompt" className="sr-only">
                Prompt
              </label>
              <PromptInputTextarea
                id="workspace-landing-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                placeholder={placeholder}
                title="Enter to start session and send"
                disabled={composerDisabled}
              />
            </PromptInputBody>

            <PromptInputFooter>
              <PromptInputTools>
                <LandingRepoSelector
                  repositories={repositories}
                  value={selectedRepositoryId}
                  onValueChange={setSelectedRepositoryId}
                  disabled={isSubmitting || isLoadingWorkspace || !hasRepositories}
                />
              </PromptInputTools>

              <PromptInputSubmit
                variant={canSubmit ? 'default' : 'ghost'}
                disabled={!canSubmit}
                status={isSubmitting ? 'submitted' : undefined}
                title="Start session"
              >
                <ArrowUpIcon className="size-3.5" />
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
        )}
      </div>
    </main>
  )
}
