'use client'

import * as React from 'react'
import { useQuery } from 'convex/react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from 'lucide-react'

import { useTheme } from '#/components/theme-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '#/components/ui/sidebar.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip.tsx'
import { api } from '../../../convex/_generated/api'

import { toSidebarSession } from '#/lib/session/convex-mappers.ts'
import { useAddRepositoryDialog } from '#/components/workspace/add-repository-context.tsx'
import { mapWorkspaceRepositories } from '#/lib/session/repositories.ts'
import type { SidebarSession } from '#/lib/session/types.ts'
import { cn } from '#/lib/utils.ts'

const sidebarInset = 'px-2'

const iconClass = 'size-3 shrink-0'

const iconActionClass = cn(
  'size-7 shrink-0 rounded-md text-sidebar-foreground',
  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  'focus-visible:ring-2 focus-visible:ring-sidebar-ring/30 focus-visible:outline-none',
  'active:translate-y-px motion-reduce:active:translate-y-0',
  'disabled:pointer-events-none disabled:opacity-50',
  '[&_svg]:size-3',
)

const menuRowClass = cn(
  'h-7 gap-1.5 px-2 text-[11px] font-normal leading-snug',
  '[&>svg]:!size-3',
  'active:translate-y-px motion-reduce:active:translate-y-0',
)

const groupLabelClass = cn(
  'h-auto px-0 text-[11px] font-medium uppercase tracking-wide',
  'text-sidebar-foreground/70',
)

const metaClass = 'text-[11px] leading-snug text-muted-foreground'

function useIconRail() {
  const { state, isMobile } = useSidebar()
  return state === 'collapsed' && !isMobile
}

function useIsSettingsRoute() {
  return useRouterState({
    select: (state) => state.location.pathname.startsWith('/app/settings'),
  })
}

function useActiveSessionId() {
  return useRouterState({
    select: (state) => {
      const match = /^\/app\/sessions\/([^/]+)/.exec(state.location.pathname)
      return match?.[1]
    },
  })
}

function SidebarCollapseTrigger() {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={iconActionClass}
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      title="Toggle sidebar (⌘B)"
    >
      <PanelLeftIcon className={iconClass} aria-hidden />
    </Button>
  )
}

function NewSessionToolbarButton({ iconRail }: { iconRail: boolean }) {
  if (iconRail) {
    return (
      <SidebarToolbarAction label="New session" asChild>
        <Link to="/app" aria-label="New session" title="New session">
          <PlusIcon className={iconClass} aria-hidden />
        </Link>
      </SidebarToolbarAction>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        iconActionClass,
        'ml-auto h-7 max-w-full items-center gap-1.5 px-2 text-[11px] font-medium',
      )}
      aria-label="New session"
      title="New session"
      asChild
    >
      <Link to="/app">
        <PlusIcon className={iconClass} aria-hidden />
        <span className="truncate">New session</span>
      </Link>
    </Button>
  )
}

function SidebarToolbarAction({
  label,
  className,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string
  asChild?: boolean
}) {
  const iconRail = useIconRail()
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      asChild={asChild}
      className={cn(iconActionClass, className)}
      {...props}
    >
      {children}
    </Button>
  )

  if (iconRail) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" align="center" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}

function ThemeToggleButton() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const themeToggleLabel =
    resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <SidebarToolbarAction
      label={themeToggleLabel}
      className="relative shrink-0"
      aria-label={themeToggleLabel}
      title={themeToggleLabel}
      onClick={toggleTheme}
    >
      <SunIcon
        className={cn(
          iconClass,
          'scale-100 rotate-0 transition-all motion-reduce:transition-none dark:scale-0 dark:-rotate-90',
        )}
        aria-hidden
      />
      <MoonIcon
        className={cn(
          iconClass,
          'absolute scale-0 rotate-90 transition-all motion-reduce:transition-none dark:scale-100 dark:rotate-0',
        )}
        aria-hidden
      />
    </SidebarToolbarAction>
  )
}

function SessionSidebarLink({ session }: { session: SidebarSession }) {
  const activeSessionId = useActiveSessionId()
  const isActive = activeSessionId === session.id
  const title = session.summary.title ?? session.id
  const statusLabel = session.summary.status

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        size="sm"
        isActive={isActive}
        className={cn(
          menuRowClass,
          'h-auto min-h-7 flex-col items-start gap-0 py-1.5',
          'text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <Link
          to="/app/sessions/$sessionId"
          params={{ sessionId: session.id }}
          title={title}
        >
          <span className="w-full truncate">{title}</span>
          {(session.preview ?? statusLabel !== 'idle') ? (
            <span className={cn('w-full truncate', metaClass)}>
              {session.preview ?? statusLabel}
            </span>
          ) : null}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function RepositoryCollapsible({
  repositoryId,
  name,
  sessions,
  defaultOpen = false,
}: {
  repositoryId: string
  name: string
  sessions: readonly SidebarSession[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <div className="flex w-full min-w-0 items-center gap-0.5">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              size="sm"
              tooltip={name}
              className={cn(menuRowClass, 'min-w-0 flex-1')}
              aria-expanded={open}
            >
              {open ? (
                <ChevronDownIcon
                  className={cn(iconClass, 'text-muted-foreground')}
                  aria-hidden
                />
              ) : (
                <ChevronRightIcon
                  className={cn(iconClass, 'text-muted-foreground')}
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 truncate">{name}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <SidebarToolbarAction
            label={`New session in ${name}`}
            asChild
            className="shrink-0"
          >
            <Link
              to="/app"
              search={{ repo: repositoryId }}
              aria-label={`New session in ${name}`}
              title={`New session in ${name}`}
            >
              <PlusIcon className={iconClass} aria-hidden />
            </Link>
          </SidebarToolbarAction>
        </div>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 gap-0.5 border-0 px-0 py-0.5 pl-5">
            {sessions.length === 0 ? (
              <SidebarMenuSubItem>
                <p className={cn('px-2 py-1', metaClass)}>No sessions yet</p>
              </SidebarMenuSubItem>
            ) : (
              sessions.map((session) => (
                <SessionSidebarLink key={session.id} session={session} />
              ))
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function RepositoriesEmptyState({
  onAddRepository,
}: {
  onAddRepository: () => void
}) {
  return (
    <div className="flex flex-col gap-3 py-6 pr-1">
      <div className="space-y-1">
        <p className="text-xs font-medium text-sidebar-foreground">
          No repositories yet
        </p>
        <p className={cn(metaClass, 'leading-relaxed')}>
          Add a repository from GitHub to browse Pi sessions and start work here.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-7 w-full justify-start gap-2 border-sidebar-border px-2 text-[11px] shadow-none active:translate-y-px motion-reduce:active:translate-y-0"
        onClick={onAddRepository}
      >
        <PlusIcon className={iconClass} aria-hidden />
        Add repository
      </Button>
    </div>
  )
}

function groupSessionsByRepository(
  sessions: readonly SidebarSession[],
): Map<string, SidebarSession[]> {
  const grouped = new Map<string, SidebarSession[]>()

  for (const session of sessions) {
    const existing = grouped.get(session.repositoryId) ?? []
    existing.push(session)
    grouped.set(session.repositoryId, existing)
  }

  return grouped
}

export function AppSidebar() {
  const iconRail = useIconRail()
  const isSettingsActive = useIsSettingsRoute()
  const { openAddRepositoryDialog } = useAddRepositoryDialog()
  const workspaceRepoRows = useQuery(api.workspaceRepositories.list)
  const sessionRows = useQuery(api.sessions.listForUser) ?? []

  const repositories = React.useMemo(
    () => mapWorkspaceRepositories(workspaceRepoRows ?? []),
    [workspaceRepoRows],
  )

  const sessionsByRepository = React.useMemo(() => {
    const sidebarSessions = sessionRows
      .map((session) => toSidebarSession(session))
      .filter((session): session is SidebarSession => session !== null)

    return groupSessionsByRepository(sidebarSessions)
  }, [sessionRows])

  const isLoadingRepositories = workspaceRepoRows === undefined
  const hasRepositories = repositories.length > 0

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader
        className={cn(
          'shrink-0 gap-0 border-b border-sidebar-border/50 p-0',
          sidebarInset,
          'py-1.5',
        )}
      >
        <div
          className={cn(
            'flex w-full min-w-0 items-center gap-0.5',
            iconRail ? 'flex-col' : 'h-7',
          )}
        >
          <SidebarCollapseTrigger />
          <SidebarToolbarAction
            label="Search"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon className={iconClass} aria-hidden />
          </SidebarToolbarAction>
          <NewSessionToolbarButton iconRail={iconRail} />
        </div>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-0 overflow-hidden">
        {!iconRail ? (
          <SidebarGroup className="flex min-h-0 flex-1 flex-col p-0">
            <div
              className={cn(
                'flex h-7 shrink-0 items-center justify-between gap-1 pt-2',
                sidebarInset,
              )}
            >
              <SidebarGroupLabel className={groupLabelClass}>
                Repositories
              </SidebarGroupLabel>
              <SidebarToolbarAction
                label="Add repository"
                onClick={openAddRepositoryDialog}
                className="shrink-0"
              >
                <PlusIcon className={iconClass} aria-hidden />
              </SidebarToolbarAction>
            </div>
            <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
              <nav
                aria-label="Repositories"
                className={cn(
                  'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-2',
                  sidebarInset,
                )}
              >
                {isLoadingRepositories ? (
                  <p className={cn('px-2 py-6', metaClass)}>
                    Loading repositories…
                  </p>
                ) : !hasRepositories ? (
                  <RepositoriesEmptyState
                    onAddRepository={openAddRepositoryDialog}
                  />
                ) : (
                  <SidebarMenu className="gap-0.5">
                    {repositories.map((repo) => (
                      <RepositoryCollapsible
                        key={repo.id}
                        repositoryId={repo.id}
                        name={repo.name}
                        sessions={sessionsByRepository.get(repo.id) ?? []}
                        defaultOpen={repo.defaultOpen}
                      />
                    ))}
                  </SidebarMenu>
                )}
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter
        className={cn(
          'shrink-0 gap-1 border-t border-sidebar-border/50 p-0',
          iconRail ? 'px-1 py-2' : cn(sidebarInset, 'py-2'),
        )}
      >
        {iconRail ? (
          <div className="flex flex-col items-center gap-1">
            <SidebarToolbarAction label="Settings" asChild>
              <Link to="/app/settings" aria-label="Settings" title="Settings">
                <SettingsIcon className={iconClass} aria-hidden />
              </Link>
            </SidebarToolbarAction>
            <ThemeToggleButton />
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <SidebarMenu className="min-w-0 flex-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  isActive={isSettingsActive}
                  tooltip="Settings"
                  className={cn(
                    menuRowClass,
                    'text-muted-foreground data-[active=true]:text-sidebar-accent-foreground',
                  )}
                >
                  <Link to="/app/settings">
                    <SettingsIcon className={iconClass} aria-hidden />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <ThemeToggleButton />
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
