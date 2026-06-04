import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">H3Code Cloud</h1>
        <p className="text-sm text-muted-foreground">Sign in — coming soon.</p>
      </div>
    </div>
  )
}
