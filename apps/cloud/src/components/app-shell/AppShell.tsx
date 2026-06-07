import { AppMainColumn } from '#/components/app-shell/AppMainColumn.tsx'
import { AppSidebar } from '#/components/app-shell/AppSidebar'
import { AddRepositoryProvider } from '#/components/workspace/add-repository-context.tsx'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar.tsx'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AddRepositoryProvider>
      <SidebarProvider className="h-screen min-h-0 overflow-hidden bg-background text-foreground">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppMainColumn>{children}</AppMainColumn>
        </SidebarInset>
      </SidebarProvider>
    </AddRepositoryProvider>
  )
}
