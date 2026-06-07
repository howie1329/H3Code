'use client'

import type { ReactNode } from 'react'
import { useRouterState } from '@tanstack/react-router'

import { AppHeader } from '#/components/app-shell/AppHeader.tsx'

function useIsWorkspaceLandingRoute() {
  return useRouterState({
    select: (state) => {
      const pathname = state.location.pathname
      return pathname === '/app' || pathname === '/app/'
    },
  })
}

function useIsSessionRoute() {
  return useRouterState({
    select: (state) => /^\/app\/sessions\/[^/]+/.test(state.location.pathname),
  })
}

export function AppMainColumn({ children }: { children: ReactNode }) {
  const isWorkspaceLanding = useIsWorkspaceLandingRoute()
  const isSessionRoute = useIsSessionRoute()
  const showAppHeader = !isWorkspaceLanding && !isSessionRoute

  return (
    <>
      {showAppHeader ? <AppHeader /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </>
  )
}
