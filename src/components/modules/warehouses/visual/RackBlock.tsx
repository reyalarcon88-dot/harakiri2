'use client'

import type React from 'react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { MessageKey } from '@/lib/i18n/messages'
import { cn } from '@/lib/utils'
import { getRackNodeKey, getRackTone } from './utils'
import type { VisualRackNode } from './types'

interface RackBlockProps {
  node: VisualRackNode
  isSelected: boolean
  isHighlighted: boolean
  isLayoutEditMode?: boolean
  onClick: (node: VisualRackNode) => void
  onMoveStart?: (event: React.PointerEvent<HTMLButtonElement>, node: VisualRackNode) => void
  registerRef?: (element: HTMLButtonElement | null) => void
}

type TranslateFn = (key: MessageKey, values?: Record<string, string | number>) => string

function getMappingBadge(node: VisualRackNode, t: TranslateFn) {
  switch (node.mappingMode) {
    case 'auto':
      return t('warehouses.visual.mappingBadgeAuto')
    case 'overflow':
      return t('warehouses.visual.mappingBadgeExtra')
    case 'alias':
      return t('warehouses.visual.mappingBadgeName')
    default:
      return null
  }
}

function getMappingDescription(
  node: VisualRackNode,
  t: TranslateFn
) {
  switch (node.mappingMode) {
    case 'alias':
      return node.matchedAlias
        ? t('warehouses.visual.mappingByName', { alias: node.matchedAlias })
        : t('warehouses.visual.mappingByRackName')
    case 'auto':
      return t('warehouses.visual.mappingAuto')
    case 'overflow':
      return t('warehouses.visual.mappingOverflow')
    default:
      return t('warehouses.visual.mappingEmpty')
  }
}

const toneClasses = {
  empty:
    'border-white/18 bg-slate-950/45 text-slate-200 hover:border-slate-300/35 hover:bg-slate-900/70',
  partial:
    'border-amber-400/45 bg-amber-500/10 text-amber-50 hover:border-amber-300/65 hover:bg-amber-400/16',
  full:
    'border-emerald-400/55 bg-emerald-500/12 text-emerald-50 hover:border-emerald-300/80 hover:bg-emerald-400/16',
} as const

export function RackBlock({
  node,
  isSelected,
  isHighlighted,
  isLayoutEditMode = false,
  onClick,
  onMoveStart,
  registerRef,
}: RackBlockProps) {
  const { t } = useI18n()
  const tone = getRackTone(node)
  const hasData = Boolean(node.rack)
  const nodeKey = getRackNodeKey(node)
  const mappingBadge = getMappingBadge(node, t)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={registerRef}
          type="button"
          data-node-key={nodeKey}
          onClick={() => onClick(node)}
          onPointerDown={(event) => {
            if (!isLayoutEditMode || !node.rack) return
            onMoveStart?.(event, node)
          }}
          className={cn(
            'absolute flex min-w-0 flex-col justify-between rounded-md border px-3 py-2 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200',
            toneClasses[tone],
            !hasData && 'border-dashed',
            isLayoutEditMode && hasData && 'cursor-grab active:cursor-grabbing',
            isSelected && 'border-cyan-300 bg-cyan-400/14 shadow-[0_0_0_1px_rgba(103,232,249,0.5),0_0_30px_rgba(34,211,238,0.18)]',
            isHighlighted &&
              'border-emerald-300 bg-emerald-400/16 shadow-[0_0_0_1px_rgba(74,222,128,0.5),0_0_36px_rgba(74,222,128,0.22)]'
          )}
          style={{
            left: node.slot.x,
            top: node.slot.y,
            width: node.slot.width,
            height: node.slot.height,
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{node.slot.displayName}</span>
              <div className="flex items-center gap-1">
                <span className="rounded-sm border border-white/12 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/70">
                  {node.slot.rackType === 'double'
                    ? t('warehouses.visual.doubleSidedRack')
                    : t('warehouses.visual.wallRack')}
                </span>
                {mappingBadge ? (
                  <span className="rounded-sm border border-white/12 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/70">
                    {mappingBadge}
                  </span>
                ) : null}
              </div>
            </div>
            <p className="truncate text-[11px] text-white/65">
              {node.rack?.description || getMappingDescription(node, t)}
            </p>
          </div>

          <div className="flex items-end justify-between gap-2 text-[11px] text-white/72">
            <span>{t('warehouses.visual.materialsCount', { count: node.totalSkus })}</span>
            <span>{t('warehouses.visual.piecesCount', { count: node.totalUnits })}</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-xs bg-slate-900 text-slate-100">
        <div className="space-y-1">
          <p className="font-medium">{node.slot.displayName}</p>
          <p className="text-slate-300">
            {hasData
              ? t('warehouses.visual.materialsAndPieces', {
                  materials: node.totalSkus,
                  pieces: node.totalUnits,
                })
              : t('warehouses.visual.noDataLoaded')}
          </p>
          <p className="text-slate-400">
            {node.slot.rackType === 'double'
              ? t('warehouses.visual.doubleSidedRack')
              : t('warehouses.visual.wallRack')}
          </p>
          <p className="text-slate-400">{getMappingDescription(node, t)}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
