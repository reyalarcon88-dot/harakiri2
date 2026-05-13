import en from '@/locales/en.json'
import es from '@/locales/es.json'

export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_STORAGE_KEY = 'rmc-ui-locale'

export const MESSAGES = {
  en,
  es: es as Record<keyof typeof en, string>,
} as const

export type MessageKey = keyof typeof en

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && LOCALES.includes(value as Locale)
}

export function formatMessage(
  template: string,
  values?: Record<string, string | number>
) {
  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    const value = values[key]
    return value == null ? `{${key}}` : String(value)
  })
}

export function getMessage(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, string | number>
) {
  const message = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key
  return formatMessage(message, values)
}
