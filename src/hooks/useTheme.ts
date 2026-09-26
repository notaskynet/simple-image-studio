import { useCallback, useEffect, useState } from 'react'

import { settings } from '../lib/settings'
import type { Theme } from '../types'

function initialTheme(): Theme {
  const stored = settings.getTheme()
  if (stored) return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      settings.setTheme(next)
      return next
    })
  }, [])

  return [theme, toggle]
}
