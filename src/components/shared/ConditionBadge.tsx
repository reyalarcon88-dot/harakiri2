'use client'

import { Badge } from '@/components/ui/badge'
import type { LucideIcon } from 'lucide-react'
import { ThumbsUp, Minus, AlertOctagon } from 'lucide-react'

type ToolCondition = 'good' | 'fair' | 'damaged'

interface ConditionConfig { label: string; className: string; icon: LucideIcon }

const conditionConfig: Record<ToolCondition, ConditionConfig> = {
  good:    { label: 'Buena',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ThumbsUp     },
  fair:    { label: 'Regular', className: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Minus        },
  damaged: { label: 'Dañada',  className: 'bg-rose-50 text-rose-700 border-rose-200',          icon: AlertOctagon },
}

export function ConditionBadge({ condition }: { condition: string }) {
  const config = conditionConfig[condition as ToolCondition] ?? conditionConfig.good
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{config.label}</span>
    </Badge>
  )
}
