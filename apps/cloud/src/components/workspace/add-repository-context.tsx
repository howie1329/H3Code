'use client'

import type { ReactNode } from 'react'
import { createContext, useContext, useMemo, useState } from 'react'

import { AddRepositoryDialog } from '#/components/workspace/AddRepositoryDialog.tsx'

type AddRepositoryContextValue = {
  openAddRepositoryDialog: () => void
}

const AddRepositoryContext = createContext<AddRepositoryContextValue | null>(
  null,
)

export function AddRepositoryProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const value = useMemo(
    () => ({
      openAddRepositoryDialog: () => setOpen(true),
    }),
    [],
  )

  return (
    <AddRepositoryContext.Provider value={value}>
      {children}
      <AddRepositoryDialog open={open} onOpenChange={setOpen} />
    </AddRepositoryContext.Provider>
  )
}

export function useAddRepositoryDialog() {
  const context = useContext(AddRepositoryContext)
  if (!context) {
    throw new Error(
      'useAddRepositoryDialog must be used within AddRepositoryProvider',
    )
  }

  return context
}
