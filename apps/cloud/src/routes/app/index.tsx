import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({
  component: WorkspaceLanding,
})

function WorkspaceLanding() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">H3Code Cloud</h1>
      <p className="max-w-md text-muted-foreground">
        Select or start a session from the sidebar to open a workspace.
      </p>
      <Link
        to="/app/sessions/$sessionId"
        params={{ sessionId: 'demo' }}
        className="text-sm underline underline-offset-4 hover:text-foreground"
      >
        Open demo session
      </Link>
    </div>
  )
}
