import { AppHeader } from '#/components/app-shell/AppHeader'
import { AppSidebar } from '#/components/app-shell/AppSidebar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar.tsx'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-screen min-h-0 overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
