import HeaderUser from '#/integrations/clerk/header-user'

export function AppHeader() {
  return (
    <header className="flex h-10 shrink-0 items-center justify-end border-b border-border/60 bg-background px-4">
      <HeaderUser />
    </header>
  )
}
