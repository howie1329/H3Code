'use client'

import * as React from 'react'
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
import { DEMO_REPOSITORIES } from '#/lib/demo-repositories.ts'
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
  const onNewSession = () => {
    // New session — wired in a later pass
  }

  if (iconRail) {
    return (
      <SidebarToolbarAction
        label="New session"
        aria-label="New session"
        title="New session"
        onClick={onNewSession}
      >
        <PlusIcon className={iconClass} aria-hidden />
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
      onClick={onNewSession}
    >
      <PlusIcon className={iconClass} aria-hidden />
      <span className="truncate">New session</span>
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

function RepositoryCollapsible({
  name,
  defaultOpen = false,
}: {
  name: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            size="sm"
            tooltip={name}
            className={menuRowClass}
            aria-expanded={open}
          >
            {open ? (
              <ChevronDownIcon className={cn(iconClass, 'text-muted-foreground')} aria-hidden />
            ) : (
              <ChevronRightIcon className={cn(iconClass, 'text-muted-foreground')} aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate">{name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 gap-0.5 border-0 px-0 py-0.5 pl-5">
            <SidebarMenuSubItem>
              <p className={cn('px-2 py-1', metaClass)}>No sessions yet</p>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                asChild
                size="sm"
                className={cn(
                  menuRowClass,
                  'text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    // Start session — wired in a later pass
                  }}
                >
                  <PlusIcon className={cn(iconClass, 'text-muted-foreground')} aria-hidden />
                  <span>Start session</span>
                </button>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function RepositoriesEmptyState() {
  return (
    <div className="flex flex-col gap-3 py-6 pr-1">
      <div className="space-y-1">
        <p className="text-xs font-medium text-sidebar-foreground">No repositories yet</p>
        <p className={cn(metaClass, 'leading-relaxed')}>
          Connect a repository to browse Pi sessions and start work from here.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-7 w-full justify-start gap-2 border-sidebar-border px-2 text-[11px] shadow-none active:translate-y-px motion-reduce:active:translate-y-0"
        onClick={() => {
          // Add repository — wired in a later pass
        }}
      >
        <PlusIcon className={iconClass} aria-hidden />
        Add repository
      </Button>
    </div>
  )
}

export function AppSidebar() {
  const iconRail = useIconRail()
  const isSettingsActive = useIsSettingsRoute()
  const repositories = DEMO_REPOSITORIES
  const hasRepositories = repositories.length > 0

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader
        className={cn('shrink-0 gap-0 border-b border-sidebar-border/50 p-0', sidebarInset, 'py-1.5')}
      >
        <div
          className={cn(
            'flex w-full min-w-0 items-center gap-0.5',
            iconRail ? 'flex-col' : 'h-7',
          )}
        >
          <SidebarCollapseTrigger />
          <SidebarToolbarAction label="Search" aria-label="Search" title="Search">
            <SearchIcon className={iconClass} aria-hidden />
          </SidebarToolbarAction>
          <NewSessionToolbarButton iconRail={iconRail} />
        </div>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-0 overflow-hidden">
        {!iconRail ? (
          <SidebarGroup className="flex min-h-0 flex-1 flex-col p-0">
            <div className={cn('flex h-7 shrink-0 items-center pt-2', sidebarInset)}>
              <SidebarGroupLabel className={groupLabelClass}>Repositories</SidebarGroupLabel>
            </div>
            <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
              <nav
                aria-label="Repositories"
                className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-2', sidebarInset)}
              >
                {!hasRepositories ? (
                  <RepositoriesEmptyState />
                ) : (
                  <SidebarMenu className="gap-0.5">
                    {repositories.map((repo) => (
                      <RepositoryCollapsible
                        key={repo.id}
                        name={repo.name}
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
                  className={cn(menuRowClass, 'text-muted-foreground data-[active=true]:text-sidebar-accent-foreground')}
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
