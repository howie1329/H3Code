import HeaderUser from '#/integrations/clerk/header-user'

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-end border-b px-4">
      <HeaderUser />
    </header>
  )
}
