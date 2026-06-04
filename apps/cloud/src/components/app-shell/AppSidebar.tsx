'use client'

import * as React from 'react'
import { useUser } from '@clerk/clerk-react'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from 'lucide-react'

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
  SidebarTrigger,
} from '#/components/ui/sidebar.tsx'
import { cn } from '#/lib/utils.ts'

const DEMO_REPOSITORIES = [
  { id: 'repo-1', name: 'Repository 1', defaultOpen: true },
  { id: 'repo-2', name: 'Repository 2', defaultOpen: false },
  { id: 'repo-3', name: 'Repository 3', defaultOpen: false },
] as const

const sidebarIconButtonClass =
  'size-7 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-3'

const menuButtonClass = 'h-7 text-[11px] [&_svg]:size-3'

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
          >
            {open ? (
              <ChevronDownIcon className="shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                size="sm"
                className="pointer-events-none text-[11px] text-muted-foreground"
              >
                <span>No sessions yet</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarUserName() {
  const { user, isLoaded } = useUser()

  const displayName = React.useMemo(() => {
    if (!isLoaded) {
      return 'Jane Doe'
    }

    const fromClerk =
      user?.fullName?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()

    return fromClerk || 'Jane Doe'
  }, [isLoaded, user])

  return (
    <span className="min-w-0 truncate text-xs font-medium text-sidebar-foreground">
      {displayName}
    </span>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="shrink-0 border-b border-sidebar-border p-2">
        <div className="flex h-7 items-center justify-between gap-1">
          <SidebarTrigger className={sidebarIconButtonClass} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={sidebarIconButtonClass}
            aria-label="Search"
            title="Search"
          >
            <SearchIcon />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SidebarGroup className="px-2 py-2">
          <Button
            type="button"
            className="h-7 w-full gap-2 text-xs font-medium"
            size="sm"
            onClick={() => {
              // New session — wired in a later pass
            }}
          >
            <PlusIcon className="size-3" />
            New Session
          </Button>
        </SidebarGroup>

        <SidebarGroup className="px-0 py-0">
          <div className="flex h-7 shrink-0 items-center px-2 pt-1">
            <SidebarGroupLabel className="h-auto px-0 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
              Repositories
            </SidebarGroupLabel>
          </div>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-2 pb-2">
              {DEMO_REPOSITORIES.map((repo) => (
                <RepositoryCollapsible
                  key={repo.id}
                  name={repo.name}
                  defaultOpen={repo.defaultOpen}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border p-2">
        <div className="flex h-7 items-center justify-between gap-2">
          <SidebarUserName />
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={sidebarIconButtonClass}
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(sidebarIconButtonClass, 'relative')}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </Button>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
