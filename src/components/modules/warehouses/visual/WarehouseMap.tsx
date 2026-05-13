'use client'

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2, Minus, Move, Plus, RotateCcw } from 'lucide-react'
import { RackBlock } from './RackBlock'
import { getRackNodeKey } from './utils'
import type { VisualRackNode, WarehouseBlueprint } from './types'

interface WarehouseMapProps {
  blueprint: WarehouseBlueprint
  nodes: VisualRackNode[]
  selectedRackKey: string | null
  highlightedRackKey: string | null
  zoom: number
  onZoomChange: (zoom: number) => void
  onResetZoom: () => void
  onRackSelect: (node: VisualRackNode) => void
  isLayoutEditMode?: boolean
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onRackMove?: (node: VisualRackNode, x: number, y: number) => void
  mapViewportRef: React.RefObject<HTMLDivElement | null>
  registerRackRef: (nodeKey: string, element: HTMLButtonElement | null) => void
}

export function WarehouseMap({
  blueprint,
  nodes,
  selectedRackKey,
  highlightedRackKey,
  zoom,
  onZoomChange,
  onResetZoom,
  onRackSelect,
  isLayoutEditMode = false,
  isFullscreen = false,
  onToggleFullscreen,
  onRackMove,
  mapViewportRef,
  registerRackRef,
}: WarehouseMapProps) {
  const { t } = useI18n()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [dragState, setDragState] = useState<{
    nodeKey: string
    offsetX: number
    offsetY: number
  } | null>(null)

  useEffect(() => {
    if (!dragState) return
    const activeDrag = dragState

    function handlePointerMove(event: PointerEvent) {
      const stage = stageRef.current
      if (!stage) return

      const node = nodes.find((item) => getRackNodeKey(item) === activeDrag.nodeKey)
      if (!node || !node.rack) return

      const rect = stage.getBoundingClientRect()
      const nextX = (event.clientX - rect.left) / zoom - activeDrag.offsetX
      const nextY = (event.clientY - rect.top) / zoom - activeDrag.offsetY
      onRackMove?.(node, nextX, nextY)
    }

    function handlePointerUp() {
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, nodes, onRackMove, zoom])

  function handleRackMoveStart(event: React.PointerEvent<HTMLButtonElement>, node: VisualRackNode) {
    if (!isLayoutEditMode || !node.rack) return
    const stage = stageRef.current
    if (!stage) return

    event.preventDefault()
    event.stopPropagation()
    onRackSelect(node)

    const rect = stage.getBoundingClientRect()
    setDragState({
      nodeKey: getRackNodeKey(node),
      offsetX: (event.clientX - rect.left) / zoom - node.slot.x,
      offsetY: (event.clientY - rect.top) / zoom - node.slot.y,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-100">{t('warehouses.visual.aerialView')}</p>
          <p className="text-xs text-slate-400">{t('warehouses.visual.aerialDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLayoutEditMode ? (
            <div className="hidden items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100 md:flex">
              <Move className="h-3.5 w-3.5" />
              {t('warehouses.visual.dragHint')}
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
            onClick={() => onZoomChange(Math.max(0.7, Number((zoom - 0.1).toFixed(2))))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="min-w-16 text-center text-xs text-slate-300">{Math.round(zoom * 100)}%</div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
            onClick={() => onZoomChange(Math.min(1.5, Number((zoom + 0.1).toFixed(2))))}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
            onClick={onResetZoom}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('warehouses.visual.reset')}
          </Button>
          {onToggleFullscreen ? (
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="mr-2 h-4 w-4" />
              ) : (
                <Maximize2 className="mr-2 h-4 w-4" />
              )}
              {isFullscreen ? t('warehouses.visual.exitFullscreen') : t('warehouses.visual.fullscreen')}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        ref={mapViewportRef}
        className="overflow-auto rounded-lg border border-slate-800 bg-[#060b15]"
      >
        <div
          style={{
            width: blueprint.canvas.width * zoom,
            height: blueprint.canvas.height * zoom,
          }}
        >
          <div
            ref={stageRef}
            className="relative"
            style={{
              width: blueprint.canvas.width,
              height: blueprint.canvas.height,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          >
            <div className="absolute inset-6 rounded-xl border border-white/12" />
            <div className="absolute inset-x-20 top-[350px] border-t border-dashed border-cyan-400/16" />
            <div className="absolute left-6 top-6 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60">
              {t('warehouses.visual.layoutBadge')}
            </div>

            {blueprint.annotations?.map((annotation) => (
              <div
                key={`${annotation.label}-${annotation.x}-${annotation.y}`}
                className="absolute text-[11px] uppercase tracking-[0.18em] text-white/35"
                style={{ left: annotation.x, top: annotation.y }}
              >
                {annotation.label}
              </div>
            ))}

            {nodes.map((node) => {
              const nodeKey = getRackNodeKey(node)
              return (
                <RackBlock
                  key={nodeKey}
                  node={node}
                  isSelected={selectedRackKey === nodeKey}
                  isHighlighted={highlightedRackKey === nodeKey}
                  isLayoutEditMode={isLayoutEditMode}
                  onClick={onRackSelect}
                  onMoveStart={handleRackMoveStart}
                  registerRef={(element) => registerRackRef(nodeKey, element)}
                />
              )
            })}

            <div className="absolute bottom-6 left-6 flex items-center gap-4 rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                {t('warehouses.visual.legendWithInventory')}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                {t('warehouses.visual.legendLowOccupancy')}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                {t('warehouses.visual.legendNoData')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
