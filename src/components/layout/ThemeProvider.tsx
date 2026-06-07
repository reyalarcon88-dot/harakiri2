'use client'

import * as React from 'react'

type ThemeName = 'light' | 'dark' | 'system' | string
type ThemeAttribute = 'class' | `data-${string}`

type ThemeProviderProps = React.PropsWithChildren<{
  attribute?: ThemeAttribute | ThemeAttribute[]
  defaultTheme?: ThemeName
  disableTransitionOnChange?: boolean
  enableColorScheme?: boolean
  enableSystem?: boolean
  forcedTheme?: ThemeName
  storageKey?: string
  themes?: ThemeName[]
  value?: Record<string, string>
}>

type ThemeContextValue = {
  forcedTheme?: ThemeName
  resolvedTheme?: ThemeName
  setTheme: React.Dispatch<React.SetStateAction<ThemeName>>
  systemTheme?: 'light' | 'dark'
  theme?: ThemeName
  themes: ThemeName[]
}

const THEME_QUERY = '(prefers-color-scheme: dark)'
const DEFAULT_THEMES = ['light', 'dark']

const ThemeContext = React.createContext<ThemeContextValue>({
  setTheme: () => undefined,
  themes: DEFAULT_THEMES,
})

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia(THEME_QUERY).matches ? 'dark' : 'light'
}

function getStoredTheme(storageKey: string, fallback: ThemeName): ThemeName {
  if (typeof window === 'undefined') return fallback

  try {
    return window.localStorage.getItem(storageKey) || fallback
  } catch {
    return fallback
  }
}

function disableTransitionsTemporarily() {
  const style = document.createElement('style')
  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;transition:none!important}',
    ),
  )
  document.head.appendChild(style)

  window.getComputedStyle(document.body)
  window.setTimeout(() => {
    document.head.removeChild(style)
  }, 1)
}

export function ThemeProvider({
  attribute = 'data-theme',
  children,
  defaultTheme,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  storageKey = 'theme',
  themes = DEFAULT_THEMES,
  value,
}: ThemeProviderProps) {
  const fallbackTheme = defaultTheme ?? (enableSystem ? 'system' : 'light')
  const [theme, setThemeState] = React.useState<ThemeName>(() => getStoredTheme(storageKey, fallbackTheme))
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>(() => getSystemTheme())

  const resolvedTheme = theme === 'system' && enableSystem ? systemTheme : theme

  const applyTheme = React.useCallback(
    (themeToApply: ThemeName) => {
      if (typeof document === 'undefined') return

      const root = document.documentElement
      const nextTheme = themeToApply === 'system' && enableSystem ? getSystemTheme() : themeToApply
      const nextValue = value?.[nextTheme] ?? nextTheme
      const attributes = Array.isArray(attribute) ? attribute : [attribute]
      const themeValues = Array.from(new Set(themes.map((name) => value?.[name] ?? name)))

      if (disableTransitionOnChange) {
        disableTransitionsTemporarily()
      }

      for (const item of attributes) {
        if (item === 'class') {
          root.classList.remove(...themeValues)
          if (nextValue) root.classList.add(nextValue)
        } else if (nextValue) {
          root.setAttribute(item, nextValue)
        } else {
          root.removeAttribute(item)
        }
      }

      if (enableColorScheme && (nextTheme === 'light' || nextTheme === 'dark')) {
        root.style.colorScheme = nextTheme
      }
    },
    [attribute, disableTransitionOnChange, enableColorScheme, enableSystem, themes, value],
  )

  React.useEffect(() => {
    if (!enableSystem) return

    const media = window.matchMedia(THEME_QUERY)
    const onChange = () => setSystemTheme(getSystemTheme())

    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [enableSystem])

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      setThemeState(event.newValue || fallbackTheme)
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [fallbackTheme, storageKey])

  React.useEffect(() => {
    applyTheme(forcedTheme ?? theme)
  }, [applyTheme, forcedTheme, theme, systemTheme])

  const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<ThemeName>>>(
    (nextTheme) => {
      setThemeState((currentTheme) => {
        const resolvedNextTheme = typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme

        try {
          window.localStorage.setItem(storageKey, resolvedNextTheme)
        } catch {
          // Theme persistence is optional; the UI can still switch for the session.
        }

        return resolvedNextTheme
      })
    },
    [storageKey],
  )

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme: enableSystem ? systemTheme : undefined,
      theme,
      themes: enableSystem ? [...themes, 'system'] : themes,
    }),
    [enableSystem, forcedTheme, resolvedTheme, setTheme, systemTheme, theme, themes],
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return React.useContext(ThemeContext)
}
