'use client'

import * as React from 'react'

export const THEME_STORAGE_KEY = 'h3code-cloud-theme'

export type Theme = 'dark' | 'light' | 'system'

type ResolvedTheme = 'dark' | 'light'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function resolveTheme(theme: Theme): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  return theme
}

function applyThemeClass(theme: Theme) {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolveTheme(theme))
}

export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k)||'system';var r=document.documentElement;r.classList.remove('light','dark');if(t==='system'){var s=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';r.classList.add(s);}else{r.classList.add(t);}}catch(e){}})();`

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] =
    React.useState<ResolvedTheme>('light')

  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemeState(stored)
      applyThemeClass(stored)
      setResolvedTheme(resolveTheme(stored))
      return
    }

    applyThemeClass(defaultTheme)
    setResolvedTheme(resolveTheme(defaultTheme))
  }, [defaultTheme, storageKey])

  React.useEffect(() => {
    applyThemeClass(theme)
    setResolvedTheme(resolveTheme(theme))
  }, [theme])

  React.useEffect(() => {
    if (theme !== 'system') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      applyThemeClass('system')
      setResolvedTheme(resolveTheme('system'))
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey],
  )

  const toggleTheme = React.useCallback(() => {
    const next = resolveTheme(theme) === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }, [setTheme, theme])

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [resolvedTheme, setTheme, theme, toggleTheme],
  )

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
