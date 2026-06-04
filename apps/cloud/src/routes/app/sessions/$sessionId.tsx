import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/sessions/$sessionId')({
  head: ({ params }) => ({
    meta: [{ title: `Session ${params.sessionId} · H3Code Cloud` }],
  }),
  component: SessionWorkspace,
})

function SessionWorkspace() {
  const { sessionId } = Route.useParams()

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Session workspace</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {sessionId}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex min-h-0 flex-col gap-4">
          <section
            aria-label="Transcript"
            className="min-h-48 flex-1 rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          >
            Transcript slot
          </section>
          <section
            aria-label="Composer"
            className="h-24 shrink-0 rounded-md border border-dashed p-4 text-sm text-muted-foreground"
          >
            Composer slot
          </section>
        </div>
        <section
          aria-label="Inspector"
          className="hidden w-64 shrink-0 rounded-md border border-dashed p-4 text-sm text-muted-foreground lg:block"
        >
          Inspector slot
        </section>
      </div>
    </div>
  )
}
