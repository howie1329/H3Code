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

const repoTriggerClass = cn(
  'h-7 max-w-[14rem] gap-1.5 px-2 text-xs font-normal leading-snug',
  'text-muted-foreground hover:bg-muted hover:text-foreground',
  'aria-expanded:bg-muted aria-expanded:text-foreground',
)

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
        className={cn(repoTriggerClass, className)}
        aria-label="Select repository"
        title={value ? repositories.find((r) => r.id === value)?.name : 'Select repository'}
      >
        <PromptInputSelectValue placeholder="Select repository" />
      </PromptInputSelectTrigger>
      <PromptInputSelectContent align="start" className="text-xs">
        {repositories.map((repo) => (
          <PromptInputSelectItem key={repo.id} value={repo.id} className="text-xs">
            {repo.name}
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  )
}
