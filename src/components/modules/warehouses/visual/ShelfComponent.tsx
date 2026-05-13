'use client'

import { useI18n } from '@/components/layout/I18nProvider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { RackShelfPlacementEntry } from './types'
import { getActivePlacementEntry } from './utils'

interface ShelfComponentProps {
  label: string
  entries: RackShelfPlacementEntry[]
  selectedShelfId: string | null
  highlightedShelfId: string | null
  onSelect: (shelfId: string | null) => void
}

export function ShelfComponent({
  label,
  entries,
  selectedShelfId,
  highlightedShelfId,
  onSelect,
}: ShelfComponentProps) {
  const { t } = useI18n()
  const activeEntry = getActivePlacementEntry(entries, selectedShelfId)
  const isSelected = entries.some((entry) => entry.shelf.id === selectedShelfId)
  const isHighlighted = entries.some((entry) => entry.shelf.id === highlightedShelfId)
  const totalUnits = entries.reduce(
    (sum, entry) =>
      sum + entry.shelf.productStocks.reduce((stockSum, stock) => stockSum + stock.quantity, 0),
    0
  )
  const totalSkus = entries.reduce((sum, entry) => sum + entry.shelf.productStocks.length, 0)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(activeEntry?.shelf.id ?? null)}
          className={cn(
            'flex min-h-16 min-w-0 flex-col justify-between rounded-md border px-3 py-2 text-left transition-all',
            entries.length === 0
              ? 'cursor-default border-white/10 bg-slate-900/40 text-slate-500'
              : 'border-slate-700 bg-slate-900/72 text-slate-100 hover:border-cyan-300/55 hover:bg-slate-900',
            isSelected && 'border-cyan-300 bg-cyan-400/12 shadow-[0_0_0_1px_rgba(103,232,249,0.35)]',
            isHighlighted &&
              'border-emerald-300 bg-emerald-400/14 shadow-[0_0_0_1px_rgba(74,222,128,0.45),0_0_22px_rgba(74,222,128,0.14)]'
          )}
          disabled={entries.length === 0}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {activeEntry?.shelf.name ?? label}
              </span>
              {entries.length > 1 && (
                <span className="rounded-sm border border-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                  +{entries.length - 1}
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-slate-400">
              {activeEntry?.shelf.description || t('warehouses.visual.sourceShelfFree')}
            </p>
          </div>
          <div className="flex items-end justify-between gap-2 text-[11px] text-slate-300">
            <span>{t('warehouses.visual.materialsCount', { count: totalSkus })}</span>
            <span>{t('warehouses.visual.piecesCount', { count: totalUnits })}</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-xs bg-slate-900 text-slate-100">
        <div className="space-y-1">
          <p className="font-medium">{activeEntry?.shelf.name ?? label}</p>
          <p className="text-slate-300">
            {entries.length > 0
              ? t('warehouses.visual.materialsAndPieces', {
                  materials: totalSkus,
                  pieces: totalUnits,
                })
              : t('warehouses.visual.noMaterial')}
          </p>
          {activeEntry?.shelf.productStocks.slice(0, 3).map((stock) => (
            <p key={stock.id} className="truncate text-slate-400">
              {stock.product.name} ({stock.quantity})
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
