import { SignInButton, SignUpButton } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

import { Button } from '#/components/ui/button.tsx'

export const Route = createFileRoute('/')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">H3Code Cloud</h1>
        <div className="flex items-center justify-center gap-2">
          <SignInButton mode="modal">
            <Button variant="outline">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button>Sign up</Button>
          </SignUpButton>
        </div>
      </div>
    </div>
  )
}
