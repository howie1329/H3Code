import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceLanding } from '#/components/workspace/WorkspaceLanding.tsx'

export const Route = createFileRoute('/app/')({
  head: () => ({
    meta: [{ title: 'New session · H3Code Cloud' }],
  }),
  component: AppWorkspaceLandingRoute,
})

function AppWorkspaceLandingRoute() {
  return <WorkspaceLanding />
}
