import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/tanstack-react-start'

import { Button } from '#/components/ui/button.tsx'

export default function HeaderUser() {
  return (
    <>
      <Show when="signed-in">
        <UserButton />
      </Show>
      <Show when="signed-out">
        <div className="flex items-center gap-2">
          <SignInButton mode="modal" fallbackRedirectUrl="/app">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal" fallbackRedirectUrl="/app">
            <Button size="sm">Sign up</Button>
          </SignUpButton>
        </div>
      </Show>
    </>
  )
}
