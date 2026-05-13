import type { Locale } from '@/lib/i18n/messages'

type DateLike = Date | string | number | null | undefined

export const DEFAULT_CURRENCY = 'MXN'

const INTL_LOCALE_BY_APP_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-MX',
}

function coerceNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

function toDate(value: DateLike) {
  if (value == null || value === '') return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const normalized = String(value)
  const date = normalized.includes('T')
    ? new Date(normalized)
    : new Date(`${normalized}T12:00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

export function getIntlLocale(locale: Locale) {
  return INTL_LOCALE_BY_APP_LOCALE[locale]
}

export function formatLocaleNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(getIntlLocale(locale), options).format(coerceNumber(value))
}

export function formatLocaleInteger(locale: Locale, value: number) {
  return formatLocaleNumber(locale, value, {
    maximumFractionDigits: 0,
  })
}

export function formatLocaleCurrency(
  locale: Locale,
  value: number,
  currency = DEFAULT_CURRENCY,
  options?: Intl.NumberFormatOptions
) {
  return formatLocaleNumber(locale, value, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  })
}

export function formatLocaleDate(
  locale: Locale,
  value: DateLike,
  options?: Intl.DateTimeFormatOptions
) {
  const date = toDate(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date)
}

export function formatLocaleDateTime(
  locale: Locale,
  value: DateLike,
  options?: Intl.DateTimeFormatOptions
) {
  const date = toDate(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date)
}
