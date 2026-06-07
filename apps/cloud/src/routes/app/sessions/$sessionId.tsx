import { createFileRoute } from '@tanstack/react-router'

import { SessionWorkspace } from '#/components/workspace/SessionWorkspace.tsx'

export const Route = createFileRoute('/app/sessions/$sessionId')({
  head: () => ({
    meta: [{ title: 'Session · H3Code Cloud' }],
  }),
  component: SessionRoute,
})

function SessionRoute() {
  const { sessionId } = Route.useParams()
  return <SessionWorkspace sessionId={sessionId} />
}
