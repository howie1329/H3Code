import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/settings')({
  head: () => ({
    meta: [{ title: 'Settings · H3Code Cloud' }],
  }),
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account and integration preferences.
        </p>
      </div>

      <section className="space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-medium">Account</h2>
        <p className="text-sm text-muted-foreground">
          Profile and sign-in settings — coming soon.
        </p>
      </section>

      <section className="space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-medium">GitHub</h2>
        <p className="text-sm text-muted-foreground">
          Connect GitHub via Clerk to access repositories — coming soon.
        </p>
      </section>
    </div>
  )
}
