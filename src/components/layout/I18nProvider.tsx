'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  DEFAULT_LOCALE,
  getMessage,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
  type MessageKey,
} from '@/lib/i18n/messages'

type TranslateValues = Record<string, string | number>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, values?: TranslateValues) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)
const LOCALE_CHANGE_EVENT = 'rmc-ui-locale-change'

function getLocaleSnapshot(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return isLocale(savedLocale) ? savedLocale : DEFAULT_LOCALE
}

function subscribeLocaleStore(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleChange = () => onStoreChange()

  window.addEventListener('storage', handleChange)
  window.addEventListener(LOCALE_CHANGE_EVENT, handleChange)

  return () => {
    window.removeEventListener('storage', handleChange)
    window.removeEventListener(LOCALE_CHANGE_EVENT, handleChange)
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeLocaleStore,
    getLocaleSnapshot,
    () => DEFAULT_LOCALE
  )

  const setLocale = useCallback((nextLocale: Locale) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => getMessage(locale, key, values),
    }),
    [locale, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}
