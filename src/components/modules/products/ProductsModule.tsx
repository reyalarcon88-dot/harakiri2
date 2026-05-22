'use client'

import { useState, Fragment, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useI18n } from '@/components/layout/I18nProvider'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Package,
  Loader2,
  Lock,
  LockOpen,
  ShieldAlert,
  Download,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { ENGINEERING_SECTIONS } from '@/lib/engineering-sections'

/* ─── Types ─────────────────────────────────────────── */

interface ShelfStock {
  id: string
  quantity: number
  reserveQuantity: number
  isReserveShelf: boolean
  reserveMinimum: number
  reserveNotes: string
  availableQuantity: number
  shelf: {
    id: string
    name: string
    rack: {
      id: string
      name: string
      warehouse: { id: string; name: string }
    }
  }
}

interface ReserveForm {
  reserveQuantity: number
  isReserveShelf: boolean
  reserveNotes: string
}

interface Product {
  id: string
  code: string
  name: string
  family: string
  engineeringSection: string
  unitOfMeasure: string
  unitQuantity: number
  minStock: number
  currentStock: number
  referencePrice: number
  preferredShelfId: string | null
  createdAt: string
  _totalShelfStock: number
  shelfStocks: ShelfStock[]
}

interface FlatShelf {
  id: string
  name: string
  rackName: string
  warehouseName: string
}

interface WarehouseWithRacks {
  id: string
  name: string
  racks: {
    id: string
    name: string
    shelves: { id: string; name: string }[]
  }[]
}

interface ProductFormData {
  code: string
  name: string
  family: string
  engineeringSection: string
  unitOfMeasure: string
  unitQuantity: number
  minStock: number
  currentStock: number
  referencePrice: number
  preferredShelfId: string | null
}

const emptyForm: ProductFormData = {
  code: '',
  name: '',
  family: '',
  engineeringSection: '',
  unitOfMeasure: 'unidad',
  unitQuantity: 1,
  minStock: 0,
  currentStock: 0,
  referencePrice: 0,
  preferredShelfId: null,
}

/* ─── Helper ────────────────────────────────────────── */

function getStockBadgeClasses(current: number, min: number) {
  if (current === 0)
    return 'text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/35'
  if (current < min)
    return 'text-rose-500 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/35'
  if (current < min * 1.5)
    return 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35'
  return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30'
}

function formatShelfPath(shelfId: string | null, shelves: FlatShelf[]) {
  if (!shelfId) return ''
  const shelf = shelves.find((item) => item.id === shelfId)
  return shelf ? `${shelf.name} / ${shelf.rackName} / ${shelf.warehouseName}` : ''
}

function buildProductExportRows(products: Product[], shelves: FlatShelf[]) {
  return products.map((product) => ({
    Code: product.code,
    Name: product.name,
    Family: product.family,
    'Engineering Section': product.engineeringSection,
    'Unit of Measure': product.unitOfMeasure,
    'Unit Quantity': product.unitQuantity,
    'Minimum Stock': product.minStock,
    'Current Stock': product.currentStock,
    'Total Shelf Stock': product._totalShelfStock,
    'Preferred Location': formatShelfPath(product.preferredShelfId, shelves),
    'Reference Price': product.referencePrice,
    'Created At': product.createdAt,
  }))
}

function buildLocationExportRows(products: Product[]) {
  return products.flatMap((product) =>
    product.shelfStocks.map((stock) => ({
      Code: product.code,
      Name: product.name,
      Family: product.family,
      Warehouse: stock.shelf.rack.warehouse.name,
      Rack: stock.shelf.rack.name,
      Shelf: stock.shelf.name,
      Quantity: Number(stock.quantity),
      Reserved: stock.isReserveShelf ? Number(stock.quantity) : Number(stock.reserveQuantity || 0),
      Available: Number(stock.availableQuantity || 0),
      'Full Shelf Reserved': stock.isReserveShelf ? 'Yes' : 'No',
      'Reserve Minimum': Number(stock.reserveMinimum || 0),
      'Reserve Notes': stock.reserveNotes || '',
      'Preferred Location': product.preferredShelfId === stock.shelf.id ? 'Yes' : 'No',
    }))
  )
}

/* ─── Component ─────────────────────────────────────── */

export function ProductsModule() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState<string>('')
  const [inStockOnly, setInStockOnly] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [newFamily, setNewFamily] = useState(false)
  const [reserveStock, setReserveStock] = useState<ShelfStock | null>(null)
  const [reserveForm, setReserveForm] = useState<ReserveForm>({ reserveQuantity: 0, isReserveShelf: false, reserveNotes: '' })

  /* ── Queries ── */
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search, familyFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (familyFilter) params.set('family', familyFilter)
      const qs = params.toString()
      return fetch(`/api/products${qs ? `?${qs}` : ''}`).then((r) => r.json())
    },
  })

  const { data: families = [] } = useQuery<string[]>({
    queryKey: ['product-families'],
    queryFn: () => fetch('/api/products/families').then((r) => r.json()),
  })

  const { data: warehouses = [] } = useQuery<WarehouseWithRacks[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await fetch('/api/warehouses')
      if (!response.ok) throw new Error(`Failed to fetch warehouses: ${response.status}`)
      const data = await response.json()
      return Array.isArray(data) ? data : []
    },
  })

  const shelves = useMemo<FlatShelf[]>(
    () =>
      warehouses.flatMap((w) =>
        w.racks.flatMap((r) =>
          r.shelves.map((s) => ({ id: s.id, name: s.name, rackName: r.name, warehouseName: w.name }))
        )
      ),
    [warehouses]
  )

  /* ── Group products by family ── */
  const filteredProducts = useMemo(
    () => (inStockOnly ? products.filter((product) => product._totalShelfStock > 0) : products),
    [inStockOnly, products]
  )

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, Product[]>()
    for (const p of filteredProducts) {
      const key = p.family?.trim() || t('common.noFamily')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === t('common.noFamily')) return 1
        if (b === t('common.noFamily')) return -1
        return a.localeCompare(b)
      })
  }, [filteredProducts, t])

  /* ── Reserve mutation ── */
  const reserveMutation = useMutation({
    mutationFn: (vars: ReserveForm & { shelfStockId: string }) =>
      fetch('/api/inventory/reserve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      }).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error || 'Error al guardar reserva'); return d })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Reserva actualizada')
      setReserveStock(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  /* ── Mutations ── */
  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) =>
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-families'] })
      toast.success(t('products.createdSuccess'))
      setAddDialogOpen(false)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductFormData> }) =>
      fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || t('common.errorGeneric')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-families'] })
      toast.success(t('products.updatedSuccess'))
      setEditDialogOpen(false)
      setSelectedProduct(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const [deleteBlockers, setDeleteBlockers] = useState<{ label: string; count: number }[]>([])

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
      const url = `/api/products/${id}${force ? '?force=true' : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(data.error || t('common.errorGeneric'))
        ;(err as Error & { blockers?: typeof deleteBlockers; canForce?: boolean }).blockers = data.blockers
        ;(err as Error & { blockers?: typeof deleteBlockers; canForce?: boolean }).canForce = data.canForce
        throw err
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-families'] })
      toast.success(t('products.deletedSuccess'))
      setDeleteDialogOpen(false)
      setSelectedProduct(null)
      setDeleteBlockers([])
    },
    onError: (err: Error & { blockers?: typeof deleteBlockers; canForce?: boolean }) => {
      if (err.canForce && err.blockers) {
        setDeleteBlockers(err.blockers)
      } else {
        toast.error(err.message)
      }
    },
  })


  /* ── Handlers ── */
  const resetForm = () => {
    setForm(emptyForm)
    setNewFamily(false)
  }

  const openEdit = (product: Product) => {
    setSelectedProduct(product)
    setForm({
      code: product.code,
      name: product.name,
      family: product.family,
      engineeringSection: product.engineeringSection || '',
      unitOfMeasure: product.unitOfMeasure,
      unitQuantity: product.unitQuantity,
      minStock: product.minStock,
      currentStock: product.currentStock,
      referencePrice: product.referencePrice || 0,
      preferredShelfId: product.preferredShelfId ?? null,
    })
    setNewFamily(!families.includes(product.family) && product.family !== '')
    setEditDialogOpen(true)
  }

  const openDelete = (product: Product) => {
    setSelectedProduct(product)
    setDeleteDialogOpen(true)
  }

  const unitLabelMap: Record<string, string> = {
    unidad: t('products.units.unit'),
    kg: t('products.units.kg'),
    lb: t('products.units.lb'),
    m: t('products.units.m'),
    m2: t('products.units.m2'),
    m3: t('products.units.m3'),
    lt: t('products.units.lt'),
    gal: t('products.units.gal'),
    caja: t('products.units.box'),
    rollo: t('products.units.roll'),
    bolsa: t('products.units.bag'),
  }

  const getUnitLabel = (value: string) => unitLabelMap[value] ?? value

  const toggleExpand = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id))
  }

  const handleExportExcel = async () => {
    try {
      const [XLSX, allProductsResponse] = await Promise.all([
        import('xlsx'),
        fetch('/api/products'),
      ])

      if (!allProductsResponse.ok) {
        throw new Error(t('common.errorGeneric'))
      }

      const allProducts = await allProductsResponse.json() as Product[]
      const workbook = XLSX.utils.book_new()
      const filteredProductRows = buildProductExportRows(filteredProducts, shelves)
      const allProductRows = buildProductExportRows(allProducts, shelves)
      const filteredLocationRows = buildLocationExportRows(filteredProducts)
      const allLocationRows = buildLocationExportRows(allProducts)

      const productColumns = [
        { wch: 18 }, { wch: 42 }, { wch: 24 }, { wch: 22 },
        { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 16 }, { wch: 42 }, { wch: 15 }, { wch: 24 },
      ]
      const locationColumns = [
        { wch: 18 }, { wch: 42 }, { wch: 24 }, { wch: 22 },
        { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 32 },
        { wch: 18 },
      ]

      const sheets = [
        { name: 'Productos filtrados', rows: filteredProductRows, cols: productColumns },
        { name: 'Todos los productos', rows: allProductRows, cols: productColumns },
        { name: 'Ubicaciones filtradas', rows: filteredLocationRows, cols: locationColumns },
        { name: 'Ubicaciones todas', rows: allLocationRows, cols: locationColumns },
      ]

      for (const sheet of sheets) {
        const worksheet = XLSX.utils.json_to_sheet(sheet.rows)
        worksheet['!cols'] = sheet.cols
        if (sheet.rows.length > 0) {
          worksheet['!autofilter'] = {
            ref: XLSX.utils.encode_range({
              s: { r: 0, c: 0 },
              e: { r: sheet.rows.length, c: Object.keys(sheet.rows[0]).length - 1 },
            }),
          }
        }
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
      }

      const safeDate = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `RMC-Productos-Almacen-${safeDate}.xlsx`, { compression: true })
    } catch (error) {
      console.error('Products Excel export error:', error)
      toast.error(t('products.exportError'))
    }
  }


  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('products.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={familyFilter} onValueChange={(v) => setFamilyFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t('common.allFamilies')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.allFamilies')}</SelectItem>
              {families.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inStockOnly ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInStockOnly(false)}
              className="shrink-0 gap-1.5"
            >
              <Package className="h-4 w-4" />
              {t('products.showAll')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setInStockOnly(true)}
              className="shrink-0 gap-1.5"
            >
              <Package className="h-4 w-4" />
              {t('products.inStockOnly')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void handleExportExcel()} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            {t('products.exportExcel')}
          </Button>
          <Button onClick={() => { resetForm(); setAddDialogOpen(true) }} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            {t('products.button')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Package}
                title={t('products.emptyTitle')}
                description={search || familyFilter || inStockOnly
                  ? t('products.emptyDescriptionFiltered')
                  : t('products.emptyDescriptionDefault')
                }
                action={
                  !search && !familyFilter && !inStockOnly && (
                    <Button size="sm" onClick={() => { resetForm(); setAddDialogOpen(true) }}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('products.addTitle')}
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-9" />
                    <TableHead>{t('products.table.code')}</TableHead>
                    <TableHead>{t('products.table.name')}</TableHead>
                    <TableHead>{t('products.table.family')}</TableHead>
                    <TableHead>{t('products.fields.engineeringSection')}</TableHead>
                    <TableHead>{t('products.table.unit')}</TableHead>
                    <TableHead className="text-right">{t('products.table.stock')}</TableHead>
                    <TableHead className="text-right">{t('products.table.minimum')}</TableHead>
                    <TableHead className="w-24 text-right">{t('products.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedProducts.map(([familyName, familyProducts]) => {
                    const isCollapsed = collapsedFamilies.has(familyName)
                    return (
                  <Fragment key={`family-${familyName}`}>
                    <TableRow
                      className="bg-muted/60 hover:bg-muted/70 cursor-pointer border-t-2"
                      onClick={() => setCollapsedFamilies((prev) => {
                        const next = new Set(prev)
                        if (next.has(familyName)) next.delete(familyName)
                        else next.add(familyName)
                        return next
                      })}
                    >
                      <TableCell className="w-9 px-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell colSpan={8} className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm uppercase tracking-wide">
                            {familyName}
                          </span>
                          <Badge variant="secondary" className="h-5 text-[10px]">
                            {familyProducts.length}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                    {!isCollapsed && familyProducts.map((product) => (
                    <Fragment key={product.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpand(product.id)}
                      >
                        <TableCell className="w-9 px-2">
                          {expandedRow === product.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{product.code}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {product.family ? (
                            <Badge variant="secondary" className="text-[10px]">{product.family}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {product.engineeringSection ? (
                            <Badge variant="outline" className="text-[10px]">{product.engineeringSection}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getUnitLabel(product.unitOfMeasure)}
                          {product.unitQuantity > 1 && ` (x${product.unitQuantity})`}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex items-center justify-center min-w-[3rem] rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${getStockBadgeClasses(product._totalShelfStock, product.minStock)}`}>
                            {product._totalShelfStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {product.minStock}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(product)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500 hover:text-rose-600"
                              onClick={() => openDelete(product)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRow === product.id && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 px-8 py-3">
                            {product.preferredShelfId && (() => {
                              const ps = shelves.find((s) => s.id === product.preferredShelfId)
                              return ps ? (
                                <p className="mb-2 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{t('products.fields.preferredShelf')}:</span>{' '}
                                  {ps.name} / {ps.rackName} / {ps.warehouseName}
                                </p>
                              ) : null
                            })()}
                          {product.shelfStocks.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">
                                {t('products.noLocations')}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  {t('products.locationsTitle')}
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {product.shelfStocks.map((ss) => {
                                    const hasReserve = ss.isReserveShelf || ss.reserveQuantity > 0
                                    return (
                                      <div
                                        key={ss.id}
                                        className={`flex items-start justify-between gap-2 rounded-lg border bg-background p-3 ${hasReserve ? 'border-amber-200 bg-amber-50/40' : ''}`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-medium truncate">
                                            {ss.shelf.rack.warehouse.name}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground truncate">
                                            {ss.shelf.rack.name} → {ss.shelf.name}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm font-bold tabular-nums">{Number(ss.quantity)}</span>
                                            {hasReserve && (
                                              <div className="flex items-center gap-1">
                                                <span className="text-[11px] text-emerald-700 tabular-nums font-medium">
                                                  {ss.availableQuantity} libre
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">·</span>
                                                <span className="text-[11px] text-amber-700 tabular-nums font-medium flex items-center gap-0.5">
                                                  <Lock className="h-2.5 w-2.5" />
                                                  {ss.isReserveShelf ? Number(ss.quantity) : ss.reserveQuantity} reservado
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                          {ss.reserveNotes && (
                                            <p className="text-[10px] text-amber-700/70 mt-0.5 italic truncate">{ss.reserveNotes}</p>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => {
                                            setReserveStock(ss)
                                            setReserveForm({
                                              reserveQuantity: ss.isReserveShelf ? Number(ss.quantity) : ss.reserveQuantity,
                                              isReserveShelf: ss.isReserveShelf,
                                              reserveNotes: ss.reserveNotes,
                                            })
                                          }}
                                          className={`shrink-0 rounded p-1 transition-colors ${hasReserve ? 'text-amber-600 hover:bg-amber-100' : 'text-muted-foreground hover:bg-muted'}`}
                                          title="Gestionar reserva"
                                        >
                                          {hasReserve ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                  </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Reserve Dialog ── */}
      <Dialog open={!!reserveStock} onOpenChange={(open) => { if (!open) setReserveStock(null) }}>
        <DialogContent className="sm:max-w-sm">
          {reserveStock && (() => {
            const total = Number(reserveStock.quantity)
            const available = reserveForm.isReserveShelf
              ? 0
              : Math.max(total - (reserveForm.reserveQuantity || 0), 0)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-600" /> Gestionar Reserva
                  </DialogTitle>
                  <DialogDescription>
                    {reserveStock.shelf.rack.warehouse.name} / {reserveStock.shelf.rack.name} / {reserveStock.shelf.name}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-muted-foreground">Total</p>
                      <p className="text-lg font-semibold tabular-nums">{total}</p>
                    </div>
                    <div className="rounded-md border p-2 border-emerald-200 bg-emerald-50">
                      <p className="text-emerald-700">Disponible</p>
                      <p className="text-lg font-semibold tabular-nums text-emerald-700">{available}</p>
                    </div>
                    <div className="rounded-md border p-2 border-amber-200 bg-amber-50">
                      <p className="text-amber-700">Reservado</p>
                      <p className="text-lg font-semibold tabular-nums text-amber-700">
                        {reserveForm.isReserveShelf ? total : (reserveForm.reserveQuantity || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Whole shelf toggle */}
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Estante completo en reserva</p>
                      <p className="text-xs text-muted-foreground">Bloquea todo el stock de esta ubicación</p>
                    </div>
                    <button
                      onClick={() => setReserveForm((f) => ({ ...f, isReserveShelf: !f.isReserveShelf, reserveQuantity: !f.isReserveShelf ? total : 0 }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${reserveForm.isReserveShelf ? 'bg-amber-500' : 'bg-input'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reserveForm.isReserveShelf ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Partial reserve qty */}
                  {!reserveForm.isReserveShelf && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cantidad reservada (de {total})</Label>
                      <Input
                        type="number"
                        min={0}
                        max={total}
                        value={reserveForm.reserveQuantity || 0}
                        onChange={(e) => setReserveForm((f) => ({ ...f, reserveQuantity: Math.min(parseInt(e.target.value) || 0, total) }))}
                        className="h-8"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Razón / notas</Label>
                    <Input
                      value={reserveForm.reserveNotes}
                      onChange={(e) => setReserveForm((f) => ({ ...f, reserveNotes: e.target.value }))}
                      placeholder="Ej: Devolución cliente, stock de emergencia…"
                      className="h-8"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setReserveStock(null)}>Cancelar</Button>
                  <Button
                    size="sm"
                    onClick={() => reserveMutation.mutate({ shelfStockId: reserveStock.id, ...reserveForm })}
                    disabled={reserveMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {reserveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar reserva
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Add Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('products.addTitle')}</DialogTitle>
            <DialogDescription>{t('products.addDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-code">{t('common.codeRequired')}</Label>
              <Input
                id="add-code"
                placeholder={t('products.fields.codePlaceholder')}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-name">{t('common.nameRequired')}</Label>
              <Input
                id="add-name"
                placeholder={t('products.fields.namePlaceholder')}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>{t('common.family')}</Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    setNewFamily((v) => !v)
                    if (!newFamily) setForm((f) => ({ ...f, family: '' }))
                  }}
                >
                  {newFamily ? t('common.selectExisting') : t('common.createNewFamily')}
                </Button>
              </div>
              {newFamily ? (
                <Input
                  placeholder={t('products.fields.familyPlaceholder')}
                  value={form.family}
                  onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
                />
              ) : (
                <Select
                  value={form.family || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, family: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('common.noFamily')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('common.noFamily')}</SelectItem>
                    {families.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label>{t('products.fields.engineeringSection')}</Label>
              <Select
                value={form.engineeringSection || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, engineeringSection: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('products.fields.engineeringSectionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('products.fields.engineeringSectionPlaceholder')}</SelectItem>
                  {ENGINEERING_SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used to group this product in project material lists.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-uom">{t('products.fields.unitOfMeasure')}</Label>
                <Select
                  value={form.unitOfMeasure}
                  onValueChange={(v) => setForm((f) => ({ ...f, unitOfMeasure: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">{t('products.units.unit')}</SelectItem>
                    <SelectItem value="kg">{t('products.units.kg')}</SelectItem>
                    <SelectItem value="lb">{t('products.units.lb')}</SelectItem>
                    <SelectItem value="m">{t('products.units.m')}</SelectItem>
                    <SelectItem value="m2">{t('products.units.m2')}</SelectItem>
                    <SelectItem value="m3">{t('products.units.m3')}</SelectItem>
                    <SelectItem value="lt">{t('products.units.lt')}</SelectItem>
                    <SelectItem value="gal">{t('products.units.gal')}</SelectItem>
                    <SelectItem value="caja">{t('products.units.box')}</SelectItem>
                    <SelectItem value="rollo">{t('products.units.roll')}</SelectItem>
                    <SelectItem value="bolsa">{t('products.units.bag')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-uqty">{t('products.fields.quantityPerUnit')}</Label>
                <Input
                  id="add-uqty"
                  type="number"
                  min={1}
                  value={form.unitQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, unitQuantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-minstock">{t('products.fields.minimumStock')}</Label>
                <Input
                  id="add-minstock"
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={(e) => setForm((f) => ({ ...f, minStock: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-reference-price">{t('reports.inventory.kpis.referencePrice')}</Label>
                <Input
                  id="add-reference-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.referencePrice}
                  onChange={(e) => setForm((f) => ({ ...f, referencePrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('products.fields.preferredShelf')}</Label>
              <Select
                value={form.preferredShelfId ?? '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, preferredShelfId: v === '__none__' ? null : v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('products.fields.preferredShelfPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('products.fields.preferredShelfNone')}</SelectItem>
                  {shelves.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} / {s.rackName} / {s.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.code || !form.name || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('products.addTitle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('products.editTitle')}</DialogTitle>
            <DialogDescription>{t('products.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-code">{t('common.codeRequired')}</Label>
              <Input
                id="edit-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">{t('common.nameRequired')}</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>{t('common.family')}</Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    setNewFamily((v) => !v)
                    if (!newFamily) setForm((f) => ({ ...f, family: '' }))
                  }}
                >
                  {newFamily ? t('common.selectExisting') : t('common.createNewFamily')}
                </Button>
              </div>
              {newFamily ? (
                <Input
                  placeholder={t('products.fields.familyPlaceholder')}
                  value={form.family}
                  onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
                />
              ) : (
                <Select
                  value={form.family || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, family: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('common.noFamily')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('common.noFamily')}</SelectItem>
                    {families.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label>{t('products.fields.engineeringSection')}</Label>
              <Select
                value={form.engineeringSection || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, engineeringSection: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('products.fields.engineeringSectionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('products.fields.engineeringSectionPlaceholder')}</SelectItem>
                  {ENGINEERING_SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used to group this product in project material lists.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('products.fields.unitOfMeasure')}</Label>
                <Select
                  value={form.unitOfMeasure}
                  onValueChange={(v) => setForm((f) => ({ ...f, unitOfMeasure: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">{t('products.units.unit')}</SelectItem>
                    <SelectItem value="kg">{t('products.units.kg')}</SelectItem>
                    <SelectItem value="lb">{t('products.units.lb')}</SelectItem>
                    <SelectItem value="m">{t('products.units.m')}</SelectItem>
                    <SelectItem value="m2">{t('products.units.m2')}</SelectItem>
                    <SelectItem value="m3">{t('products.units.m3')}</SelectItem>
                    <SelectItem value="lt">{t('products.units.lt')}</SelectItem>
                    <SelectItem value="gal">{t('products.units.gal')}</SelectItem>
                    <SelectItem value="caja">{t('products.units.box')}</SelectItem>
                    <SelectItem value="rollo">{t('products.units.roll')}</SelectItem>
                    <SelectItem value="bolsa">{t('products.units.bag')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t('products.fields.quantityPerUnit')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.unitQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, unitQuantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('products.fields.minimumStock')}</Label>
              <Input
                type="number"
                min={0}
                value={form.minStock}
                onChange={(e) => setForm((f) => ({ ...f, minStock: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('reports.inventory.kpis.referencePrice')}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.referencePrice}
                onChange={(e) => setForm((f) => ({ ...f, referencePrice: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">
                Used for project budget and purchase price estimates.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>{t('products.fields.preferredShelf')}</Label>
              <Select
                value={form.preferredShelfId ?? '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, preferredShelfId: v === '__none__' ? null : v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('products.fields.preferredShelfPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('products.fields.preferredShelfNone')}</SelectItem>
                  {shelves.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} / {s.rackName} / {s.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (selectedProduct) updateMutation.mutate({ id: selectedProduct.id, data: form })
              }}
              disabled={!form.code || !form.name || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteBlockers([])
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteBlockers.length > 0 ? t('products.deleteWithHistoryTitle') : t('products.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {/* Tarjeta de identidad del producto — para confirmar qué se está borrando */}
                {selectedProduct && (
                  <div className="rounded-md border bg-muted/40 px-3 py-2.5 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{selectedProduct.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{selectedProduct.code}</p>
                    </div>
                    {selectedProduct.family ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{selectedProduct.family}</Badge>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">{t('common.noFamily')}</span>
                    )}
                  </div>
                )}

                {deleteBlockers.length === 0 ? (
                  <p className="text-sm">
                    {t('products.deleteDescription', {
                      name: selectedProduct?.name ?? '',
                      code: selectedProduct?.code ?? '',
                    })}
                  </p>
                ) : (
                  <>
                    <p className="text-sm">
                      {t('products.deleteHistoryIntro', { name: selectedProduct?.name ?? '' })}
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {deleteBlockers.map((b) => (
                        <li key={b.label}>
                          <strong>{b.count}</strong> {b.label}
                        </li>
                      ))}
                    </ul>
                    <p className="text-destructive font-medium pt-1">
                      {t('products.deleteHistoryWarning')}
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={(e) => {
                e.preventDefault()
                if (selectedProduct) {
                  deleteMutation.mutate({
                    id: selectedProduct.id,
                    force: deleteBlockers.length > 0,
                  })
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteBlockers.length > 0 ? t('products.deleteWithHistoryAction') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
