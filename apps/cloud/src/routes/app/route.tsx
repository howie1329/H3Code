import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell/AppShell'

export const Route = createFileRoute('/app')({
  beforeLoad: ({ context, location }) => {
    if (!context.userId) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect_url: location.href,
        },
      })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
