'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Maximize2, Minus, MoveHorizontal, MoveVertical, Plus, RotateCw, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InventorySearch } from './InventorySearch'
import { RackDetailView } from './RackDetailView'
import { WarehouseMap } from './WarehouseMap'
import { buildVisualRackNodes, getRackNodeKey, getWarehouseBlueprint, searchMaterialHits } from './utils'
import type { MaterialSearchHit, Rack, RackOrientation, RackVisualLayout, VisualRackNode, Warehouse } from './types'

interface WarehouseVisualViewProps {
  warehouses: Warehouse[]
  isLoading: boolean
}

const LAYOUT_STORAGE_PREFIX = 'rmc.warehouseVisualLayout.'

const COMPACT_RACK_SIZE = {
  single: {
    horizontal: { width: 148, height: 58 },
    vertical: { width: 58, height: 148 },
  },
  double: {
    horizontal: { width: 166, height: 68 },
    vertical: { width: 68, height: 166 },
  },
} as const

const RACK_SIZE_LIMITS = {
  minWidth: 44,
  maxWidth: 260,
  minHeight: 36,
  maxHeight: 260,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getSlotOrientation(node: VisualRackNode): RackOrientation {
  return node.slot.width >= node.slot.height ? 'horizontal' : 'vertical'
}

function getRackDimensions(node: VisualRackNode, orientation: RackOrientation) {
  return COMPACT_RACK_SIZE[node.slot.rackType][orientation]
}

function getRackLayoutDimensions(node: VisualRackNode, layout: RackVisualLayout | undefined) {
  const orientation = layout?.orientation ?? getSlotOrientation(node)
  const baseSize = getRackDimensions(node, orientation)

  return {
    width: clamp(layout?.width ?? baseSize.width, RACK_SIZE_LIMITS.minWidth, RACK_SIZE_LIMITS.maxWidth),
    height: clamp(layout?.height ?? baseSize.height, RACK_SIZE_LIMITS.minHeight, RACK_SIZE_LIMITS.maxHeight),
  }
}

export function WarehouseVisualView({ warehouses, isLoading }: WarehouseVisualViewProps) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [autoAssignByOrder, setAutoAssignByOrder] = useState(true)
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [newRackName, setNewRackName] = useState('')
  const [rackLayouts, setRackLayouts] = useState<Record<string, RackVisualLayout>>({})
  const [selectedRackKey, setSelectedRackKey] = useState<string | null>(null)
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null)
  const [highlightedRackKey, setHighlightedRackKey] = useState<string | null>(null)
  const [highlightedShelfId, setHighlightedShelfId] = useState<string | null>(null)
  const [activeHitKey, setActiveHitKey] = useState<string | null>(null)

  const mapViewportRef = useRef<HTMLDivElement | null>(null)
  const rackRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const resolvedWarehouseId = useMemo(() => {
    if (selectedWarehouseId && warehouses.some((warehouse) => warehouse.id === selectedWarehouseId)) {
      return selectedWarehouseId
    }
    return warehouses[0]?.id ?? ''
  }, [selectedWarehouseId, warehouses])

  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === resolvedWarehouseId) ?? null

  const createRackMutation = useMutation({
    mutationFn: (data: { warehouseId: string; name: string; description: string }) =>
      fetch('/api/racks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json() as Promise<Rack>
      }),
    onSuccess: (rack) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      setNewRackName('')
      setRackLayouts((current) => ({
        ...current,
        [rack.id]: { x: 80, y: 80, orientation: 'horizontal', width: 148, height: 58 },
      }))
      setSelectedRackKey(rack.id)
      toast.success(t('warehouses.rackCreateSuccess'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteRackMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/racks/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: (_result, rackId) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      setRackLayouts((current) => {
        const next = { ...current }
        delete next[rackId]
        return next
      })
      setSelectedRackKey(null)
      setSelectedShelfId(null)
      toast.success(t('warehouses.rackDeleteSuccess'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const blueprint = useMemo(
    () => getWarehouseBlueprint(selectedWarehouse),
    [selectedWarehouse]
  )

  const visualNodes = useMemo(() => {
    if (!selectedWarehouse) return []

    return buildVisualRackNodes(selectedWarehouse, blueprint, { autoAssignByOrder }).map((node) => {
      if (!node.rack) return node

      const savedLayout = rackLayouts[node.rack.id]
      const orientation = savedLayout?.orientation ?? getSlotOrientation(node)
      const size = getRackLayoutDimensions(node, savedLayout ?? { x: node.slot.x, y: node.slot.y, orientation })

      return {
        ...node,
        slot: {
          ...node.slot,
          displayName: node.rack.name || node.slot.displayName,
          x: savedLayout?.x ?? node.slot.x,
          y: savedLayout?.y ?? node.slot.y,
          width: size.width,
          height: size.height,
        },
      }
    })
  }, [autoAssignByOrder, blueprint, rackLayouts, selectedWarehouse])

  const mappingSummary = useMemo(() => {
    const totalRacks = selectedWarehouse?.racks.length ?? 0

    return {
      totalRacks,
      alias: visualNodes.filter((node) => node.rack && node.mappingMode === 'alias').length,
      auto: visualNodes.filter((node) => node.rack && node.mappingMode === 'auto').length,
      overflow: visualNodes.filter((node) => node.rack && node.mappingMode === 'overflow').length,
      emptySlots: visualNodes.filter((node) => node.mappingMode === 'empty').length,
    }
  }, [selectedWarehouse, visualNodes])

  const searchResults = useMemo(
    () =>
      selectedWarehouse
        ? searchMaterialHits(selectedWarehouse, query, blueprint, visualNodes)
        : [],
    [blueprint, query, selectedWarehouse, visualNodes]
  )

  const activeNode =
    visualNodes.find((node) => getRackNodeKey(node) === selectedRackKey) ??
    visualNodes.find((node) => getRackNodeKey(node) === highlightedRackKey) ??
    null

  useEffect(() => {
    if (!resolvedWarehouseId) {
      setRackLayouts({})
      return
    }

    try {
      const raw = window.localStorage.getItem(`${LAYOUT_STORAGE_PREFIX}${resolvedWarehouseId}`)
      setRackLayouts(raw ? JSON.parse(raw) : {})
    } catch {
      setRackLayouts({})
    }
  }, [resolvedWarehouseId])

  useEffect(() => {
    if (!resolvedWarehouseId) return
    window.localStorage.setItem(
      `${LAYOUT_STORAGE_PREFIX}${resolvedWarehouseId}`,
      JSON.stringify(rackLayouts)
    )
  }, [rackLayouts, resolvedWarehouseId])

  useEffect(() => {
    const nodeKey = selectedRackKey ?? highlightedRackKey
    if (!nodeKey) return

    const element = rackRefs.current[nodeKey]
    if (!element) return

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  }, [highlightedRackKey, selectedRackKey])

  function registerRackRef(nodeKey: string, element: HTMLButtonElement | null) {
    rackRefs.current[nodeKey] = element
  }

  function resetVisualState() {
    setQuery('')
    setZoom(1)
    setSelectedRackKey(null)
    setSelectedShelfId(null)
    setHighlightedRackKey(null)
    setHighlightedShelfId(null)
    setActiveHitKey(null)
  }

  function handleWarehouseChange(nextWarehouseId: string) {
    setSelectedWarehouseId(nextWarehouseId)
    resetVisualState()
  }

  function handleRackSelect(node: VisualRackNode) {
    const nodeKey = getRackNodeKey(node)
    setSelectedRackKey(nodeKey)
    setHighlightedRackKey(nodeKey)
    setActiveHitKey(null)
    setQuery('')
    if (!node.rack) {
      setSelectedShelfId(null)
      setHighlightedShelfId(null)
      return
    }
    setSelectedShelfId(null)
    setHighlightedShelfId(null)
  }

  function handleSearchPick(hit: MaterialSearchHit) {
    setSelectedRackKey(hit.rack.id)
    setHighlightedRackKey(hit.rack.id)
    setSelectedShelfId(hit.shelf.id)
    setHighlightedShelfId(hit.shelf.id)
    setActiveHitKey(hit.key)
  }

  function clearSearchState() {
    setQuery('')
    setActiveHitKey(null)
    setHighlightedRackKey(null)
    setHighlightedShelfId(null)
    setSelectedShelfId(null)
  }

  function updateRackLayout(node: VisualRackNode, updates: Partial<RackVisualLayout>) {
    if (!node.rack) return
    const currentOrientation = rackLayouts[node.rack.id]?.orientation ?? getSlotOrientation(node)
    const orientation = updates.orientation ?? currentOrientation
    const baseSize = getRackDimensions(node, orientation)

    setRackLayouts((current) => {
      const existing = current[node.rack!.id] ?? {
        x: node.slot.x,
        y: node.slot.y,
        orientation,
        width: node.slot.width,
        height: node.slot.height,
      }
      const width = clamp(updates.width ?? existing.width ?? baseSize.width, RACK_SIZE_LIMITS.minWidth, RACK_SIZE_LIMITS.maxWidth)
      const height = clamp(updates.height ?? existing.height ?? baseSize.height, RACK_SIZE_LIMITS.minHeight, RACK_SIZE_LIMITS.maxHeight)

      return {
        ...current,
        [node.rack!.id]: {
          ...existing,
          ...updates,
          orientation,
          width,
          height,
          x: clamp(updates.x ?? existing.x, 12, blueprint.canvas.width - width - 12),
          y: clamp(updates.y ?? existing.y, 12, blueprint.canvas.height - height - 12),
        },
      }
    })
  }

  function handleRackMove(node: VisualRackNode, x: number, y: number) {
    updateRackLayout(node, { x, y })
  }

  function handleRackRotate() {
    if (!activeNode?.rack) return
    const currentOrientation = rackLayouts[activeNode.rack.id]?.orientation ?? getSlotOrientation(activeNode)
    setRackOrientation(currentOrientation === 'horizontal' ? 'vertical' : 'horizontal')
  }

  function setRackOrientation(orientation: RackOrientation) {
    if (!activeNode?.rack) return
    const size = getRackDimensions(activeNode, orientation)
    updateRackLayout(activeNode, {
      orientation,
      width: size.width,
      height: size.height,
    })
  }

  function resizeSelectedRack(widthDelta: number, heightDelta: number) {
    if (!activeNode?.rack) return
    updateRackLayout(activeNode, {
      width: activeNode.slot.width + widthDelta,
      height: activeNode.slot.height + heightDelta,
    })
  }

  function handleAddRack() {
    if (!selectedWarehouse || !newRackName.trim()) return
    createRackMutation.mutate({
      warehouseId: selectedWarehouse.id,
      name: newRackName.trim(),
      description: '',
    })
  }

  function handleDeleteSelectedRack() {
    if (!activeNode?.rack) return
    const confirmed = window.confirm(t('warehouses.visual.deleteRackConfirm', { name: activeNode.rack.name }))
    if (!confirmed) return
    deleteRackMutation.mutate(activeNode.rack.id)
  }

  function resetRackLayout() {
    const confirmed = window.confirm(t('warehouses.visual.resetLayoutConfirm'))
    if (!confirmed) return
    setRackLayouts({})
  }

  if (isLoading) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="flex min-h-[420px] items-center justify-center gap-3 p-8 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('warehouses.visual.loading')}
        </CardContent>
      </Card>
    )
  }

  if (!selectedWarehouse) {
    return (
      <EmptyState
        icon={WarehouseIcon}
        title={t('warehouses.visual.emptyTitle')}
        description={t('warehouses.visual.emptyDescription')}
      />
    )
  }

  const activeRackOrientation = activeNode?.rack
    ? rackLayouts[activeNode.rack.id]?.orientation ?? getSlotOrientation(activeNode)
    : null

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 space-y-4 overflow-auto bg-background p-4' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t('warehouses.visual.title')}</p>
          <p className="text-sm text-muted-foreground">{t('warehouses.visual.description')}</p>
        </div>

        <div className="flex min-w-[240px] items-center gap-2">
          <Select value={resolvedWarehouseId} onValueChange={handleWarehouseChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('warehouses.visual.selectWarehouse')} />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">{t('warehouses.visual.assignmentTitle')}</div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border px-2 py-1">
              {t('warehouses.visual.byName', { count: mappingSummary.alias })}
            </span>
            <span className="rounded-md border px-2 py-1">
              {t('warehouses.visual.automatic', { count: mappingSummary.auto })}
            </span>
            <span className="rounded-md border px-2 py-1">
              {t('warehouses.visual.extra', { count: mappingSummary.overflow })}
            </span>
            <span className="rounded-md border px-2 py-1">
              {t('warehouses.visual.emptySlots', { count: mappingSummary.emptySlots })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('warehouses.visual.assignmentDescription', { count: mappingSummary.totalRacks })}
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
          <div className="space-y-0.5">
            <div className="font-medium">{t('warehouses.visual.autoAssignTitle')}</div>
            <div className="text-xs text-muted-foreground">{t('warehouses.visual.autoAssignDescription')}</div>
          </div>
          <Switch checked={autoAssignByOrder} onCheckedChange={setAutoAssignByOrder} />
        </label>
      </div>

      {autoAssignByOrder && mappingSummary.auto > 0 ? (
        <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-950 dark:text-cyan-100">
          {t('warehouses.visual.autoAssignNotice', { count: mappingSummary.auto })}
        </div>
      ) : null}

      {mappingSummary.overflow > 0 ? (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {t('warehouses.visual.overflowNotice', { count: mappingSummary.overflow })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{t('warehouses.visual.layoutEditorTitle')}</div>
          <p className="text-xs text-muted-foreground">{t('warehouses.visual.layoutEditorDescription')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] items-center gap-2">
            <Input
              value={newRackName}
              onChange={(event) => setNewRackName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleAddRack()
                }
              }}
              placeholder={t('warehouses.visual.newRackPlaceholder')}
              className="h-9"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddRack}
              disabled={!newRackName.trim() || createRackMutation.isPending}
            >
              {createRackMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t('warehouses.visual.addRack')}
            </Button>
          </div>
          <Button
            type="button"
            variant={isLayoutEditMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLayoutEditMode((value) => !value)}
          >
            {isLayoutEditMode ? t('warehouses.visual.doneEditing') : t('warehouses.visual.editLayout')}
          </Button>
          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 px-2 py-1">
            <span className="max-w-[160px] truncate px-1 text-xs font-medium text-muted-foreground">
              {activeNode?.rack ? activeNode.rack.name : t('warehouses.visual.selectRackToEdit')}
            </span>
            <Button
              type="button"
              variant={activeRackOrientation === 'horizontal' ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setRackOrientation('horizontal')}
              disabled={!activeNode?.rack}
            >
              <MoveHorizontal className="mr-1.5 h-4 w-4" />
              {t('warehouses.visual.horizontal')}
            </Button>
            <Button
              type="button"
              variant={activeRackOrientation === 'vertical' ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setRackOrientation('vertical')}
              disabled={!activeNode?.rack}
            >
              <MoveVertical className="mr-1.5 h-4 w-4" />
              {t('warehouses.visual.vertical')}
            </Button>
            <div className="mx-1 h-6 w-px bg-border" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => resizeSelectedRack(-12, 0)}
              disabled={!activeNode?.rack}
            >
              <Minus className="mr-1 h-3.5 w-3.5" />
              {t('warehouses.visual.width')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => resizeSelectedRack(12, 0)}
              disabled={!activeNode?.rack}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('warehouses.visual.width')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => resizeSelectedRack(0, -12)}
              disabled={!activeNode?.rack}
            >
              <Minus className="mr-1 h-3.5 w-3.5" />
              {t('warehouses.visual.height')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => resizeSelectedRack(0, 12)}
              disabled={!activeNode?.rack}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('warehouses.visual.height')}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRackRotate}
            disabled={!activeNode?.rack}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            {t('warehouses.visual.rotateRack')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetRackLayout}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            {t('warehouses.visual.resetLayout')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-rose-600 hover:text-rose-700"
            onClick={handleDeleteSelectedRack}
            disabled={!activeNode?.rack || deleteRackMutation.isPending}
          >
            {deleteRackMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {t('warehouses.visual.deleteRack')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen((value) => !value)}
          >
            <Maximize2 className="mr-2 h-4 w-4" />
            {isFullscreen ? t('warehouses.visual.exitFullscreen') : t('warehouses.visual.fullscreen')}
          </Button>
        </div>
      </div>

      {activeHitKey && (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {t('warehouses.visual.materialLocated')}
        </div>
      )}

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <Card className="min-w-0 overflow-hidden border-slate-800 bg-[#0b1220] text-slate-100">
          <CardContent className="space-y-4 p-4">
            <InventorySearch
              query={query}
              results={searchResults}
              activeHitKey={activeHitKey}
              onQueryChange={setQuery}
              onPick={handleSearchPick}
              onClear={clearSearchState}
            />

            <WarehouseMap
              blueprint={blueprint}
              nodes={visualNodes}
              selectedRackKey={selectedRackKey}
              highlightedRackKey={highlightedRackKey}
              zoom={zoom}
              onZoomChange={setZoom}
              onResetZoom={() => setZoom(1)}
              onRackSelect={handleRackSelect}
              isLayoutEditMode={isLayoutEditMode}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((value) => !value)}
              onRackMove={handleRackMove}
              mapViewportRef={mapViewportRef}
              registerRackRef={registerRackRef}
            />
          </CardContent>
        </Card>

        <RackDetailView
          node={activeNode}
          selectedShelfId={selectedShelfId}
          highlightedShelfId={highlightedShelfId}
          onShelfSelect={setSelectedShelfId}
          onBack={() => {
            setSelectedRackKey(null)
            setSelectedShelfId(null)
            setHighlightedShelfId(null)
            setActiveHitKey(null)
          }}
        />
      </div>

      {visualNodes.every((node) => !node.rack) && (
        <div className="rounded-md border border-dashed border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
          {t('warehouses.visual.emptyMapHint')}
        </div>
      )}
    </div>
  )
}
