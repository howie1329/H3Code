import { useRouteContext } from '@tanstack/react-router'
import { useAuth } from '@clerk/tanstack-react-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { convexClient } = useRouteContext({ from: '__root__' })

  return (
    <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
