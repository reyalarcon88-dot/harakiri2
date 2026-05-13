'use client'

import { useI18n } from '@/components/layout/I18nProvider'
import { Badge } from '@/components/ui/badge'
import type { MessageKey } from '@/lib/i18n/messages'
import type { LucideIcon } from 'lucide-react'
import { CalendarClock, ClipboardList, Clock, Truck, CheckCircle, XCircle } from 'lucide-react'

type ProjectStatus = 'planned' | 'scheduled' | 'in_progress' | 'dispatched' | 'finished' | 'cancelled'

interface StatusConfig {
  labelKey: MessageKey
  className: string
  icon?: LucideIcon
}

const statusConfig: Record<ProjectStatus, StatusConfig> = {
  planned: {
    labelKey: 'status.project.planned',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: ClipboardList,
  },
  scheduled: {
    labelKey: 'status.project.scheduled',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: CalendarClock,
  },
  in_progress: {
    labelKey: 'status.project.inProgress',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: Clock,
  },
  dispatched: {
    labelKey: 'status.project.dispatched',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: Truck,
  },
  finished: {
    labelKey: 'status.project.finished',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle,
  },
  cancelled: {
    labelKey: 'status.project.cancelled',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: XCircle,
  },
}

interface ProjectStatusBadgeProps {
  status: string
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const { t } = useI18n()
  const config = statusConfig[status as ProjectStatus] ?? statusConfig.planned
  const Icon = config.icon
  const label = t(config.labelKey)

  return (
    <Badge
      variant="outline"
      className={`max-w-full ${config.className}`}
      title={label}
      aria-label={label}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{label}</span>
    </Badge>
  )
}
