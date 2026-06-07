'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Loader2Icon } from 'lucide-react'

import { api } from '../../../convex/_generated/api'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import type { GitHubRepository } from '#/integrations/github/server.ts'
import { listGitHubRepositoriesForPicker } from '#/integrations/github/server.ts'

type AddRepositoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddRepositoryDialog({
  open,
  onOpenChange,
}: AddRepositoryDialogProps) {
  const workspaceRepos = useQuery(api.workspaceRepositories.list) ?? []
  const addRepository = useMutation(api.workspaceRepositories.add)
  const loadRepositories = useServerFn(listGitHubRepositoriesForPicker)

  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pickerStatus, setPickerStatus] = useState<
    'connected' | 'missing_scopes' | 'token_unavailable' | null
  >(null)
  const [catalog, setCatalog] = useState<GitHubRepository[]>([])
  const [isAdding, setIsAdding] = useState<string | null>(null)

  const workspaceFullNames = useMemo(
    () => new Set(workspaceRepos.map((repo) => repo.fullName)),
    [workspaceRepos],
  )

  const availableRepositories = useMemo(
    () => catalog.filter((repo) => !workspaceFullNames.has(repo.fullName)),
    [catalog, workspaceFullNames],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function loadCatalog() {
      setIsLoading(true)
      setLoadError(null)
      setPickerStatus(null)

      try {
        const result = await loadRepositories()
        if (cancelled) {
          return
        }

        setPickerStatus(result.status)
        setCatalog(result.repositories)

        if (result.errorMessage) {
          setLoadError(result.errorMessage)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load GitHub repositories.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadCatalog()

    return () => {
      cancelled = true
    }
  }, [loadRepositories, open])

  async function handleSelect(repository: GitHubRepository) {
    setIsAdding(repository.fullName)

    try {
      await addRepository({
        fullName: repository.fullName,
        name: repository.name,
        ownerLogin: repository.ownerLogin,
        defaultBranch: repository.defaultBranch,
        githubId: repository.githubId,
        isPrivate: repository.isPrivate,
        url: repository.url,
      })
      onOpenChange(false)
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not add repository to workspace.',
      )
    } finally {
      setIsAdding(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-sm">Add repository</DialogTitle>
          <DialogDescription className="text-xs">
            Choose a GitHub repository to add to your workspace.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Loading repositories from GitHub…
          </div>
        ) : pickerStatus !== 'connected' ? (
          <div className="space-y-3 px-4 py-6 text-sm">
            <p className="text-muted-foreground">
              {loadError ??
                'Connect GitHub in Clerk, then verify your connection in Settings.'}
            </p>
            <Link
              to="/app/settings"
              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Open Settings
            </Link>
          </div>
        ) : (
          <Command className="rounded-none border-0 shadow-none">
            <CommandInput placeholder="Search repositories…" className="h-10" />
            <CommandList className="max-h-72">
              {loadError ? (
                <div className="px-4 py-3 text-xs text-destructive">{loadError}</div>
              ) : null}
              <CommandEmpty>
                {availableRepositories.length === 0 && catalog.length > 0
                  ? 'All loaded repositories are already in your workspace.'
                  : 'No repositories match your search.'}
              </CommandEmpty>
              <CommandGroup>
                {availableRepositories.map((repository) => (
                  <CommandItem
                    key={repository.fullName}
                    value={`${repository.fullName} ${repository.name}`}
                    disabled={isAdding === repository.fullName}
                    onSelect={() => void handleSelect(repository)}
                    className="text-xs"
                  >
                    <span className="truncate">{repository.fullName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  )
}
