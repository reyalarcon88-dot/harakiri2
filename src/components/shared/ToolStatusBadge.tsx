'use client'

import { Badge } from '@/components/ui/badge'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, UserCheck, GitMerge, Wrench, AlertTriangle, SearchX, Archive } from 'lucide-react'

type ToolStatus = 'available' | 'assigned' | 'partial' | 'maintenance' | 'damaged' | 'lost' | 'retired'

interface StatusConfig { label: string; className: string; icon: LucideIcon }

const toolStatusConfig: Record<ToolStatus, StatusConfig> = {
  available:   { label: 'Disponible',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2  },
  assigned:    { label: 'Asignada',      className: 'bg-sky-50 text-sky-700 border-sky-200',             icon: UserCheck     },
  partial:     { label: 'Parcial',       className: 'bg-amber-50 text-amber-700 border-amber-200',       icon: GitMerge      },
  maintenance: { label: 'Mantenimiento', className: 'bg-amber-100 text-amber-800 border-amber-300',      icon: Wrench        },
  damaged:     { label: 'Dañada',        className: 'bg-rose-50 text-rose-700 border-rose-200',          icon: AlertTriangle },
  lost:        { label: 'Perdida',       className: 'bg-rose-100 text-rose-800 border-rose-300',         icon: SearchX       },
  retired:     { label: 'Retirada',      className: 'bg-muted text-muted-foreground border-border',      icon: Archive       },
}

export function ToolStatusBadge({ status }: { status: string }) {
  const config = toolStatusConfig[status as ToolStatus] ?? toolStatusConfig.available
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{config.label}</span>
    </Badge>
  )
}
