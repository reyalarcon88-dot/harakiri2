'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/layout/I18nProvider'
import type { Locale } from '@/lib/i18n/messages'

interface LanguageToggleProps {
  className?: string
}

function LanguageButton({
  active,
  label,
  locale,
  onChange,
}: {
  active: boolean
  label: string
  locale: Locale
  onChange: (locale: Locale) => void
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-9 min-w-11 px-3 font-semibold"
      onClick={() => onChange(locale)}
    >
      {label}
    </Button>
  )
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="group"
      aria-label={t('language.switcher')}
      title={t('language.switcher')}
    >
      <LanguageButton
        active={locale === 'en'}
        label={t('language.enShort')}
        locale="en"
        onChange={setLocale}
      />
      <LanguageButton
        active={locale === 'es'}
        label={t('language.esShort')}
        locale="es"
        onChange={setLocale}
      />
    </div>
  )
}
