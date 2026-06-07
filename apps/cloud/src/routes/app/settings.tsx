import { useState } from 'react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircleIcon, GithubIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'

import { api } from '../../../convex/_generated/api'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { loadGitHubConnectionPayload } from '#/integrations/github/server.ts'

export const Route = createFileRoute('/app/settings')({
  head: () => ({
    meta: [{ title: 'Settings · H3Code Cloud' }],
  }),
  component: SettingsPage,
})

function SettingsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const githubState = useQuery(api.github.getConnection)
  const verifyConnection = useMutation(api.github.verifyConnection)
  const loadGitHubPayload = useServerFn(loadGitHubConnectionPayload)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const connection = githubState?.connection
  const status = connection?.status ?? 'token_unavailable'
  const isConnected = status === 'connected'

  async function handleVerifyGitHub() {
    setIsVerifying(true)
    setVerifyError(null)

    try {
      const payload = await loadGitHubPayload()
      await verifyConnection(payload)
    } catch (error) {
      setVerifyError(
        error instanceof Error
          ? error.message
          : 'Could not verify GitHub connection.',
      )
    } finally {
      setIsVerifying(false)
    }
  }

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
          Clerk is the identity provider for H3Code Cloud.
        </p>
        <div className="pt-2">
          <Badge variant={isAuthenticated ? 'secondary' : 'outline'}>
            {isLoading
              ? 'Checking Convex auth'
              : isAuthenticated
                ? 'Convex authenticated'
                : 'Convex auth unavailable'}
          </Badge>
        </div>
      </section>

      <section className="space-y-4 rounded-md border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <GithubIcon className="size-4" aria-hidden />
              GitHub
            </h2>
            <p className="text-sm text-muted-foreground">
              Verify the GitHub account connected through Clerk. Add repositories
              to your workspace from the sidebar.
            </p>
          </div>
          <Badge variant={isConnected ? 'secondary' : 'outline'}>
            {isConnected ? 'Connected' : 'Not connected'}
          </Badge>
        </div>

        {connection ? (
          <Alert variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? (
              <CheckCircleIcon aria-hidden />
            ) : (
              <TriangleAlertIcon aria-hidden />
            )}
            <AlertTitle>
              {isConnected
                ? `Connected as ${connection.githubLogin ?? 'GitHub user'}`
                : status === 'missing_scopes'
                  ? 'GitHub scopes need attention'
                  : 'GitHub token unavailable'}
            </AlertTitle>
            <AlertDescription>
              {isConnected
                ? 'GitHub is ready. Use Add repository in the sidebar to choose repos for your workspace.'
                : connection.errorMessage ??
                  'Connect GitHub in Clerk and verify again.'}
            </AlertDescription>
          </Alert>
        ) : null}

        {verifyError ? (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Verification failed</AlertTitle>
            <AlertDescription>{verifyError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Clerk must have GitHub OAuth enabled with repository-read scopes.
          </p>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={isVerifying || isLoading || !isAuthenticated}
            onClick={handleVerifyGitHub}
          >
            <RefreshCwIcon
              className={isVerifying ? 'size-3.5 animate-spin' : 'size-3.5'}
              aria-hidden
            />
            {isVerifying ? 'Verifying' : 'Verify GitHub'}
          </Button>
        </div>
      </section>
    </div>
  )
}
