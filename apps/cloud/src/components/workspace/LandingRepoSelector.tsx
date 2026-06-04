'use client'

import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from '#/components/ai-elements/prompt-input.tsx'
import type { DemoRepository } from '#/lib/demo-repositories.ts'
import { cn } from '#/lib/utils.ts'

type LandingRepoSelectorProps = {
  repositories: readonly DemoRepository[]
  value: string | undefined
  onValueChange: (repositoryId: string | undefined) => void
  disabled?: boolean
  className?: string
}

export function LandingRepoSelector({
  repositories,
  value,
  onValueChange,
  disabled = false,
  className,
}: LandingRepoSelectorProps) {
  const hasRepositories = repositories.length > 0

  return (
    <PromptInputSelect
      value={value ?? ''}
      onValueChange={(next) => onValueChange(next || undefined)}
      disabled={disabled || !hasRepositories}
    >
      <PromptInputSelectTrigger
        className={cn('max-w-[14rem]', className)}
        aria-label="Select repository"
        title={value ? repositories.find((r) => r.id === value)?.name : 'Select repository'}
      >
        <PromptInputSelectValue placeholder="Select repository" />
      </PromptInputSelectTrigger>
      <PromptInputSelectContent align="start">
        {repositories.map((repo) => (
          <PromptInputSelectItem key={repo.id} value={repo.id}>
            {repo.name}
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  )
}
