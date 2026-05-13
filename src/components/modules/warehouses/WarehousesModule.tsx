'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useI18n } from '@/components/layout/I18nProvider'
import {
  Plus,
  Pencil,
  Trash2,
  Warehouse,
  Layers,
  Package,
  MapPin,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { WarehouseVisualView } from '@/components/modules/warehouses/visual/WarehouseVisualView'
import type { MessageKey } from '@/lib/i18n/messages'
import type { Rack, Shelf, Warehouse as WarehouseType } from '@/components/modules/warehouses/visual/types'

interface WarehouseForm {
  name: string
  location: string
  description: string
}

interface RackForm {
  warehouseId: string
  name: string
  description: string
}

interface ShelfForm {
  rackId: string
  name: string
  description: string
}

type MoveDirection = 'up' | 'down'

function moveItem<T extends { id: string }>(items: T[], itemId: string, direction: MoveDirection) {
  const currentIndex = items.findIndex((item) => item.id === itemId)
  if (currentIndex === -1) return null

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= items.length) return null

  const nextItems = [...items]
  const [item] = nextItems.splice(currentIndex, 1)
  nextItems.splice(targetIndex, 0, item)
  return nextItems
}

function reorderRacksInWarehouses(
  warehouses: WarehouseType[],
  warehouseId: string,
  orderedRackIds: string[]
) {
  return warehouses.map((warehouse) => {
    if (warehouse.id !== warehouseId) return warehouse
    const rackMap = new Map(warehouse.racks.map((rack) => [rack.id, rack]))

    return {
      ...warehouse,
      racks: orderedRackIds
        .map((rackId) => rackMap.get(rackId))
        .filter((rack): rack is Rack => Boolean(rack)),
    }
  })
}

function reorderShelvesInWarehouses(
  warehouses: WarehouseType[],
  rackId: string,
  orderedShelfIds: string[]
) {
  return warehouses.map((warehouse) => ({
    ...warehouse,
    racks: warehouse.racks.map((rack) => {
      if (rack.id !== rackId) return rack
      const shelfMap = new Map(rack.shelves.map((shelf) => [shelf.id, shelf]))

      return {
        ...rack,
        shelves: orderedShelfIds
          .map((shelfId) => shelfMap.get(shelfId))
          .filter((shelf): shelf is Shelf => Boolean(shelf)),
      }
    }),
  }))
}

export function WarehousesModule() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set())
  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set())
  const [expandedShelfIds, setExpandedShelfIds] = useState<Set<string>>(new Set())

  const [whAddOpen, setWhAddOpen] = useState(false)
  const [whEditOpen, setWhEditOpen] = useState(false)
  const [whDeleteOpen, setWhDeleteOpen] = useState(false)
  const [rackAddOpen, setRackAddOpen] = useState(false)
  const [rackEditOpen, setRackEditOpen] = useState(false)
  const [rackDeleteOpen, setRackDeleteOpen] = useState(false)
  const [shelfAddOpen, setShelfAddOpen] = useState(false)
  const [shelfEditOpen, setShelfEditOpen] = useState(false)
  const [shelfDeleteOpen, setShelfDeleteOpen] = useState(false)

  const [selectedWh, setSelectedWh] = useState<WarehouseType | null>(null)
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null)
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null)
  const [rackParentWh, setRackParentWh] = useState<WarehouseType | null>(null)
  const [shelfParentRack, setShelfParentRack] = useState<Rack | null>(null)

  const [whForm, setWhForm] = useState<WarehouseForm>({ name: '', location: '', description: '' })
  const [rackForm, setRackForm] = useState<RackForm>({ warehouseId: '', name: '', description: '' })
  const [shelfForm, setShelfForm] = useState<ShelfForm>({ rackId: '', name: '', description: '' })

  const countLabel = (count: number, oneKey: MessageKey, otherKey: MessageKey) =>
    t(count === 1 ? oneKey : otherKey, { count })

  const { data: warehouses = [], isLoading } = useQuery<WarehouseType[]>({
    queryKey: ['warehouses'],
    queryFn: () => fetch('/api/warehouses').then((r) => r.json()),
  })

  const createWhMutation = useMutation({
    mutationFn: (data: WarehouseForm) =>
      fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.createSuccess'))
      setWhAddOpen(false)
      setWhForm({ name: '', location: '', description: '' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateWhMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WarehouseForm> }) =>
      fetch(`/api/warehouses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.updateSuccess'))
      setWhEditOpen(false)
      setSelectedWh(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteWhMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/warehouses/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.deleteSuccess'))
      setWhDeleteOpen(false)
      setSelectedWh(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createRackMutation = useMutation({
    mutationFn: (data: RackForm) =>
      fetch('/api/racks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.rackCreateSuccess'))
      setRackAddOpen(false)
      setRackForm({ warehouseId: '', name: '', description: '' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateRackMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; description: string }> }) =>
      fetch(`/api/racks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.rackUpdateSuccess'))
      setRackEditOpen(false)
      setSelectedRack(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteRackMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/racks/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.rackDeleteSuccess'))
      setRackDeleteOpen(false)
      setSelectedRack(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reorderRackMutation = useMutation({
    mutationFn: ({ warehouseId, orderedRackIds }: { warehouseId: string; orderedRackIds: string[] }) =>
      fetch('/api/racks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId, orderedRackIds }),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onMutate: async ({ warehouseId, orderedRackIds }) => {
      await queryClient.cancelQueries({ queryKey: ['warehouses'] })
      const previousWarehouses = queryClient.getQueryData<WarehouseType[]>(['warehouses']) ?? []
      queryClient.setQueryData<WarehouseType[]>(
        ['warehouses'],
        reorderRacksInWarehouses(previousWarehouses, warehouseId, orderedRackIds)
      )
      return { previousWarehouses }
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousWarehouses) {
        queryClient.setQueryData(['warehouses'], context.previousWarehouses)
      }
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })

  const createShelfMutation = useMutation({
    mutationFn: (data: ShelfForm) =>
      fetch('/api/shelves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.shelfCreateSuccess'))
      setShelfAddOpen(false)
      setShelfForm({ rackId: '', name: '', description: '' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateShelfMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; description: string }> }) =>
      fetch(`/api/shelves/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.shelfUpdateSuccess'))
      setShelfEditOpen(false)
      setSelectedShelf(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteShelfMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/shelves/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success(t('warehouses.shelfDeleteSuccess'))
      setShelfDeleteOpen(false)
      setSelectedShelf(null)
      setShelfDetailOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reorderShelfMutation = useMutation({
    mutationFn: ({ rackId, orderedShelfIds }: { rackId: string; orderedShelfIds: string[] }) =>
      fetch('/api/shelves/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rackId, orderedShelfIds }),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onMutate: async ({ rackId, orderedShelfIds }) => {
      await queryClient.cancelQueries({ queryKey: ['warehouses'] })
      const previousWarehouses = queryClient.getQueryData<WarehouseType[]>(['warehouses']) ?? []
      queryClient.setQueryData<WarehouseType[]>(
        ['warehouses'],
        reorderShelvesInWarehouses(previousWarehouses, rackId, orderedShelfIds)
      )
      return { previousWarehouses }
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousWarehouses) {
        queryClient.setQueryData(['warehouses'], context.previousWarehouses)
      }
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })

  const toggleWarehouse = (id: string) => {
    setExpandedWarehouses((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleRack = (id: string) => {
    setExpandedRacks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openAddRack = (warehouse: WarehouseType) => {
    setRackParentWh(warehouse)
    setRackForm({ warehouseId: warehouse.id, name: '', description: '' })
    setRackAddOpen(true)
  }

  const openEditRack = (rack: Rack) => {
    setSelectedRack(rack)
    setRackForm({ warehouseId: '', name: rack.name, description: rack.description })
    setRackEditOpen(true)
  }

  const openDeleteRack = (rack: Rack) => {
    setSelectedRack(rack)
    setRackDeleteOpen(true)
  }

  const openAddShelf = (rack: Rack) => {
    setShelfParentRack(rack)
    setShelfForm({ rackId: rack.id, name: '', description: '' })
    setShelfAddOpen(true)
  }

  const openEditShelf = (shelf: Shelf) => {
    setSelectedShelf(shelf)
    setShelfForm({ rackId: '', name: shelf.name, description: shelf.description })
    setShelfEditOpen(true)
  }

  const openDeleteShelf = (shelf: Shelf) => {
    setSelectedShelf(shelf)
    setShelfDeleteOpen(true)
  }

  const toggleShelf = (shelfId: string) => {
    setExpandedShelfIds((prev) => {
      const next = new Set(prev)
      if (next.has(shelfId)) next.delete(shelfId)
      else next.add(shelfId)
      return next
    })
  }

  const moveRack = (warehouseId: string, rackId: string, direction: MoveDirection) => {
    const warehouse = warehouses.find((item) => item.id === warehouseId)
    if (!warehouse) return

    const nextRacks = moveItem(warehouse.racks, rackId, direction)
    if (!nextRacks) return

    reorderRackMutation.mutate({
      warehouseId,
      orderedRackIds: nextRacks.map((rack) => rack.id),
    })
  }

  const moveShelf = (rackId: string, shelfId: string, direction: MoveDirection) => {
    const parentRack = warehouses
      .flatMap((warehouse) => warehouse.racks)
      .find((rack) => rack.id === rackId)

    if (!parentRack) return

    const nextShelves = moveItem(parentRack.shelves, shelfId, direction)
    if (!nextShelves) return

    reorderShelfMutation.mutate({
      rackId,
      orderedShelfIds: nextShelves.map((shelf) => shelf.id),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {countLabel(warehouses.length, 'warehouses.summary.one', 'warehouses.summary.other')}
        </p>
        <Button
          onClick={() => {
            setWhForm({ name: '', location: '', description: '' })
            setWhAddOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('warehouses.addWarehouse')}
        </Button>
      </div>

      <Tabs defaultValue="classic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="classic">{t('warehouses.tabs.classic')}</TabsTrigger>
          <TabsTrigger value="visual">{t('warehouses.tabs.visual')}</TabsTrigger>
        </TabsList>

        <TabsContent value="classic" className="space-y-4">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && warehouses.length === 0 && (
            <EmptyState
              icon={Warehouse}
              title={t('warehouses.emptyTitle')}
              description={t('warehouses.emptyDescription')}
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setWhForm({ name: '', location: '', description: '' })
                    setWhAddOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('warehouses.emptyAction')}
                </Button>
              }
            />
          )}

          {!isLoading && warehouses.length > 0 && (
            <div className="space-y-3">
              {warehouses.map((warehouse) => {
                const isWhOpen = expandedWarehouses.has(warehouse.id)
                const totalShelves = warehouse.racks.reduce((sum, rack) => sum + rack.shelves.length, 0)
                const totalProducts = warehouse.racks.reduce(
                  (sum, rack) =>
                    sum + rack.shelves.reduce((shelfSum, shelf) => shelfSum + shelf.productStocks.length, 0),
                  0
                )

                return (
                  <Collapsible
                    key={warehouse.id}
                    open={isWhOpen}
                    onOpenChange={() => toggleWarehouse(warehouse.id)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild className="w-full text-left">
                        <div>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                                <Warehouse className="h-5 w-5 text-emerald-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-semibold">{warehouse.name}</h3>
                                  {isWhOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                {warehouse.location && (
                                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {warehouse.location}
                                  </div>
                                )}
                              </div>
                              <div className="hidden shrink-0 items-center gap-3 sm:flex">
                                <Badge variant="outline" className="text-[10px]">
                                  {countLabel(warehouse.racks.length, 'warehouses.racks.one', 'warehouses.racks.other')}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {countLabel(totalShelves, 'warehouses.shelves.one', 'warehouses.shelves.other')}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {countLabel(totalProducts, 'warehouses.products.one', 'warehouses.products.other')}
                                </Badge>
                              </div>
                              <div
                                className="flex shrink-0 items-center gap-1"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedWh(warehouse)
                                    setWhForm({
                                      name: warehouse.name,
                                      location: warehouse.location,
                                      description: warehouse.description,
                                    })
                                    setWhEditOpen(true)
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-rose-500 hover:text-rose-600"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedWh(warehouse)
                                    setWhDeleteOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="space-y-3 border-t px-4 pb-4 pt-3">
                          {warehouse.racks.length === 0 ? (
                            <div className="py-4 text-center">
                              <p className="mb-2 text-xs text-muted-foreground">{t('warehouses.noRacks')}</p>
                              <Button size="sm" variant="outline" onClick={() => openAddRack(warehouse)}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                {t('warehouses.addRack')}
                              </Button>
                            </div>
                          ) : (
                            <>
                              {warehouse.racks.map((rack, rackIndex) => {
                                const isRackOpen = expandedRacks.has(rack.id)
                                const isFirstRack = rackIndex === 0
                                const isLastRack = rackIndex === warehouse.racks.length - 1

                                return (
                                  <Collapsible
                                    key={rack.id}
                                    open={isRackOpen}
                                    onOpenChange={() => toggleRack(rack.id)}
                                  >
                                    <div className="rounded-lg border bg-muted/20">
                                      <CollapsibleTrigger asChild className="w-full text-left">
                                        <div>
                                          <div className="flex items-center gap-3 p-3">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-[11px] font-semibold text-muted-foreground">
                                              {rackIndex + 1}
                                            </div>
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50">
                                              <Layers className="h-3.5 w-3.5 text-violet-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">{rack.name}</span>
                                                {isRackOpen ? (
                                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                ) : (
                                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                )}
                                              </div>
                                              {rack.description && (
                                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                  {rack.description}
                                                </p>
                                              )}
                                            </div>
                                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                                              {countLabel(
                                                rack.shelves.length,
                                                'warehouses.shelves.one',
                                                'warehouses.shelves.other'
                                              )}
                                            </Badge>
                                            <div
                                              className="flex shrink-0 items-center gap-0.5"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={isFirstRack || reorderRackMutation.isPending}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  moveRack(warehouse.id, rack.id, 'up')
                                                }}
                                              >
                                                <ArrowUp className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={isLastRack || reorderRackMutation.isPending}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  moveRack(warehouse.id, rack.id, 'down')
                                                }}
                                              >
                                                <ArrowDown className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  openEditRack(rack)
                                                }}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-rose-500 hover:text-rose-600"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  openDeleteRack(rack)
                                                }}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleTrigger>

                                      <CollapsibleContent>
                                        <div className="space-y-2 border-t px-3 pb-3 pt-2">
                                          {rack.shelves.length === 0 ? (
                                            <div className="py-3 text-center">
                                              <p className="mb-2 text-[11px] text-muted-foreground">
                                                {t('warehouses.noShelves')}
                                              </p>
                                              <Button size="sm" variant="outline" onClick={() => openAddShelf(rack)}>
                                                <Plus className="mr-1.5 h-3 w-3" />
                                                {t('warehouses.addShelf')}
                                              </Button>
                                            </div>
                                          ) : (
                                            <>
                                              {rack.shelves.map((shelf, shelfIndex) => {
                                                const isFirstShelf = shelfIndex === 0
                                                const isLastShelf = shelfIndex === rack.shelves.length - 1
                                                const isShelfExpanded = expandedShelfIds.has(shelf.id)

                                                return (
                                                  <div
                                                    key={shelf.id}
                                                    className="rounded-md border bg-background overflow-hidden"
                                                  >
                                                    {/* Clickable header row */}
                                                    <div
                                                      className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                                                      onClick={() => toggleShelf(shelf.id)}
                                                    >
                                                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-muted/20 text-[10px] font-semibold text-muted-foreground">
                                                        {shelfIndex + 1}
                                                      </div>
                                                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-50">
                                                        <Package className="h-3 w-3 text-amber-600" />
                                                      </div>
                                                      <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-medium">{shelf.name}</p>
                                                        {shelf.productStocks.length > 0 && (
                                                          <p className="text-[10px] text-muted-foreground">
                                                            {countLabel(
                                                              shelf.productStocks.length,
                                                              'warehouses.productsInShelf.one',
                                                              'warehouses.productsInShelf.other'
                                                            )}
                                                          </p>
                                                        )}
                                                      </div>
                                                      <ChevronRight
                                                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${isShelfExpanded ? 'rotate-90' : ''}`}
                                                      />
                                                      {/* Actions — stop propagation so they don't toggle expand */}
                                                      <div
                                                        className="flex shrink-0 items-center gap-0.5"
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-7 w-7"
                                                          disabled={isFirstShelf || reorderShelfMutation.isPending}
                                                          onClick={() => moveShelf(rack.id, shelf.id, 'up')}
                                                        >
                                                          <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-7 w-7"
                                                          disabled={isLastShelf || reorderShelfMutation.isPending}
                                                          onClick={() => moveShelf(rack.id, shelf.id, 'down')}
                                                        >
                                                          <ArrowDown className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-7 w-7"
                                                          onClick={() => openEditShelf(shelf)}
                                                        >
                                                          <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-7 w-7 text-rose-500 hover:text-rose-600"
                                                          onClick={() => openDeleteShelf(shelf)}
                                                        >
                                                          <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    </div>

                                                    {/* Inline expanded content */}
                                                    {isShelfExpanded && (
                                                      <div className="border-t bg-muted/20 px-3 pb-3 pt-2">
                                                        {shelf.productStocks.length === 0 ? (
                                                          <p className="py-3 text-center text-xs text-muted-foreground">
                                                            {t('warehouses.dialogs.noProductsInShelf')}
                                                          </p>
                                                        ) : (
                                                          <Table>
                                                            <TableHeader>
                                                              <TableRow className="hover:bg-transparent">
                                                                <TableHead className="h-7 text-[11px]">{t('common.code')}</TableHead>
                                                                <TableHead className="h-7 text-[11px]">{t('products.button')}</TableHead>
                                                                <TableHead className="h-7 text-right text-[11px]">{t('common.quantity')}</TableHead>
                                                              </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                              {shelf.productStocks.map((productStock) => (
                                                                <TableRow key={productStock.id} className="hover:bg-transparent">
                                                                  <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">{productStock.product.code}</TableCell>
                                                                  <TableCell className="py-1.5 text-xs font-medium">{productStock.product.name}</TableCell>
                                                                  <TableCell className="py-1.5 text-right font-bold tabular-nums text-xs">{productStock.quantity}</TableCell>
                                                                </TableRow>
                                                              ))}
                                                            </TableBody>
                                                          </Table>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-1 w-full border-dashed"
                                                onClick={() => openAddShelf(rack)}
                                              >
                                                <Plus className="mr-1.5 h-3 w-3" />
                                                {t('warehouses.addShelf')}
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                )
                              })}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-dashed"
                                onClick={() => openAddRack(warehouse)}
                              >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                {t('warehouses.addRack')}
                              </Button>
                            </>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="visual" className="mt-0">
          <WarehouseVisualView warehouses={warehouses} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      <Dialog open={whAddOpen} onOpenChange={setWhAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('warehouses.dialogs.addWarehouseTitle')}</DialogTitle>
            <DialogDescription>{t('warehouses.dialogs.addWarehouseDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                placeholder={t('warehouses.fields.warehouseNamePlaceholder')}
                value={whForm.name}
                onChange={(event) => setWhForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.location')}</Label>
              <Input
                placeholder={t('warehouses.fields.locationPlaceholder')}
                value={whForm.location}
                onChange={(event) => setWhForm((form) => ({ ...form, location: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.description')}</Label>
              <Input
                placeholder={t('warehouses.fields.descriptionPlaceholder')}
                value={whForm.description}
                onChange={(event) => setWhForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createWhMutation.mutate(whForm)}
              disabled={!whForm.name || createWhMutation.isPending}
            >
              {createWhMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={whEditOpen} onOpenChange={setWhEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('warehouses.dialogs.editWarehouseTitle')}</DialogTitle>
            <DialogDescription>{t('warehouses.dialogs.editWarehouseDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                value={whForm.name}
                onChange={(event) => setWhForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.location')}</Label>
              <Input
                value={whForm.location}
                onChange={(event) => setWhForm((form) => ({ ...form, location: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.description')}</Label>
              <Input
                value={whForm.description}
                onChange={(event) => setWhForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (selectedWh) {
                  updateWhMutation.mutate({ id: selectedWh.id, data: whForm })
                }
              }}
              disabled={!whForm.name || updateWhMutation.isPending}
            >
              {updateWhMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={whDeleteOpen} onOpenChange={setWhDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('warehouses.dialogs.deleteWarehouseTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('warehouses.dialogs.deleteWarehouseDescription', {
                name: selectedWh?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (selectedWh) deleteWhMutation.mutate(selectedWh.id)
              }}
              disabled={deleteWhMutation.isPending}
            >
              {deleteWhMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rackAddOpen} onOpenChange={setRackAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('warehouses.dialogs.addRackTitle')}</DialogTitle>
            <DialogDescription>
              {t('warehouses.dialogs.addRackDescription', {
                name: rackParentWh?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                placeholder={t('warehouses.fields.rackNamePlaceholder')}
                value={rackForm.name}
                onChange={(event) => setRackForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.description')}</Label>
              <Input
                placeholder={t('warehouses.fields.descriptionPlaceholder')}
                value={rackForm.description}
                onChange={(event) => setRackForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRackAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createRackMutation.mutate(rackForm)}
              disabled={!rackForm.name || createRackMutation.isPending}
            >
              {createRackMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rackEditOpen} onOpenChange={setRackEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('warehouses.dialogs.editRackTitle')}</DialogTitle>
            <DialogDescription>{t('warehouses.dialogs.editRackDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                value={rackForm.name}
                onChange={(event) => setRackForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.description')}</Label>
              <Input
                value={rackForm.description}
                onChange={(event) => setRackForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRackEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (selectedRack) {
                  updateRackMutation.mutate({
                    id: selectedRack.id,
                    data: { name: rackForm.name, description: rackForm.description },
                  })
                }
              }}
              disabled={!rackForm.name || updateRackMutation.isPending}
            >
              {updateRackMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rackDeleteOpen} onOpenChange={setRackDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('warehouses.dialogs.deleteRackTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('warehouses.dialogs.deleteRackDescription', {
                name: selectedRack?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (selectedRack) deleteRackMutation.mutate(selectedRack.id)
              }}
              disabled={deleteRackMutation.isPending}
            >
              {deleteRackMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={shelfAddOpen} onOpenChange={setShelfAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('warehouses.dialogs.addShelfTitle')}</DialogTitle>
            <DialogDescription>
              {t('warehouses.dialogs.addShelfDescription', {
                name: shelfParentRack?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                placeholder={t('warehouses.fields.shelfNamePlaceholder')}
                value={shelfForm.name}
                onChange={(event) => setShelfForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.description')}</Label>
              <Input
                placeholder={t('warehouses.fields.descriptionPlaceholder')}
                value={shelfForm.description}
                onChange={(event) => setShelfForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShelfAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createShelfMutation.mutate(shelfForm)}
              disabled={!shelfForm.name || createShelfMutation.isPending}
            >
              {createShelfMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shelfEditOpen} onOpenChange={setShelfEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('warehouses.dialogs.editShelfTitle')}</DialogTitle>
            <DialogDescription>{t('warehouses.dialogs.editShelfDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                value={shelfForm.name}
                onChange={(event) => setShelfForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('common.description')}</Label>
              <Input
                value={shelfForm.description}
                onChange={(event) => setShelfForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShelfEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (selectedShelf) {
                  updateShelfMutation.mutate({
                    id: selectedShelf.id,
                    data: { name: shelfForm.name, description: shelfForm.description },
                  })
                }
              }}
              disabled={!shelfForm.name || updateShelfMutation.isPending}
            >
              {updateShelfMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={shelfDeleteOpen} onOpenChange={setShelfDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('warehouses.dialogs.deleteShelfTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('warehouses.dialogs.deleteShelfDescription', {
                name: selectedShelf?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (selectedShelf) deleteShelfMutation.mutate(selectedShelf.id)
              }}
              disabled={deleteShelfMutation.isPending}
            >
              {deleteShelfMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
