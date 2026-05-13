'use client'

import { ArrowLeft, Package, ScanSearch } from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { VisualRackNode } from './types'
import { buildRackPlacementMap, getPlacementKey, getSideLabelKey } from './utils'
import { ShelfComponent } from './ShelfComponent'

interface RackDetailViewProps {
  node: VisualRackNode | null
  selectedShelfId: string | null
  highlightedShelfId: string | null
  onShelfSelect: (shelfId: string | null) => void
  onBack: () => void
}

const LEVELS = [7, 6, 5, 4, 3, 2, 1]

export function RackDetailView({
  node,
  selectedShelfId,
  highlightedShelfId,
  onShelfSelect,
  onBack,
}: RackDetailViewProps) {
  const { t } = useI18n()

  if (!node) {
    return (
      <div className="flex h-full min-h-[720px] items-center justify-center rounded-xl border border-slate-800 bg-[#0b1220] p-8 text-center text-slate-400">
        <div className="space-y-3">
          <ScanSearch className="mx-auto h-10 w-10 text-slate-500" />
          <p className="text-sm font-medium text-slate-200">{t('warehouses.visual.sideDetailPlaceholderTitle')}</p>
          <p className="text-sm text-slate-400">{t('warehouses.visual.sideDetailPlaceholderDescription')}</p>
        </div>
      </div>
    )
  }

  if (!node.rack) {
    return (
      <div className="flex h-full min-h-[720px] flex-col rounded-xl border border-slate-800 bg-[#0b1220] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-100">{node.slot.displayName}</p>
            <p className="text-sm text-slate-400">{t('warehouses.visual.noInventoryLinked')}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 bg-slate-950/60 text-slate-100 hover:bg-slate-900"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('warehouses.visual.back')}
          </Button>
        </div>
      </div>
    )
  }

  const placementMap = buildRackPlacementMap(node.rack, node.slot.rackType)
  const inferredShelves = Array.from(placementMap.values())
    .flat()
    .filter((entry) => entry.placement.source === 'fallback').length
  const selectedEntry =
    Array.from(placementMap.values())
      .flat()
      .find((entry) => entry.shelf.id === selectedShelfId) ??
    Array.from(placementMap.values())
      .flat()
      .find((entry) => entry.shelf.id === highlightedShelfId) ??
    null

  return (
    <div className="flex h-full min-h-[720px] flex-col rounded-xl border border-slate-800 bg-[#0b1220]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-slate-100">{node.rack.name}</p>
          <p className="text-sm text-slate-400">
            {node.slot.rackType === 'double'
              ? t('warehouses.visual.doubleSidedRack')
              : t('warehouses.visual.wallRack')}
          </p>
          {node.mappingMode === 'auto' ? (
            <p className="text-xs text-cyan-300/90">
              {t('warehouses.visual.autoRackNotice')}
            </p>
          ) : null}
          {node.mappingMode === 'overflow' ? (
            <p className="text-xs text-amber-300/90">
              {t('warehouses.visual.overflowRackNotice')}
            </p>
          ) : null}
          {inferredShelves > 0 ? (
            <p className="text-xs text-amber-300/90">
              {t('warehouses.visual.inferredShelves', { count: inferredShelves })}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 bg-slate-950/60 text-slate-100 hover:bg-slate-900"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('warehouses.visual.back')}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-5 xl:grid-rows-[minmax(0,1fr)_260px]">
        <div className="min-h-0 rounded-lg border border-slate-800 bg-slate-950/55 p-4">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
            <span>{t('warehouses.visual.sideView')}</span>
            <span>{t('warehouses.visual.levels')}</span>
          </div>

          <ScrollArea className="h-[430px]">
            <div className="space-y-3 pr-3">
              {node.slot.rackType === 'double' ? (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] items-center gap-3 px-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <span>{t('warehouses.visual.left')}</span>
                    <span className="text-center">{t('warehouses.visual.level')}</span>
                    <span className="text-right">{t('warehouses.visual.right')}</span>
                  </div>
                  {LEVELS.map((level) => {
                    const leftEntries = placementMap.get(getPlacementKey({ level, side: 'left', source: 'fallback' })) ?? []
                    const rightEntries = placementMap.get(getPlacementKey({ level, side: 'right', source: 'fallback' })) ?? []

                    return (
                      <div
                        key={`double-${level}`}
                        className="grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] items-stretch gap-3"
                      >
                        <ShelfComponent
                          label={t('warehouses.visual.shelfLeftLabel', { level })}
                          entries={leftEntries}
                          selectedShelfId={selectedShelfId}
                          highlightedShelfId={highlightedShelfId}
                          onSelect={onShelfSelect}
                        />
                        <div className="flex items-center justify-center rounded-md border border-slate-800 bg-slate-900/75 text-sm font-semibold text-slate-200">
                          {level}
                        </div>
                        <ShelfComponent
                          label={`Shelf ${level}R`}
                          entries={rightEntries}
                          selectedShelfId={selectedShelfId}
                          highlightedShelfId={highlightedShelfId}
                          onSelect={onShelfSelect}
                        />
                      </div>
                    )
                  })}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 px-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <span className="text-center">{t('warehouses.visual.level')}</span>
                    <span>{t('warehouses.visual.front')}</span>
                  </div>
                  {LEVELS.map((level) => {
                    const entries = placementMap.get(
                      getPlacementKey({ level, side: 'single', source: 'fallback' })
                    ) ?? []

                    return (
                      <div
                        key={`single-${level}`}
                        className="grid grid-cols-[76px_minmax(0,1fr)] items-stretch gap-3"
                      >
                        <div className="flex items-center justify-center rounded-md border border-slate-800 bg-slate-900/75 text-sm font-semibold text-slate-200">
                          {level}
                        </div>
                        <ShelfComponent
                          label={t('warehouses.visual.shelfLabel', { level })}
                          entries={entries}
                          selectedShelfId={selectedShelfId}
                          highlightedShelfId={highlightedShelfId}
                          onSelect={onShelfSelect}
                        />
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-100">
            <Package className="h-4 w-4 text-emerald-400" />
            <p className="font-medium">{t('warehouses.visual.shelfContents')}</p>
          </div>

          {selectedEntry ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-800 bg-slate-900/65 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{selectedEntry.shelf.name}</p>
                    <p className="text-xs text-slate-400">
                      {t('warehouses.visual.levelPosition', {
                        level: selectedEntry.placement.level,
                        side: t(getSideLabelKey(selectedEntry.placement.side)),
                      })}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {t('warehouses.visual.materialsCount', {
                      count: selectedEntry.shelf.productStocks.length,
                    })}
                  </p>
                </div>
              </div>
              <Separator className="bg-slate-800" />
              {selectedEntry.placement.source === 'fallback' ? (
                <div className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  {t('warehouses.visual.inferredPositionNotice')}
                </div>
              ) : null}
              <ScrollArea className="h-[150px]">
                <div className="space-y-2 pr-3">
                  {selectedEntry.shelf.productStocks.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-400">
                      {t('warehouses.visual.noMaterialInShelf')}
                    </div>
                  ) : (
                    selectedEntry.shelf.productStocks.map((stock) => (
                      <div
                        key={stock.id}
                        className={cn(
                          'rounded-md border border-slate-800 bg-slate-900/72 px-3 py-2',
                          stock.quantity > 0 && 'border-emerald-500/25'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">
                              {stock.product.name}
                            </p>
                            <p className="text-xs text-slate-400">{stock.product.code}</p>
                          </div>
                          <div className="shrink-0 text-right text-sm font-semibold text-emerald-300">
                            {stock.quantity}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              {t('warehouses.visual.selectShelf')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
