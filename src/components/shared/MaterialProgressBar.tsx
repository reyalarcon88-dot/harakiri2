'use client'

import { useI18n } from '@/components/layout/I18nProvider'
import { Progress } from '@/components/ui/progress'
import { formatLocaleInteger } from '@/lib/i18n/format'
import { getEffectiveDispatchedQuantity, getMaterialProgressPercentage } from '@/lib/project-material-progress'
import { cn } from '@/lib/utils'

interface MaterialProgressBarProps {
  dispatched: number
  planned: number
  className?: string
}

export function MaterialProgressBar({
  dispatched,
  planned,
  className,
}: MaterialProgressBarProps) {
  const { locale, t } = useI18n()
  const effectiveDispatched = getEffectiveDispatchedQuantity(planned, dispatched)
  const percentage = getMaterialProgressPercentage(planned, dispatched)

  const getBarColor = () => {
    if (percentage === 100) return '[&>div]:bg-emerald-500'
    if (percentage >= 75) return '[&>div]:bg-amber-500'
    if (percentage >= 50) return '[&>div]:bg-orange-500'
    return '[&>div]:bg-rose-500'
  }

  return (
    <div
      className={cn('flex min-w-0 items-center gap-3', className)}
      aria-label={t('shared.materialProgressLabel', {
        dispatched: formatLocaleInteger(locale, effectiveDispatched),
        planned: formatLocaleInteger(locale, planned),
        percentage,
      })}
      title={t('shared.materialProgressLabel', {
        dispatched: formatLocaleInteger(locale, effectiveDispatched),
        planned: formatLocaleInteger(locale, planned),
        percentage,
      })}
    >
      <Progress value={percentage} className={cn('h-2 min-w-0 flex-1', getBarColor())} />
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground whitespace-nowrap">
        {formatLocaleInteger(locale, effectiveDispatched)}/{formatLocaleInteger(locale, planned)} ({percentage}%)
      </span>
    </div>
  )
}
