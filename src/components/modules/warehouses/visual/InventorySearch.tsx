'use client'

import { Search, X } from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { getSideLabelKey } from './utils'
import type { MaterialSearchHit } from './types'

interface InventorySearchProps {
  query: string
  results: MaterialSearchHit[]
  activeHitKey: string | null
  onQueryChange: (value: string) => void
  onPick: (hit: MaterialSearchHit) => void
  onClear: () => void
}

export function InventorySearch({
  query,
  results,
  activeHitKey,
  onQueryChange,
  onPick,
  onClear,
}: InventorySearchProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results[0]) {
                event.preventDefault()
                onPick(results[0])
              }
            }}
            placeholder={t('warehouses.visual.searchPlaceholder')}
            className="border-slate-700 bg-slate-950/70 pl-9 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900"
          onClick={onClear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {query.trim() ? (
        <div className="rounded-md border border-slate-800 bg-slate-950/60">
          <ScrollArea className="max-h-72">
            <div className="space-y-1 p-2">
              {results.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-400">
                  {t('warehouses.visual.noMatches')}
                </div>
              ) : (
                results.slice(0, 10).map((hit) => (
                  <button
                    key={hit.key}
                    type="button"
                    onClick={() => onPick(hit)}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-md border border-transparent px-3 py-2 text-left transition hover:border-cyan-300/35 hover:bg-slate-900',
                      activeHitKey === hit.key && 'border-emerald-300/45 bg-emerald-400/10'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-slate-100">
                        {hit.productName}
                      </span>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-slate-300">{hit.productCode}</div>
                        {hit.productFamily ? (
                          <div className="text-[11px] text-slate-500">{hit.productFamily}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{hit.rack.name}</span>
                      <span>{hit.shelf.name}</span>
                      <span>{t(getSideLabelKey(hit.placement.side))}</span>
                      <span>{t('warehouses.visual.piecesCount', { count: hit.quantity })}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  )
}
