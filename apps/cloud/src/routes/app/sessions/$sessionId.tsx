import { createFileRoute } from '@tanstack/react-router'

import { SessionWorkspace } from '#/components/workspace/SessionWorkspace.tsx'
import { getMockSession } from '#/lib/mock/index.ts'

export const Route = createFileRoute('/app/sessions/$sessionId')({
  head: ({ params }) => {
    const session = getMockSession(params.sessionId)
    const title = session?.summary.title ?? params.sessionId

    return {
      meta: [{ title: `${title} · H3Code Cloud` }],
    }
  },
  component: SessionRoute,
})

function SessionRoute() {
  const { sessionId } = Route.useParams()
  return <SessionWorkspace sessionId={sessionId} />
}
