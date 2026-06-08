'use node'

import { Daytona } from '@daytona/sdk'
import type { Sandbox } from '@daytona/sdk'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getGitHubTokenForClerkUser } from './lib/clerkGithub'

const REPO_PATH = 'workspace/repo'
const PROBE_OUTPUT_MAX_LENGTH = 500

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}

function userSafeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected provisioning error.'
}

function createDaytonaClient(): Daytona {
  const apiKey = process.env.DAYTONA_API_KEY
  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY is not configured in Convex.')
  }

  const target = process.env.DAYTONA_TARGET
  return new Daytona({
    apiKey,
    ...(target ? { target } : {}),
  })
}

async function deleteSandbox(daytona: Daytona, sandbox: Sandbox | null) {
  if (!sandbox) {
    return
  }

  try {
    await daytona.delete(sandbox)
  } catch {
    // Best-effort cleanup after a failed provision.
  }
}

export const provision = internalAction({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const loaded = await ctx.runQuery(internal.sandbox.getSessionForProvision, {
      sessionId: args.sessionId,
    })

    if (!loaded) {
      return
    }

    const { session, clerkUserId } = loaded
    if (session.status !== 'provisioning') {
      return
    }

    if (!session.githubOwner || !session.githubRepo || !session.baseBranch) {
      await ctx.runMutation(internal.sandbox.markProvisionError, {
        sessionId: args.sessionId,
        provisionError: 'Session is missing repository details.',
      })
      return
    }

    let sandbox: Sandbox | null = null
    let daytona: Daytona | null = null

    try {
      const githubToken = await getGitHubTokenForClerkUser(clerkUserId)
      if (!githubToken) {
        throw new Error(
          'GitHub is not connected or Clerk has no GitHub OAuth token. Open Settings and verify GitHub.',
        )
      }

      daytona = createDaytonaClient()
      sandbox = await daytona.create(
        {
          language: 'typescript',
          autoStopInterval: 0,
          labels: {
            h3code: 'provision-spike',
            sessionId: args.sessionId,
          },
        },
        { timeout: 120 },
      )

      const cloneUrl = `https://github.com/${session.githubOwner}/${session.githubRepo}.git`
      await sandbox.git.clone(
        cloneUrl,
        REPO_PATH,
        session.baseBranch,
        undefined,
        'git',
        githubToken,
      )

      const probe = await sandbox.process.executeCommand(
        'git rev-parse HEAD && pwd && ls',
        REPO_PATH,
        undefined,
        60,
      )

      if (probe.exitCode !== 0) {
        throw new Error(
          probe.result.trim() || 'Sandbox probe command failed.',
        )
      }

      await ctx.runMutation(internal.sandbox.markProvisionSuccess, {
        sessionId: args.sessionId,
        sandboxId: sandbox.id,
        probeOutput: truncate(probe.result, PROBE_OUTPUT_MAX_LENGTH),
      })
    } catch (error) {
      if (daytona) {
        await deleteSandbox(daytona, sandbox)
      }

      await ctx.runMutation(internal.sandbox.markProvisionError, {
        sessionId: args.sessionId,
        provisionError: userSafeError(error),
      })
    }
  },
})
