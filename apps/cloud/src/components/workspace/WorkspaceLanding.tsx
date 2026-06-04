'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { Skeleton } from '#/components/ui/skeleton.tsx'
import {
  DEMO_REPOSITORIES,
  getDefaultDemoRepositoryId,
  type DemoRepository,
} from '#/lib/demo-repositories.ts'
import { cn } from '#/lib/utils.ts'

/** Landing-only composer: hairline border, flat canvas (no ghost-card shadow). */
const landingPromptInputClass = cn(
  'w-full',
  '[&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-none',
  'dark:[&_[data-slot=input-group]]:bg-background',
)

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

  const showEnterHint = hasSelectedRepository && !isLoadingWorkspace

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

  function handleAddRepository() {
    // Repository connect flow — wired in a later pass.
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
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10"
      aria-label="Start session"
    >
      <div
        className={cn(
          'relative w-full max-w-2xl',
          'animate-in fade-in-0 slide-in-from-bottom-1 duration-150 motion-reduce:animate-none motion-reduce:opacity-100',
        )}
      >
        <div className="mb-7 text-center">
          <h1 className="text-balance text-xl font-semibold leading-tight text-foreground">
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
                  className="h-7 gap-1.5 text-xs"
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
                  id="workspace-landing-prompt"
                  className="min-h-16 text-xs leading-normal md:text-xs"
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
                  className="size-7 rounded-md p-0 [&_svg]:size-3.5"
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
              <p className="mt-3.5 text-center text-[11px] leading-tight text-muted-foreground">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs bg-muted px-1 font-sans text-[0.625rem] font-medium text-muted-foreground">
                  Enter
                </kbd>
                <span className="px-1">starts session</span>
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
