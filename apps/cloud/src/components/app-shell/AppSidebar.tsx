import { Link, useParams } from '@tanstack/react-router'

const DEMO_SESSIONS = [
  { id: 'demo-1', label: 'Demo session 1' },
  { id: 'demo-2', label: 'Demo session 2' },
] as const

export function AppSidebar() {
  const params = useParams({ strict: false })
  const activeSessionId =
    typeof params.sessionId === 'string' ? params.sessionId : undefined

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border p-4">
        <p className="text-sm font-semibold">H3Code Cloud</p>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <button
          type="button"
          className="rounded-md border border-dashed border-sidebar-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => {
            // Repo picker modal — wired in a later pass
          }}
        >
          Add repository
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
        <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sessions
        </p>
        {DEMO_SESSIONS.map((session) => (
          <Link
            key={session.id}
            to="/app/sessions/$sessionId"
            params={{ sessionId: session.id }}
            className={`rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              activeSessionId === session.id
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {session.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Link
          to="/app/settings"
          className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{
            className:
              'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
          }}
        >
          Settings
        </Link>
      </div>
    </aside>
  )
}
