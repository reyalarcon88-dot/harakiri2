'use client'

import { useI18n } from '@/components/layout/I18nProvider'
import { Badge } from '@/components/ui/badge'
import type { MessageKey } from '@/lib/i18n/messages'
import type { LucideIcon } from 'lucide-react'
import { ShoppingCart, Clock, PackageCheck, XCircle } from 'lucide-react'

type PurchaseStatus = 'pedido' | 'pending' | 'received' | 'cancelled'

interface StatusConfig {
  labelKey: MessageKey
  className: string
  icon?: LucideIcon
}

const statusConfig: Record<PurchaseStatus, StatusConfig> = {
  pedido: {
    labelKey: 'status.purchase.pedido',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: ShoppingCart,
  },
  pending: {
    labelKey: 'status.purchase.pending',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock,
  },
  received: {
    labelKey: 'status.purchase.received',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: PackageCheck,
  },
  cancelled: {
    labelKey: 'status.purchase.cancelled',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: XCircle,
  },
}

interface PurchaseStatusBadgeProps {
  status: string
}

export function PurchaseStatusBadge({ status }: PurchaseStatusBadgeProps) {
  const { t } = useI18n()
  const config = statusConfig[status as PurchaseStatus] ?? statusConfig.pending
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
