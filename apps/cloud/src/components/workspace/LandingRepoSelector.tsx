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

/** Matches AppSidebar menu rows (h-7, 12px label). */
const repoTriggerClass = cn(
  'h-7 max-w-[16rem] gap-1.5 px-2 text-[12px] font-normal leading-snug shadow-none',
  'text-foreground data-[placeholder]:text-muted-foreground',
  'hover:bg-muted hover:text-foreground',
  'aria-expanded:bg-muted',
  'focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-50',
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
  const selectedName = value ? repositories.find((r) => r.id === value)?.name : undefined

  return (
    <PromptInputSelect
      value={value ?? ''}
      onValueChange={(next) => onValueChange(next || undefined)}
      disabled={disabled || !hasRepositories}
    >
      <PromptInputSelectTrigger
        className={cn(repoTriggerClass, className)}
        aria-label="Select repository"
        title={selectedName ?? 'Select repository'}
      >
        <PromptInputSelectValue placeholder="Select repository" />
      </PromptInputSelectTrigger>
      <PromptInputSelectContent align="start" className="min-w-[12rem] text-xs">
        {repositories.map((repo) => (
          <PromptInputSelectItem
            key={repo.id}
            value={repo.id}
            className="h-7 text-xs leading-snug"
          >
            {repo.name}
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  )
}
