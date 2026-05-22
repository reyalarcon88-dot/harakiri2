'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Loader2,
  Printer,
  ShoppingCart,
  Star,
  TrendingDown,
} from 'lucide-react'
import { format, addDays, differenceInCalendarDays } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AffectedProject {
  id: string
  name: string
  needed: number
  endDate: string | null
}

interface ForecastItem {
  productId: string
  productName: string
  productCode: string
  family?: string
  unitOfMeasure: string
  shelfStock: number
  recepcionStock: number
  availableNow: number
  pendingPurchases: number
  committedOutflows: number
  nextProjectsDemand?: number
  nextProjectsCount?: number
  favoriteReserveMinimum?: number
  projectedStock: number
  projectedAfterLookahead?: number
  projectedAfterReserve?: number
  shortage: number
  recommendedOrder?: number
  affectedProjects: AffectedProject[]
  lookaheadProjects?: {
    id: string
    name: string
    needed: number
    date: string | null
  }[]
}

interface ForecastSummary {
  targetDate: string
  mode: string
  includePending: boolean
  totalProducts: number
  shortageCount: number
  okCount: number
}

interface ForecastResponse {
  items: ForecastItem[]
  recommendations?: {
    rules: {
      favoriteReserveMinimum: number
      lookaheadProjects: number
      reorderCycleDays: number
    }
    projectsEvaluated: number
    nextReviewDate: string
    favoriteCount: number
    orderCount: number
    totalRecommendedUnits: number
    items: {
      productId: string
      productName: string
      productCode: string
      family: string
      unitOfMeasure: string
      availableNow: number
      pendingPurchases: number
      nextProjectsDemand: number
      nextProjectsCount: number
      reserveMinimum: number
      projectedAfterReserve: number
      recommendedOrder: number
      reason: string
      projects: {
        id: string
        name: string
        needed: number
        date: string | null
      }[]
    }[]
  }
  summary: ForecastSummary
}

interface Supplier {
  id: string
  name: string
}

type Urgency = 'urgent' | 'high' | 'normal' | 'ok'
type FilterKey = 'all' | 'favorites' | 'shortages' | 'urgent' | 'high' | 'covered'
type SortKey =
  | 'product'
  | 'shelfStock'
  | 'recepcionStock'
  | 'pendingPurchases'
  | 'committedOutflows'
  | 'projectedStock'
  | 'shortage'
  | 'recommendedOrder'
  | 'urgency'
  | 'affectedProjects'
type SortDirection = 'asc' | 'desc'
type SortConfig = { key: SortKey; direction: SortDirection } | null

interface ProductOption {
  id: string
  name: string
  code: string
  unitOfMeasure: string
  currentStock: number
  _totalShelfStock?: number
}

const FAVORITES_STORAGE_KEY = 'rmc.inventoryForecast.favoriteProductIds'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeUrgency(item: ForecastItem): Urgency {
  if (item.shortage === 0) return 'ok'
  const today = new Date()
  let minDays = Infinity
  for (const p of item.affectedProjects) {
    if (!p.endDate) continue
    const days = differenceInCalendarDays(new Date(p.endDate), today)
    if (days < minDays) minDays = days
  }
  if (minDays === Infinity) return 'normal'
  if (minDays <= 7) return 'urgent'
  if (minDays <= 14) return 'high'
  return 'normal'
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency === 'ok')
    return <span className="text-xs text-emerald-600 font-medium">OK</span>
  if (urgency === 'urgent')
    return (
      <Badge className="bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold tracking-wide">
        URGENT
      </Badge>
    )
  if (urgency === 'high')
    return (
      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-semibold tracking-wide">
        HIGH
      </Badge>
    )
  return (
    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium tracking-wide">
      NORMAL
    </Badge>
  )
}

function defaultDate() {
  return format(addDays(new Date(), 30), 'yyyy-MM-dd')
}

function minDate() {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd')
}

function StockNumber({
  value,
  prefix,
  dimIfZero = true,
}: {
  value: number
  prefix?: string
  dimIfZero?: boolean
}) {
  if (value === 0 && dimIfZero) return <span className="text-muted-foreground">—</span>
  return (
    <span className="tabular-nums">
      {prefix}
      {value}
    </span>
  )
}

function getOrderQuantity(item: ForecastItem) {
  return Math.max(item.recommendedOrder ?? 0, item.shortage)
}

function defaultSortDirection(key: SortKey): SortDirection {
  return key === 'product' || key === 'urgency' || key === 'affectedProjects' ? 'asc' : 'desc'
}

function urgencyRank(urgency: Urgency) {
  return urgency === 'urgent' ? 0 : urgency === 'high' ? 1 : urgency === 'normal' ? 2 : 3
}

function compareForecastItems(a: ForecastItem, b: ForecastItem, sortConfig: SortConfig, urgencyMap: Map<string, Urgency>) {
  if (!sortConfig) return 0

  let result = 0
  switch (sortConfig.key) {
    case 'product':
      result = `${a.productName} ${a.productCode}`.localeCompare(`${b.productName} ${b.productCode}`)
      break
    case 'shelfStock':
      result = a.shelfStock - b.shelfStock
      break
    case 'recepcionStock':
      result = a.recepcionStock - b.recepcionStock
      break
    case 'pendingPurchases':
      result = a.pendingPurchases - b.pendingPurchases
      break
    case 'committedOutflows':
      result = a.committedOutflows - b.committedOutflows
      break
    case 'projectedStock':
      result = a.projectedStock - b.projectedStock
      break
    case 'shortage':
      result = a.shortage - b.shortage
      break
    case 'recommendedOrder':
      result = getOrderQuantity(a) - getOrderQuantity(b)
      break
    case 'urgency':
      result = urgencyRank(urgencyMap.get(a.productId) ?? 'ok') - urgencyRank(urgencyMap.get(b.productId) ?? 'ok')
      break
    case 'affectedProjects':
      result = a.affectedProjects.length - b.affectedProjects.length
      break
  }

  if (result === 0) {
    result = `${a.productName} ${a.productCode}`.localeCompare(`${b.productName} ${b.productCode}`)
  }
  return sortConfig.direction === 'asc' ? result : -result
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── PO Confirmation Modal ────────────────────────────────────────────────────

interface POModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedItems: ForecastItem[]
  targetDate: string
  onSuccess: () => void
}

function POConfirmModal({ open, onOpenChange, selectedItems, targetDate, onSuccess }: POModalProps) {
  const [editedQtys, setEditedQtys] = useState<Record<string, number>>({})
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [formErrors, setFormErrors] = useState<{ supplier?: string; qty?: string }>({})

  const queryClient = useQueryClient()

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Failed to load suppliers')
      return res.json()
    },
    staleTime: 60_000,
  })

  // Reset form state whenever the modal opens with a new selection
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        const qtys: Record<string, number> = {}
        for (const item of selectedItems) qtys[item.productId] = getOrderQuantity(item)
        setEditedQtys(qtys)
        setSupplierId('')
        setNotes('')
        setFormErrors({})
      }
      onOpenChange(next)
    },
    [selectedItems, onOpenChange],
  )

  const updateQty = useCallback((productId: string, raw: string) => {
    const v = parseInt(raw, 10)
    setEditedQtys((prev) => ({ ...prev, [productId]: isNaN(v) ? 0 : v }))
    setFormErrors((prev) => ({ ...prev, qty: undefined }))
  }, [])

  const createMutation = useMutation({
    mutationFn: async (payload: {
      supplierId: string
      purchaseDate: string
      status: string
      notes: string
      items: { productId: string; quantity: number; unitPrice: number; shelfId: null }[]
    }) => {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create purchase order')
      }
      return res.json()
    },
    onSuccess: (_data, payload) => {
      const supplierName = suppliers?.find((s) => s.id === payload.supplierId)?.name ?? 'supplier'
      toast.success('Purchase Order created successfully', {
        description: `${selectedItems.length} product${selectedItems.length === 1 ? '' : 's'} · ${supplierName}`,
      })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error('Failed to create purchase order', { description: err.message })
    },
  })

  const handleSubmit = useCallback(() => {
    const errors: { supplier?: string; qty?: string } = {}

    if (!supplierId) {
      errors.supplier = 'Please select a supplier before confirming.'
    }

    const hasInvalidQty = selectedItems.some((item) => {
      const q = editedQtys[item.productId] ?? getOrderQuantity(item)
      return !q || q <= 0 || !Number.isInteger(q)
    })
    if (hasInvalidQty) {
      errors.qty = 'All quantities must be positive whole numbers.'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const payload = {
      supplierId,
      purchaseDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'pedido',
      notes: ['Inventory Forecast — target: ' + targetDate, notes].filter(Boolean).join('\n'),
      items: selectedItems.map((item) => ({
        productId: item.productId,
        quantity: editedQtys[item.productId] ?? getOrderQuantity(item),
        unitPrice: 0,
        shelfId: null as null,
      })),
    }

    createMutation.mutate(payload)
  }, [supplierId, editedQtys, notes, targetDate, selectedItems, createMutation])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Create Purchase Order from Forecast
          </DialogTitle>
          <DialogDescription>
            Review and adjust quantities, select a supplier, then confirm. A purchase order will be
            created with status <strong>pedido</strong> — no stock is touched.
          </DialogDescription>
        </DialogHeader>

        {/* Target date context */}
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>
            Forecast target date: <strong>{targetDate}</strong>
          </span>
        </div>

        {/* Items table */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Shortage</TableHead>
                <TableHead className="text-right w-32">Order Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedItems.map((item) => {
                const qty = editedQtys[item.productId] ?? getOrderQuantity(item)
                const invalid = !qty || qty <= 0
                return (
                  <TableRow key={item.productId}>
                    <TableCell>
                      <p className="font-medium text-sm leading-tight">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.productCode}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.unitOfMeasure}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600 font-medium">
                      {item.shortage > 0 ? item.shortage : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={qty || ''}
                        onChange={(e) => updateQty(item.productId, e.target.value)}
                        className={`w-24 text-right ml-auto ${
                          invalid ? 'border-rose-400 focus-visible:ring-rose-400' : ''
                        }`}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {formErrors.qty && (
          <p className="text-xs text-rose-600 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {formErrors.qty}
          </p>
        )}

        {/* Supplier */}
        <div className="space-y-1.5">
          <Label htmlFor="po-supplier">
            Supplier <span className="text-rose-500">*</span>
          </Label>
          <Select
            value={supplierId}
            onValueChange={(v) => {
              setSupplierId(v)
              setFormErrors((prev) => ({ ...prev, supplier: undefined }))
            }}
          >
            <SelectTrigger
              id="po-supplier"
              className={formErrors.supplier ? 'border-rose-400 focus:ring-rose-400' : ''}
            >
              <SelectValue placeholder="Select a supplier…" />
            </SelectTrigger>
            <SelectContent>
              {suppliers?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formErrors.supplier && (
            <p className="text-xs text-rose-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {formErrors.supplier}
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="po-notes">
            Notes{' '}
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="po-notes"
            placeholder="Additional notes for this purchase order…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={createMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4 mr-1.5" />
            )}
            {createMutation.isPending ? 'Creating…' : 'Confirm Purchase Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Module ───────────────────────────────────────────────────────────────────

export function InventoryTimelineModule() {
  const [targetDate, setTargetDate] = useState(defaultDate)
  const [mode, setMode] = useState<'all' | 'by_date'>('all')
  const [includePending, setIncludePending] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [recommendationsOpen, setRecommendationsOpen] = useState(false)
  const [favoriteSearch, setFavoriteSearch] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const favoriteIdList = useMemo(() => Array.from(favoriteIds).sort(), [favoriteIds])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
      if (raw) setFavoriteIds(new Set(JSON.parse(raw) as string[]))
    } catch {
      setFavoriteIds(new Set())
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteIds)))
  }, [favoriteIds])

  const { data, isLoading, isFetching } = useQuery<ForecastResponse>({
    queryKey: ['inventory-forecast', targetDate, mode, includePending, favoriteIdList],
    queryFn: async () => {
      const params = new URLSearchParams({
        date: targetDate,
        mode,
        includePending: String(includePending),
      })
      if (favoriteIdList.length > 0) params.set('favoriteIds', favoriteIdList.join(','))
      const res = await fetch(`/api/inventory/forecast?${params}`)
      if (!res.ok) throw new Error('Failed to load forecast')
      return res.json()
    },
    enabled: !!targetDate,
    staleTime: 60_000,
  })

  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['products-for-forecast-favorites'],
    queryFn: async () => {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to load products')
      return res.json()
    },
    staleTime: 60_000,
  })

  const allItems = useMemo(() => {
    const forecastItems = data?.items ?? []
    const byId = new Map(forecastItems.map((item) => [item.productId, item]))
    for (const product of products) {
      if (!favoriteIds.has(product.id) || byId.has(product.id)) continue
      byId.set(product.id, {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        unitOfMeasure: product.unitOfMeasure,
        shelfStock: product._totalShelfStock ?? product.currentStock ?? 0,
        recepcionStock: 0,
        availableNow: product._totalShelfStock ?? product.currentStock ?? 0,
        pendingPurchases: 0,
        committedOutflows: 0,
        nextProjectsDemand: 0,
        nextProjectsCount: 0,
        favoriteReserveMinimum: 10,
        projectedStock: product._totalShelfStock ?? product.currentStock ?? 0,
        projectedAfterLookahead: product._totalShelfStock ?? product.currentStock ?? 0,
        projectedAfterReserve: (product._totalShelfStock ?? product.currentStock ?? 0) - 10,
        shortage: 0,
        recommendedOrder: Math.max(0, 10 - (product._totalShelfStock ?? product.currentStock ?? 0)),
        affectedProjects: [],
        lookaheadProjects: [],
      })
    }
    return Array.from(byId.values())
  }, [data?.items, favoriteIds, products])

  // Urgency is pure client-side — no API changes, no DB reads
  const urgencyMap = useMemo(() => {
    const map = new Map<string, Urgency>()
    for (const item of allItems) map.set(item.productId, computeUrgency(item))
    return map
  }, [allItems])

  const shortageItems = allItems.filter((i) => i.shortage > 0)
  const favoriteItems = allItems.filter((i) => favoriteIds.has(i.productId))
  const urgentItems   = allItems.filter((i) => urgencyMap.get(i.productId) === 'urgent')
  const highItems     = allItems.filter((i) => urgencyMap.get(i.productId) === 'high')
  const coveredItems  = allItems.filter((i) => i.shortage === 0)

  const visibleItems =
    filter === 'shortages' ? shortageItems :
    filter === 'favorites' ? favoriteItems :
    filter === 'urgent'    ? urgentItems :
    filter === 'high'      ? highItems :
    filter === 'covered'   ? coveredItems :
    allItems

  const sortedVisibleItems = useMemo(() => {
    if (!sortConfig) return visibleItems
    return visibleItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const result = compareForecastItems(a.item, b.item, sortConfig, urgencyMap)
        return result === 0 ? a.index - b.index : result
      })
      .map(({ item }) => item)
  }, [sortConfig, urgencyMap, visibleItems])

  const requestSort = useCallback((key: SortKey) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: defaultSortDirection(key) }
    })
  }, [])

  const isComputing = isLoading || isFetching

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllShortages = useCallback(() => {
    setSelectedIds(new Set(shortageItems.map((i) => i.productId)))
  }, [shortageItems])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const allShortagesSelected =
    shortageItems.length > 0 && shortageItems.every((i) => selectedIds.has(i.productId))

  const selectedItems = allItems.filter((i) => selectedIds.has(i.productId))
  const replenishment = data?.recommendations
  const recommendedProductIds = new Set(
    (replenishment?.items ?? [])
      .filter((item) => item.recommendedOrder > 0)
      .map((item) => item.productId),
  )
  const recommendedItems = allItems.filter((i) => recommendedProductIds.has(i.productId))
  const allRecommendedSelected =
    recommendedItems.length > 0 && recommendedItems.every((i) => selectedIds.has(i.productId))

  const selectAllRecommended = useCallback(() => {
    setSelectedIds(new Set(recommendedItems.map((i) => i.productId)))
  }, [recommendedItems])
  const favoriteProductOptions = useMemo(() => {
    const term = favoriteSearch.trim().toLowerCase()
    return products
      .filter((product) => {
        if (!term) return true
        return `${product.name} ${product.code}`.toLowerCase().includes(term)
      })
      .sort((a, b) => {
        const aFav = favoriteIds.has(a.id)
        const bFav = favoriteIds.has(b.id)
        if (aFav !== bFav) return aFav ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [favoriteIds, favoriteSearch, products])

  const toggleFavorite = useCallback((productId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }, [])

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all',       label: 'All',       count: allItems.length },
    { key: 'favorites', label: 'Favorites', count: favoriteItems.length },
    { key: 'shortages', label: 'Shortages', count: shortageItems.length },
    { key: 'urgent',    label: 'Urgent',    count: urgentItems.length },
    { key: 'high',      label: 'High',      count: highItems.length },
    { key: 'covered',   label: 'Covered',   count: coveredItems.length },
  ]

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="h-3 w-3 text-teal-700" />
      : <ArrowDown className="h-3 w-3 text-teal-700" />
  }

  const sortableLabel = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <button
      type="button"
      onClick={() => requestSort(key)}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm underline decoration-dotted underline-offset-2 hover:text-teal-700',
        align === 'right' && 'justify-end'
      )}
    >
      <span>{label}</span>
      {renderSortIcon(key)}
    </button>
  )

  const handlePrintForecast = useCallback(() => {
    const rows = sortedVisibleItems.map((item) => {
      const urgency = urgencyMap.get(item.productId) ?? 'ok'
      const affectedProjects = item.affectedProjects.length > 0
        ? item.affectedProjects
            .map((project) => `${project.name} (${project.needed}${item.unitOfMeasure ? ` ${item.unitOfMeasure}` : ''}${project.endDate ? `, due ${project.endDate}` : ''})`)
            .join(', ')
        : '-'

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.productName)}</strong>
            <div class="muted">${escapeHtml(item.productCode)}</div>
          </td>
          <td class="num">${escapeHtml(item.shelfStock)}</td>
          <td class="num">${item.recepcionStock ? `+${escapeHtml(item.recepcionStock)}` : '-'}</td>
          ${includePending ? `<td class="num">${item.pendingPurchases ? `+${escapeHtml(item.pendingPurchases)}` : '-'}</td>` : ''}
          <td class="num">${item.committedOutflows ? `-${escapeHtml(item.committedOutflows)}` : '-'}</td>
          <td class="num">${escapeHtml(item.projectedStock)}</td>
          <td class="num">${item.shortage > 0 ? `-${escapeHtml(item.shortage)}` : '-'}</td>
          <td class="num">${getOrderQuantity(item) > 0 ? escapeHtml(getOrderQuantity(item)) : '-'}</td>
          <td>${escapeHtml(urgency.toUpperCase())}</td>
          <td>${escapeHtml(affectedProjects)}</td>
        </tr>
      `
    }).join('')

    const filterLabel = filterTabs.find((tab) => tab.key === filter)?.label || 'All'
    const sortLabel = sortConfig ? `${sortConfig.key} ${sortConfig.direction}` : 'default'
    const generatedAt = new Date().toLocaleString()
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>RMC Inventory Forecast</title>
  <style>
    @page { size: landscape; margin: 0.35in; }
    body { font-family: Arial, sans-serif; color: #0f172a; font-size: 11px; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .meta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; color: #475569; }
    .meta strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; background: #e8f4f2; color: #334155; font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; vertical-align: top; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .muted { color: #64748b; font-size: 10px; margin-top: 2px; }
  </style>
</head>
<body>
  <h1>RMC Inventory Forecast</h1>
  <div class="meta">
    <span><strong>Target date:</strong> ${escapeHtml(targetDate)}</span>
    <span><strong>Scope:</strong> ${escapeHtml(mode === 'by_date' ? 'Projects ending by target date' : 'All active projects')}</span>
    <span><strong>Filter:</strong> ${escapeHtml(filterLabel)}</span>
    <span><strong>Sort:</strong> ${escapeHtml(sortLabel)}</span>
    <span><strong>Products:</strong> ${escapeHtml(sortedVisibleItems.length)}</span>
    <span><strong>Generated:</strong> ${escapeHtml(generatedAt)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th class="num">On Shelves</th>
        <th class="num">Receiving</th>
        ${includePending ? '<th class="num">Pending Orders</th>' : ''}
        <th class="num">Project Needs</th>
        <th class="num">Projected</th>
        <th class="num">Shortage</th>
        <th class="num">Recommended Order</th>
        <th>Urgency</th>
        <th>Affected Projects</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = function(){ window.print() }</script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=1200,height=800')
    if (!printWindow) {
      toast.error('Unable to open print window')
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
  }, [filter, filterTabs, includePending, mode, sortConfig, sortedVisibleItems, targetDate, urgencyMap])

  const handleExportForecastExcel = useCallback(async () => {
    if (sortedVisibleItems.length === 0) {
      toast.info('No forecast rows to export')
      return
    }

    const XLSX = await import('xlsx')
    const rows = sortedVisibleItems.map((item) => {
      const urgency = urgencyMap.get(item.productId) ?? 'ok'
      const affectedProjects = item.affectedProjects.length > 0
        ? item.affectedProjects
            .map((project) => `${project.name} (${project.needed}${item.unitOfMeasure ? ` ${item.unitOfMeasure}` : ''}${project.endDate ? `, due ${project.endDate}` : ''})`)
            .join(', ')
        : ''

      return {
        Product: item.productName,
        Code: item.productCode,
        'Unit of Measure': item.unitOfMeasure,
        'On Shelves': item.shelfStock,
        Receiving: item.recepcionStock,
        ...(includePending ? { 'Pending Orders': item.pendingPurchases } : {}),
        'Project Needs': item.committedOutflows,
        Projected: item.projectedStock,
        Shortage: item.shortage,
        'Recommended Order': getOrderQuantity(item),
        Urgency: urgency.toUpperCase(),
        'Affected Projects': affectedProjects,
      }
    })

    const summaryRows = [
      ['RMC Inventory Forecast'],
      ['Target date', targetDate],
      ['Scope', mode === 'by_date' ? 'Projects ending by target date' : 'All active projects'],
      ['Filter', filterTabs.find((tab) => tab.key === filter)?.label || 'All'],
      ['Sort', sortConfig ? `${sortConfig.key} ${sortConfig.direction}` : 'default'],
      ['Products exported', sortedVisibleItems.length],
      ['Generated', new Date().toLocaleString()],
      [],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(summaryRows)
    XLSX.utils.sheet_add_json(worksheet, rows, {
      origin: `A${summaryRows.length + 1}`,
      skipHeader: false,
    })

    const headerRow = summaryRows.length + 1
    worksheet['!freeze'] = { xSplit: 0, ySplit: headerRow }
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRow - 1, c: 0 },
        e: { r: headerRow - 1 + rows.length, c: Object.keys(rows[0]).length - 1 },
      }),
    }
    worksheet['!cols'] = [
      { wch: 34 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      ...(includePending ? [{ wch: 14 }] : []),
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 48 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Forecast')
    const safeDate = targetDate || new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `RMC-Inventory-Forecast-${safeDate}.xlsx`, { compression: true })
  }, [filter, filterTabs, includePending, mode, sortConfig, sortedVisibleItems, targetDate, urgencyMap])

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <TrendingDown className="h-7 w-7 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory Forecast</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Projected stock at a future date based on current inventory and active project
              requirements. No existing data or logic is modified.
            </p>
          </div>
        </div>

        {/* ── Controls ── */}
        {false && replenishment && favoriteIds.size > 0 && (
          <Card className="border-teal-200">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-teal-700" />
                    15-day ordering recommendations
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Favorites only · reserve {replenishment.rules.favoriteReserveMinimum} units · next{' '}
                    {replenishment.projectsEvaluated} active projects reviewed · next review{' '}
                    {replenishment.nextReviewDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{replenishment.orderCount} to order</Badge>
                  <Badge variant="outline">{replenishment.totalRecommendedUnits} units</Badge>
                  {recommendedItems.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={allRecommendedSelected ? clearSelection : selectAllRecommended}
                    >
                      {allRecommendedSelected ? 'Deselect recommended' : 'Select recommended'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {replenishment.items.length === 0 ? (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  Select favorites to calculate purchase recommendations.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Family</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Next 25 projects</TableHead>
                        <TableHead className="text-right">Reserve</TableHead>
                        <TableHead className="text-right">Order</TableHead>
                        <TableHead>Projects</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {replenishment.items.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell>
                            <p className="font-medium text-sm leading-tight">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.productCode}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.family || '-'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{item.availableNow}</TableCell>
                          <TableCell className="text-right tabular-nums text-blue-700">
                            {item.pendingPurchases ? `+${item.pendingPurchases}` : '-'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-amber-700">
                            {item.nextProjectsDemand || '-'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{item.reserveMinimum}</TableCell>
                          <TableCell className="text-right">
                            {item.recommendedOrder > 0 ? (
                              <Badge className="bg-teal-100 text-teal-800 border border-teal-200">
                                {item.recommendedOrder}
                              </Badge>
                            ) : (
                              <span className="text-xs text-emerald-700">Covered</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {item.projects.slice(0, 2).map((project) => (
                                <Tooltip key={project.id}>
                                  <TooltipTrigger>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 h-4 cursor-default max-w-[100px] truncate block"
                                    >
                                      {project.name}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {project.name} needs {project.needed} {item.unitOfMeasure}
                                    {project.date ? ` · ${project.date}` : ''}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {item.projects.length > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                                  +{item.projects.length - 2}
                                </Badge>
                              )}
                              {item.projects.length === 0 && (
                                <span className="text-xs text-muted-foreground">Reserve only</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-5">

              <div className="space-y-1.5">
                <Label htmlFor="forecast-date">Target date</Label>
                <Input
                  id="forecast-date"
                  type="date"
                  value={targetDate}
                  min={minDate()}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-44"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Project scope</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as 'all' | 'by_date')}>
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active projects (conservative)</SelectItem>
                    <SelectItem value="by_date">Projects ending by target date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pb-0.5">
                <Switch
                  id="pending-toggle"
                  checked={includePending}
                  onCheckedChange={setIncludePending}
                />
                <Label htmlFor="pending-toggle" className="cursor-pointer leading-snug">
                  Include pending<br />
                  <span className="text-xs text-muted-foreground font-normal">
                    purchase orders
                  </span>
                </Label>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setFavoritesOpen(true)}
                className="gap-2"
              >
                <Star className="h-4 w-4 text-amber-500" />
                Manage favorites
                {favoriteIds.size > 0 && (
                  <Badge variant="secondary" className="ml-1">{favoriteIds.size}</Badge>
                )}
              </Button>
              <div className="flex items-center rounded-lg border bg-muted/40 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={filter === 'favorites' ? 'default' : 'ghost'}
                  className={cn(
                    'h-8 gap-1.5',
                    filter === 'favorites' && 'bg-amber-600 text-white hover:bg-amber-700'
                  )}
                  onClick={() => setFilter('favorites')}
                  disabled={favoriteIds.size === 0}
                >
                  <Star className={cn('h-3.5 w-3.5', filter === 'favorites' && 'fill-current')} />
                  Favorites only
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  className="h-8"
                  onClick={() => setFilter('all')}
                >
                  View all
                </Button>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ── Summary cards ── */}
        {data?.summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className={data.summary.shortageCount > 0 ? 'border-rose-200' : ''}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`h-9 w-9 shrink-0 ${
                      data.summary.shortageCount > 0
                        ? 'text-rose-500'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                  <div>
                    <p
                      className={`text-3xl font-bold tabular-nums ${
                        data.summary.shortageCount > 0
                          ? 'text-rose-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {data.summary.shortageCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.summary.shortageCount === 1 ? 'product shortage' : 'product shortages'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={data.summary.okCount > 0 ? 'border-emerald-200' : ''}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-3xl font-bold text-emerald-700 tabular-nums">
                      {data.summary.okCount}
                    </p>
                    <p className="text-xs text-muted-foreground">products covered</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-9 w-9 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{data.summary.targetDate || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.summary.mode === 'by_date'
                        ? 'projects ending by this date'
                        : 'all active projects included'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={favoriteIds.size > 0 ? 'border-amber-200' : ''}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Star className="h-9 w-9 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-3xl font-bold text-amber-700 tabular-nums">
                      {favoriteItems.length}
                    </p>
                    <p className="text-xs text-muted-foreground">favorite products watched</p>
                    <p className="text-[11px] text-muted-foreground">Reserve rule: 10 units each</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Results ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">

              {/* Filter tabs */}
              <div className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-1">
                {filterTabs.map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      filter === key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                    {count > 0 && (
                      <span
                        className={cn(
                          'ml-1 tabular-nums',
                          filter !== key && 'opacity-60',
                          key === 'urgent' && count > 0 && 'text-rose-600',
                          key === 'high'   && count > 0 && 'text-amber-600',
                          key === 'favorites' && count > 0 && 'text-amber-600',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2 mr-1">
                  {isComputing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!isComputing &&
                    `${visibleItems.length} ${visibleItems.length === 1 ? 'product' : 'products'}`}
                </CardTitle>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintForecast}
                  disabled={sortedVisibleItems.length === 0}
                  className="gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print forecast
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleExportForecastExcel()}
                  disabled={sortedVisibleItems.length === 0}
                  className="gap-1.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Export Excel
                </Button>

                {shortageItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={allShortagesSelected ? clearSelection : selectAllShortages}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mr-1.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                        allShortagesSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background',
                      )}
                    >
                      {allShortagesSelected && (
                        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 fill-current">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {allShortagesSelected
                      ? 'Deselect all'
                      : `Select all shortages (${shortageItems.length})`}
                  </Button>
                )}

                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setModalOpen(true)}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                    Create PO from {selectedIds.size}{' '}
                    {selectedIds.size === 1 ? 'product' : 'products'}
                  </Button>
                )}
              </div>

            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {filter === 'shortages' ? 'No shortages detected — all products are covered.' :
                 filter === 'urgent'    ? 'No urgent shortages. All shortage deadlines are beyond 7 days.' :
                 filter === 'high'      ? 'No high-priority shortages within 14 days.' :
                 filter === 'covered'   ? 'No fully-covered products found.' :
                 'No products with inventory activity found.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>{sortableLabel('product', 'Product')}</TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>{sortableLabel('shelfStock', 'On Shelves', 'right')}</TooltipTrigger>
                          <TooltipContent>
                            Quantity physically on warehouse shelves
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>{sortableLabel('recepcionStock', 'Receiving', 'right')}</TooltipTrigger>
                          <TooltipContent>
                            Items received but not yet placed on a shelf
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      {includePending && (
                        <TableHead className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>{sortableLabel('pendingPurchases', 'Pending Orders', 'right')}</TooltipTrigger>
                            <TooltipContent>
                              Quantities in purchase orders already created but not yet received
                            </TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>{sortableLabel('committedOutflows', 'Project Needs', 'right')}</TooltipTrigger>
                          <TooltipContent>
                            Total remaining quantities required by active projects
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>{sortableLabel('projectedStock', 'Projected', 'right')}</TooltipTrigger>
                          <TooltipContent>
                            Available Now + Pending Orders − Project Needs
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right">{sortableLabel('shortage', 'Shortage', 'right')}</TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>{sortableLabel('recommendedOrder', 'Recommended Order', 'right')}</TooltipTrigger>
                          <TooltipContent>
                            Units to order to cover the shortage (= abs(Projected) when negative,
                            else 0)
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger asChild>{sortableLabel('urgency', 'Urgency')}</TooltipTrigger>
                          <TooltipContent>
                            Based on the soonest project deadline affected by this shortage:
                            URGENT ≤7 days · HIGH ≤14 days · NORMAL otherwise
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>{sortableLabel('affectedProjects', 'Affected Projects')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVisibleItems.map((item) => {
                      const isSelected = selectedIds.has(item.productId)
                      const orderQuantity = getOrderQuantity(item)
                      const canSelect = orderQuantity > 0
                      const urgency = urgencyMap.get(item.productId) ?? 'ok'
                      return (
                        <TableRow
                          key={item.productId}
                          className={
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/30'
                              : urgency === 'urgent'
                              ? 'bg-rose-50/60 dark:bg-rose-950/20'
                              : urgency === 'high'
                              ? 'bg-amber-50/50 dark:bg-amber-950/10'
                              : ''
                          }
                        >
                          <TableCell className="pl-4 pr-2">
                            <Checkbox
                              checked={isSelected}
                              disabled={!canSelect}
                              onCheckedChange={() => toggleSelect(item.productId)}
                              aria-label={`Select ${item.productName}`}
                            />
                          </TableCell>

                          <TableCell>
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => toggleFavorite(item.productId)}
                                className={cn(
                                  'mt-0.5 shrink-0 text-muted-foreground hover:text-amber-500',
                                  favoriteIds.has(item.productId) && 'text-amber-500'
                                )}
                                aria-label={favoriteIds.has(item.productId) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <Star className={cn('h-3.5 w-3.5', favoriteIds.has(item.productId) && 'fill-current')} />
                              </button>
                              <span>
                                <p className="font-medium text-sm leading-tight">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-muted-foreground">{item.productCode}</p>
                                {favoriteIds.has(item.productId) && (
                                  <p className="text-[11px] text-amber-700">25-day delay watch</p>
                                )}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <StockNumber value={item.shelfStock} dimIfZero={false} />
                          </TableCell>

                          <TableCell className="text-right text-muted-foreground">
                            <StockNumber value={item.recepcionStock} prefix="+" />
                          </TableCell>

                          {includePending && (
                            <TableCell className="text-right text-blue-700">
                              <StockNumber value={item.pendingPurchases} prefix="+" />
                            </TableCell>
                          )}

                          <TableCell className="text-right text-amber-700 font-medium">
                            <StockNumber value={item.committedOutflows} prefix="−" />
                          </TableCell>

                          <TableCell
                            className={`text-right font-semibold tabular-nums ${
                              item.projectedStock < 0
                                ? 'text-rose-600'
                                : item.projectedStock === 0
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {item.projectedStock}
                          </TableCell>

                          <TableCell className="text-right">
                            {item.shortage > 0 ? (
                              <Badge className="bg-rose-100 text-rose-700 border border-rose-200 font-semibold tabular-nums">
                                −{item.shortage}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-semibold tabular-nums">
                            {orderQuantity > 0 ? (
                              <span className="text-blue-700">{orderQuantity}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <UrgencyBadge urgency={urgency} />
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {item.affectedProjects.slice(0, 2).map((p) => (
                                <Tooltip key={p.id}>
                                  <TooltipTrigger>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 h-4 cursor-default max-w-[90px] truncate block"
                                    >
                                      {p.name}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {p.name} — needs {p.needed} {item.unitOfMeasure}
                                    {p.endDate ? ` · due ${p.endDate}` : ''}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {item.affectedProjects.length > 2 && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 h-4 cursor-default"
                                    >
                                      +{item.affectedProjects.length - 2}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <ul className="space-y-0.5">
                                      {item.affectedProjects.slice(2).map((p) => (
                                        <li key={p.id}>
                                          {p.name} — {p.needed} {item.unitOfMeasure}
                                          {p.endDate ? ` · due ${p.endDate}` : ''}
                                        </li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {replenishment && favoriteIds.size > 0 && (
          <Collapsible open={recommendationsOpen} onOpenChange={setRecommendationsOpen}>
            <Card className="border-teal-200/80">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-teal-700" />
                      Recomendaciones de compra para favoritos
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Analisis secundario para preparar compras recurrentes sin reemplazar la tabla principal.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{replenishment.orderCount} to order</Badge>
                    <Badge variant="outline">{replenishment.totalRecommendedUnits} units</Badge>
                    <Badge variant="outline">Next review {replenishment.nextReviewDate}</Badge>
                    <CollapsibleTrigger asChild>
                      <Button type="button" size="sm" variant="outline" className="gap-1.5">
                        {recommendationsOpen ? 'Hide details' : 'View details'}
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', recommendationsOpen && 'rotate-180')} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="space-y-3 p-0">
                  <div className="mx-4 rounded-md border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-900">
                    Esta seccion mira solo materiales favoritos, revisa los proximos{' '}
                    {replenishment.rules.lookaheadProjects} proyectos activos, mantiene{' '}
                    {replenishment.rules.favoriteReserveMinimum} piezas de reserva por favorito,
                    {includePending ? ' descuenta ordenes pendientes,' : ' ignora ordenes pendientes,'} y sugiere revisar cada{' '}
                    {replenishment.rules.reorderCycleDays} dias.
                  </div>

                  <div className="flex items-center justify-end px-4">
                    {recommendedItems.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={allRecommendedSelected ? clearSelection : selectAllRecommended}
                      >
                        {allRecommendedSelected ? 'Deselect recommended' : 'Select recommended'}
                      </Button>
                    )}
                  </div>

                  {replenishment.items.length === 0 ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      Select favorites to calculate purchase recommendations.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>Family</TableHead>
                            <TableHead className="text-right">Available</TableHead>
                            <TableHead className="text-right">Pending</TableHead>
                            <TableHead className="text-right">Next 25 projects</TableHead>
                            <TableHead className="text-right">Reserve</TableHead>
                            <TableHead className="text-right">Order</TableHead>
                            <TableHead>Projects</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {replenishment.items.map((item) => (
                            <TableRow key={item.productId}>
                              <TableCell>
                                <p className="font-medium text-sm leading-tight">{item.productName}</p>
                                <p className="text-xs text-muted-foreground">{item.productCode}</p>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.family || '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{item.availableNow}</TableCell>
                              <TableCell className="text-right tabular-nums text-blue-700">
                                {item.pendingPurchases ? `+${item.pendingPurchases}` : '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-amber-700">
                                {item.nextProjectsDemand || '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{item.reserveMinimum}</TableCell>
                              <TableCell className="text-right">
                                {item.recommendedOrder > 0 ? (
                                  <Badge className="bg-teal-100 text-teal-800 border border-teal-200">
                                    {item.recommendedOrder}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-emerald-700">Covered</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {item.projects.slice(0, 2).map((project) => (
                                    <Tooltip key={project.id}>
                                      <TooltipTrigger>
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 h-4 cursor-default max-w-[100px] truncate block"
                                        >
                                          {project.name}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {project.name} needs {project.needed} {item.unitOfMeasure}
                                        {project.date ? ` - ${project.date}` : ''}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                  {item.projects.length > 2 && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                                      +{item.projects.length - 2}
                                    </Badge>
                                  )}
                                  {item.projects.length === 0 && (
                                    <span className="text-xs text-muted-foreground">Reserve only</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* ── Info footer ── */}
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 text-sm text-blue-800 dark:text-blue-200">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">How this forecast is calculated</p>
            <ul className="list-disc list-inside text-xs space-y-0.5 text-blue-700 dark:text-blue-300">
              <li>
                <strong>On Shelves</strong> — stock placed on warehouse shelves right now.
              </li>
              <li>
                <strong>Receiving</strong> — received from suppliers but not yet placed on a shelf.
              </li>
              {includePending && (
                <li>
                  <strong>Pending Orders</strong> — quantities in purchase orders already created
                  but not yet received. Toggle off to see the conservative forecast.
                </li>
              )}
              <li>
                <strong>Project Needs</strong> — remaining quantities still required by active
                projects (planned − already dispatched).
              </li>
              <li>This is a read-only calculation. No inventory data is changed.</li>
            </ul>
          </div>
        </div>

      </div>

      {/* ── PO Confirmation Modal ── */}
      <POConfirmModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        selectedItems={selectedItems}
        targetDate={targetDate}
        onSuccess={clearSelection}
      />

      <Dialog open={favoritesOpen} onOpenChange={setFavoritesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Forecast Favorites
            </DialogTitle>
            <DialogDescription>
              Pick the products you usually order and want to track closely. These stay visible in the Favorites tab and are marked as 25-day delay watch items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={favoriteSearch}
              onChange={(event) => setFavoriteSearch(event.target.value)}
              placeholder="Search products by name or code"
            />
            <div className="max-h-96 overflow-y-auto rounded-md border">
              {favoriteProductOptions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>
              ) : (
                favoriteProductOptions.map((product) => {
                  const checked = favoriteIds.has(product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                      onClick={() => toggleFavorite(product.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {product.code} · stock {product._totalShelfStock ?? product.currentStock ?? 0}
                        </span>
                      </span>
                      <Star className={cn('h-4 w-4 shrink-0 text-muted-foreground', checked && 'fill-current text-amber-500')} />
                    </button>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFavoriteIds(new Set())} disabled={favoriteIds.size === 0}>
              Clear favorites
            </Button>
            <Button onClick={() => setFavoritesOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
