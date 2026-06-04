'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
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
import { cn } from '#/lib/utils.ts'

const DEMO_REPOSITORIES = [
  { id: 'repo-1', name: 'Repository 1', defaultOpen: true },
  { id: 'repo-2', name: 'Repository 2', defaultOpen: false },
  { id: 'repo-3', name: 'Repository 3', defaultOpen: false },
] as const

const toolbarIconSize = 'size-2.5 shrink-0'

const toolbarButtonClass =
  'size-7 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring'

const menuIconSize = 'size-2.5 shrink-0'

const menuButtonClass = 'h-7 gap-1.5 px-2 text-[11px] font-normal'

function SidebarCollapseTrigger() {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={toolbarButtonClass}
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      title="Toggle sidebar"
    >
      <PanelLeftIcon className={toolbarIconSize} />
    </Button>
  )
}

function NewSessionToolbarButton() {
  const { state, isMobile } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  const onNewSession = () => {
    // New session — wired in a later pass
  }

  if (collapsed) {
    return (
      <SidebarToolbarAction
        label="New session"
        aria-label="New session"
        title="New session"
        onClick={onNewSession}
      >
        <PlusIcon className={toolbarIconSize} />
      </SidebarToolbarAction>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        toolbarButtonClass,
        'ml-auto h-7 max-w-full items-center gap-1.5 px-2 text-[11px] font-medium',
      )}
      aria-label="New session"
      title="New session"
      onClick={onNewSession}
    >
      <PlusIcon className={toolbarIconSize} />
      <span className="truncate">New session</span>
    </Button>
  )
}

function SidebarToolbarAction({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  const { state, isMobile } = useSidebar()
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn(toolbarButtonClass, className)}
      {...props}
    >
      {children}
    </Button>
  )

  if (state === 'collapsed' && !isMobile) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
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
            className={menuButtonClass}
            aria-expanded={open}
          >
            {open ? (
              <ChevronDownIcon className={cn(menuIconSize, 'text-muted-foreground')} />
            ) : (
              <ChevronRightIcon className={cn(menuIconSize, 'text-muted-foreground')} />
            )}
            <span className="truncate">{name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 gap-0.5 border-0 px-0 py-0.5 pl-5">
            <SidebarMenuSubItem>
              <p className="px-2 py-1 text-[11px] leading-snug text-muted-foreground">
                No sessions yet
              </p>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild size="sm" className="h-7 px-2 text-[11px] text-foreground">
                <button
                  type="button"
                  onClick={() => {
                    // Start session — wired in a later pass
                  }}
                >
                  <PlusIcon className={cn(menuIconSize, 'text-muted-foreground')} />
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

export function AppSidebar() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const themeToggleLabel =
    resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Sidebar collapsible="icon" className="border-border">
      <SidebarHeader className="gap-0 border-b border-border/60 p-0">
        <div className="flex h-10 items-center gap-0.5 px-2">
          <SidebarCollapseTrigger />
          <SidebarToolbarAction
            label="Search"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon className={toolbarIconSize} />
          </SidebarToolbarAction>
          <NewSessionToolbarButton />
        </div>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-0 overflow-hidden">
        <nav
          aria-label="Repositories"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pb-2"
        >
          <p className="pt-3 pb-1.5 text-[11px] font-medium text-muted-foreground">
            Repositories
          </p>
          <SidebarMenu className="gap-0.5">
            {DEMO_REPOSITORIES.map((repo) => (
              <RepositoryCollapsible
                key={repo.id}
                name={repo.name}
                defaultOpen={repo.defaultOpen}
              />
            ))}
          </SidebarMenu>
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-1 border-t border-border/60 p-0 px-2 py-2">
        <div className="flex items-center gap-0.5">
          <SidebarMenu className="min-w-0 flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="sm"
                tooltip="Settings"
                className={cn(menuButtonClass, 'text-muted-foreground')}
              >
                <Link to="/app/settings">
                  <SettingsIcon className={toolbarIconSize} />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarToolbarAction
            label={themeToggleLabel}
            className="relative shrink-0"
            aria-label={themeToggleLabel}
            title={themeToggleLabel}
            onClick={toggleTheme}
          >
            <SunIcon
              className={cn(
                toolbarIconSize,
                'scale-100 rotate-0 transition-all motion-reduce:transition-none dark:scale-0 dark:-rotate-90',
              )}
            />
            <MoonIcon
              className={cn(
                toolbarIconSize,
                'absolute scale-0 rotate-90 transition-all motion-reduce:transition-none dark:scale-100 dark:rotate-0',
              )}
            />
          </SidebarToolbarAction>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
