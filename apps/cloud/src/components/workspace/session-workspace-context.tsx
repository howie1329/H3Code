'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type SessionPanel = 'none' | 'context' | 'diff'

type SessionWorkspaceContextValue = {
  activePanel: SessionPanel
  toggleContextPanel: () => void
  toggleDiffPanel: () => void
}

const SessionWorkspaceContext =
  createContext<SessionWorkspaceContextValue | null>(null)

export function SessionWorkspaceProvider({
  children,
}: {
  children: ReactNode
}) {
  const [activePanel, setActivePanel] = useState<SessionPanel>('context')

  const toggleContextPanel = useCallback(() => {
    setActivePanel((current) => (current === 'context' ? 'none' : 'context'))
  }, [])

  const toggleDiffPanel = useCallback(() => {
    setActivePanel((current) => (current === 'diff' ? 'none' : 'diff'))
  }, [])

  const value = useMemo(
    () => ({
      activePanel,
      toggleContextPanel,
      toggleDiffPanel,
    }),
    [activePanel, toggleContextPanel, toggleDiffPanel],
  )

  return (
    <SessionWorkspaceContext.Provider value={value}>
      {children}
    </SessionWorkspaceContext.Provider>
  )
}

export function useSessionWorkspace() {
  const context = useContext(SessionWorkspaceContext)

  if (!context) {
    throw new Error(
      'useSessionWorkspace must be used within SessionWorkspaceProvider',
    )
  }

  return context
}
