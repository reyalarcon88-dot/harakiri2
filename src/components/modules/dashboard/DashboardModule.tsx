'use client'

import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Warehouse,
  Package,
  FolderKanban,
  ShoppingCart,
  AlertTriangle,
  Clock,
  CalendarClock,
  Calculator,
  Download,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useI18n } from '@/components/layout/I18nProvider'
import { EmptyState } from '@/components/shared/EmptyState'
import { MaterialProgressBar } from '@/components/shared/MaterialProgressBar'
import {
  formatLocaleCurrency,
  formatLocaleDate,
  formatLocaleInteger,
  formatLocaleNumber,
} from '@/lib/i18n/format'
import type { MessageKey } from '@/lib/i18n/messages'
import { getMaterialProgressTotals } from '@/lib/project-material-progress'

interface ShelfStockWithLocation {
  id: string
  quantity: number
  shelf: {
    name: string
    rack: {
      name: string
      warehouse: { name: string }
    }
  }
}

interface LowStockProduct {
  id: string
  code: string
  name: string
  minStock: number
  currentStock: number
  shelfStocks: ShelfStockWithLocation[]
}

interface ProjectMaterial {
  plannedQuantity: number
  dispatchedQuantity: number
}

interface ActiveProject {
  id: string
  name: string
  status: string
  budget: number
  client: { name: string }
  materials: ProjectMaterial[]
}

interface Task {
  id: string
  title: string
  dueDate: string | null
  alarmDate: string | null
  status: string
  project?: {
    id: string
    name: string
    poNumber: string
  } | null
}

interface MaterialPrice {
  productId: string
  productName: string
  code: string
  family: string
  unitOfMeasure: string
  currentStock: number
  unitPrice: number
}

interface DashboardStats {
  totalWarehouses: number
  totalProducts: number
  activeProjects: number
  pendingPurchases: number
  lowStockProducts: LowStockProduct[]
  activeProjectsList: ActiveProject[]
  recentTasks: Task[]
  materialPrices: MaterialPrice[]
}

interface CostLine {
  id: string
  productId: string
  quantity: number
}

interface ComparisonLine {
  id: string
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  source: 'catalog' | 'manual'
  baseLineId: string | null
  equivalenceFactor: number
}

interface ImportedCostSummary {
  fileName: string
  imported: number
  skipped: number
  errors: string[]
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeHeader(value: unknown) {
  return normalizeText(value).replace(/[\s_-]+/g, '')
}

function parseQuantity(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value ?? '')
    .trim()
    .replace(/,/g, '.')
  const quantity = Number(normalized)
  return Number.isFinite(quantity) ? quantity : 0
}

function getStatusConfig(status: string): { className: string; labelKey?: MessageKey } {
  switch (status) {
    case 'completed':
      return {
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        labelKey: 'dashboard.status.completed',
      }
    case 'in_progress':
      return {
        className: 'bg-amber-100 text-amber-700 border-amber-200',
        labelKey: 'dashboard.status.inProgress',
      }
    case 'planned':
      return {
        className: 'bg-sky-100 text-sky-700 border-sky-200',
        labelKey: 'dashboard.status.planned',
      }
    case 'scheduled':
      return {
        className: 'bg-sky-100 text-sky-700 border-sky-200',
        labelKey: 'status.project.scheduled',
      }
    case 'pending':
      return {
        className: 'bg-amber-100 text-amber-700 border-amber-200',
        labelKey: 'dashboard.status.pending',
      }
    default:
      return { className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

function StatsCards({ stats }: { stats: DashboardStats }) {
  const { locale, t } = useI18n()
  const cards = [
    {
      titleKey: 'dashboard.stats.totalWarehouses' as const,
      value: stats.totalWarehouses,
      icon: Warehouse,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      titleKey: 'dashboard.stats.totalProducts' as const,
      value: stats.totalProducts,
      icon: Package,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      titleKey: 'dashboard.stats.activeProjects' as const,
      value: stats.activeProjects,
      icon: FolderKanban,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      titleKey: 'dashboard.stats.pendingPurchases' as const,
      value: stats.pendingPurchases,
      icon: ShoppingCart,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.titleKey} className="min-w-0 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{t(card.titleKey)}</p>
                <p className="text-2xl font-bold tabular-nums">{formatLocaleInteger(locale, card.value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-11 w-11 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-12" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function LowStockAlerts({ products }: { products: LowStockProduct[] }) {
  const { locale, t } = useI18n()

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <CardTitle className="text-base">{t('dashboard.lowStock.title')}</CardTitle>
        </div>
        <CardDescription>{t('dashboard.lowStock.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('dashboard.lowStock.emptyTitle')}
            description={t('dashboard.lowStock.emptyDescription')}
          />
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.lowStock.codeLabel')}: {product.code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-rose-600 tabular-nums">
                      {formatLocaleNumber(locale, product.currentStock)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('dashboard.lowStock.minimumLabel', {
                        minimum: formatLocaleNumber(locale, product.minStock),
                      })}
                    </span>
                  </div>
                </div>
                {product.shelfStocks.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {product.shelfStocks.map((ss) => (
                      <Badge
                        key={ss.id}
                        variant="outline"
                        className="max-w-full justify-start text-[10px] font-normal"
                        title={`${ss.shelf.rack.warehouse.name} / ${ss.shelf.rack.name} / ${ss.shelf.name}`}
                      >
                        {ss.shelf.rack.warehouse.name} / {ss.shelf.rack.name} / {ss.shelf.name}:{' '}
                        {formatLocaleNumber(locale, ss.quantity)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActiveProjectsSection({ projects }: { projects: ActiveProject[] }) {
  const { locale, t } = useI18n()

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">{t('dashboard.activeProjects.title')}</CardTitle>
        </div>
        <CardDescription>{t('dashboard.activeProjects.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={t('dashboard.activeProjects.emptyTitle')}
            description={t('dashboard.activeProjects.emptyDescription')}
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {projects.map((project) => {
              const materialTotals = getMaterialProgressTotals(project.materials)
              const statusConfig = getStatusConfig(project.status)
              const statusLabel = statusConfig.labelKey ? t(statusConfig.labelKey) : project.status

              return (
                <div key={project.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.client.name}</p>
                    </div>
                    <Badge
                      className={`max-w-[45%] text-[10px] ${statusConfig.className}`}
                      title={statusLabel}
                    >
                      <span className="truncate">{statusLabel}</span>
                    </Badge>
                  </div>
                  {materialTotals.planned > 0 && (
                    <MaterialProgressBar
                      dispatched={materialTotals.dispatched}
                      planned={materialTotals.planned}
                    />
                  )}
                  {project.budget > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.activeProjects.budgetLabel')}:{' '}
                      <span className="font-medium text-foreground">
                        {formatLocaleCurrency(locale, project.budget)}
                      </span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecentTasksSection({ tasks }: { tasks: Task[] }) {
  const { locale, t } = useI18n()

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-violet-500" />
          <CardTitle className="text-base">{t('dashboard.recentTasks.title')}</CardTitle>
        </div>
        <CardDescription>{t('dashboard.recentTasks.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t('dashboard.recentTasks.emptyTitle')}
            description={t('dashboard.recentTasks.emptyDescription')}
          />
        ) : (
          <div className="max-h-80 min-w-0 w-full overflow-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.recentTasks.table.dueDate')}</TableHead>
                  <TableHead>{t('dashboard.recentTasks.table.title')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('dashboard.recentTasks.table.project')}</TableHead>
                  <TableHead className="w-28">{t('dashboard.recentTasks.table.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const statusConfig = getStatusConfig(task.status)
                  const statusLabel = statusConfig.labelKey ? t(statusConfig.labelKey) : task.status
                  const isUrgent = task.alarmDate && new Date(task.alarmDate) <= new Date()

                  return (
                    <TableRow key={task.id} className={isUrgent ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="w-28 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {formatLocaleDate(locale, task.dueDate, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }) || '-'}
                      </TableCell>
                      <TableCell className="min-w-0 max-w-0 font-medium text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          {isUrgent && <Badge variant="destructive" className="text-xs shrink-0">!</Badge>}
                          <div className="min-w-0">
                            <span className="block truncate">{task.title}</span>
                            {task.project && (
                              <span className="block truncate text-xs font-normal text-muted-foreground lg:hidden">
                                {task.project.poNumber} · {task.project.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden min-w-0 max-w-0 lg:table-cell">
                        {task.project ? (
                          <Badge
                            variant="outline"
                            className="max-w-full justify-start border-blue-200 bg-blue-50 text-blue-700"
                            title={`${task.project.poNumber} · ${task.project.name}`}
                          >
                            <span className="truncate">{task.project.poNumber} · {task.project.name}</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="w-28 whitespace-nowrap">
                        <Badge className={`max-w-full text-[10px] ${statusConfig.className}`} title={statusLabel}>
                          <span className="truncate">{statusLabel}</span>
                        </Badge>
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
  )
}

function MaterialCostSection({ products }: { products: MaterialPrice[] }) {
  const { locale, t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quickQuantity, setQuickQuantity] = useState('1')
  const [costLines, setCostLines] = useState<CostLine[]>([])
  const [comparisonLines, setComparisonLines] = useState<ComparisonLine[]>([])
  const [importSummary, setImportSummary] = useState<ImportedCostSummary | null>(null)

  const productMap = useMemo(() => {
    return new Map(products.map((product) => [product.productId, product]))
  }, [products])

  const productCodeMap = useMemo(() => {
    return new Map(
      products
        .map((product) => [normalizeText(product.code), product] as const)
        .filter(([key]) => Boolean(key))
    )
  }, [products])

  const productNameMap = useMemo(() => {
    return new Map(
      products
        .map((product) => [normalizeText(product.productName), product] as const)
        .filter(([key]) => Boolean(key))
    )
  }, [products])

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    const rows = term
      ? products.filter((product) =>
          `${product.productName} ${product.code} ${product.family}`.toLowerCase().includes(term)
        )
      : products

    return rows
      .sort((a, b) => {
        if (a.unitPrice > 0 && b.unitPrice <= 0) return -1
        if (a.unitPrice <= 0 && b.unitPrice > 0) return 1
        return a.productName.localeCompare(b.productName)
      })
      .slice(0, 8)
  }, [products, query])

  const selectedProduct = productMap.get(selectedProductId) || visibleProducts[0] || null
  const quickQuantityNumber = Math.max(Number(quickQuantity) || 0, 0)
  const quickTotal = selectedProduct ? selectedProduct.unitPrice * quickQuantityNumber : 0
  const costRows = costLines
    .map((line) => ({
      line,
      product: productMap.get(line.productId),
    }))
    .filter((row): row is { line: CostLine; product: MaterialPrice } => Boolean(row.product))
  const estimateTotal = costRows.reduce(
    (sum, row) => sum + row.product.unitPrice * row.line.quantity,
    0
  )
  const comparisonRows = comparisonLines.map((line) => ({
    line,
    product: line.productId ? productMap.get(line.productId) || null : null,
    baseRow: line.baseLineId
      ? costRows.find((row) => row.line.id === line.baseLineId) || null
      : null,
    effectiveQuantity: (() => {
      const baseRow = line.baseLineId
        ? costRows.find((row) => row.line.id === line.baseLineId) || null
        : null
      return baseRow
        ? Math.max(baseRow.line.quantity * Math.max(line.equivalenceFactor || 0, 0), 0)
        : Math.max(line.quantity || 0, 0)
    })(),
  }))
  const comparisonTotal = comparisonRows.reduce(
    (sum, row) => sum + row.effectiveQuantity * Math.max(row.line.unitPrice || 0, 0),
    0
  )
  const comparisonDelta = comparisonTotal - estimateTotal
  const comparisonDeltaPercent = estimateTotal > 0 ? (comparisonDelta / estimateTotal) * 100 : 0
  const comparisonDeltaLabel =
    comparisonDelta === 0
      ? t('dashboard.materials.delta.none')
      : comparisonDelta < 0
        ? t('dashboard.materials.delta.savings', {
            amount: formatLocaleCurrency(locale, Math.abs(comparisonDelta)),
          })
        : t('dashboard.materials.delta.increase', {
            amount: formatLocaleCurrency(locale, comparisonDelta),
          })

  function addSelectedProduct() {
    if (!selectedProduct) return
    setCostLines((current) => [
      ...current,
      {
        id: `${selectedProduct.productId}-${Date.now()}`,
        productId: selectedProduct.productId,
        quantity: quickQuantityNumber > 0 ? quickQuantityNumber : 1,
      },
    ])
  }

  function createComparisonLine(product: MaterialPrice, quantity: number) {
    return {
      id: `${product.productId}-comparison-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: product.productId,
      description: product.productName,
      quantity: quantity > 0 ? quantity : 1,
      unitPrice: product.unitPrice,
      source: 'catalog' as const,
      baseLineId: null,
      equivalenceFactor: 1,
    }
  }

  function addSelectedProductToComparison() {
    if (!selectedProduct) return
    setComparisonLines((current) => [...current, createComparisonLine(selectedProduct, quickQuantityNumber)])
  }

  function updateLineQuantity(lineId: string, quantity: number) {
    setCostLines((current) =>
      current.map((line) =>
        line.id === lineId ? { ...line, quantity: Math.max(quantity || 0, 0) } : line
      )
    )
  }

  function removeLine(lineId: string) {
    setCostLines((current) => current.filter((line) => line.id !== lineId))
  }

  function addManualComparisonLine() {
    setComparisonLines((current) => [
      ...current,
      {
        id: `manual-comparison-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId: null,
        description: t('dashboard.materials.manualLineDefault'),
        quantity: 1,
        unitPrice: 0,
        source: 'manual',
        baseLineId: null,
        equivalenceFactor: 1,
      },
    ])
  }

  function updateComparisonLine(
    lineId: string,
    patch: Partial<
      Pick<ComparisonLine, 'description' | 'quantity' | 'unitPrice' | 'baseLineId' | 'equivalenceFactor'>
    >
  ) {
    setComparisonLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line
        return {
          ...line,
          ...patch,
          quantity:
            patch.quantity === undefined ? line.quantity : Math.max(Number(patch.quantity) || 0, 0),
          unitPrice:
            patch.unitPrice === undefined ? line.unitPrice : Math.max(Number(patch.unitPrice) || 0, 0),
          equivalenceFactor:
            patch.equivalenceFactor === undefined
              ? line.equivalenceFactor
              : Math.max(Number(patch.equivalenceFactor) || 0, 0),
        }
      })
    )
  }

  function removeComparisonLine(lineId: string) {
    setComparisonLines((current) => current.filter((line) => line.id !== lineId))
  }

  function copyBaseToComparison() {
    if (costRows.length === 0) {
      toast.error(t('dashboard.materials.importNeedsBase'))
      return
    }
    setComparisonLines(
      costRows.map(({ line, product }, index) => ({
        id: `${product.productId}-comparison-copy-${Date.now()}-${index}`,
        productId: product.productId,
        description: product.productName,
        quantity: line.quantity,
        unitPrice: product.unitPrice,
        source: 'catalog',
        baseLineId: line.id,
        equivalenceFactor: 1,
      }))
    )
    toast.success(t('dashboard.materials.importCopiedToComparison'))
  }

  function resolveProduct(code: string, material: string) {
    const codeKey = normalizeText(code)
    if (codeKey && productCodeMap.has(codeKey)) return productCodeMap.get(codeKey) || null

    const materialKey = normalizeText(material)
    if (!materialKey) return null
    if (productNameMap.has(materialKey)) return productNameMap.get(materialKey) || null

    return (
      products.find((product) => normalizeText(product.productName).includes(materialKey)) || null
    )
  }

  async function handleMaterialListUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      })

      const linesToAdd: CostLine[] = []
      const errors: string[] = []
      let skipped = 0

      rawRows.forEach((row, index) => {
        const normalizedRow = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
        )
        const code = String(
          normalizedRow.codigo ??
            normalizedRow.code ??
            normalizedRow.codigomaterial ??
            normalizedRow.codigoproducto ??
            ''
        ).trim()
        const material = String(
          normalizedRow.material ??
            normalizedRow.nombre ??
            normalizedRow.producto ??
            normalizedRow.nombreproducto ??
            ''
        ).trim()
        const quantityRaw =
          normalizedRow.cantidad ??
          normalizedRow.quantity ??
          normalizedRow.qty ??
          normalizedRow.piezas ??
          normalizedRow.pieza ??
          ''
        const quantity = parseQuantity(quantityRaw)
        const rowNumber = index + 2
        const hasContent = code || material || String(quantityRaw).trim()

        if (!hasContent) return

        const product = resolveProduct(code, material)
        if (!product) {
          skipped += 1
          if (errors.length < 5) {
            errors.push(
              t('dashboard.materials.importErrorNotFound', {
                row: rowNumber,
                reference: code || material,
              })
            )
          }
          return
        }
        if (quantity <= 0) {
          skipped += 1
          if (errors.length < 5) {
            errors.push(
              t('dashboard.materials.importErrorInvalidQuantity', {
                row: rowNumber,
                material: product.productName,
              })
            )
          }
          return
        }

        linesToAdd.push({
          id: `${product.productId}-${Date.now()}-${index}`,
          productId: product.productId,
          quantity,
        })
      })

      if (linesToAdd.length === 0) {
        setImportSummary({
          fileName: file.name,
          imported: 0,
          skipped,
          errors,
        })
        toast.error(t('dashboard.materials.importNoneValid'))
        return
      }

      setCostLines((current) => [...current, ...linesToAdd])
      setImportSummary({
        fileName: file.name,
        imported: linesToAdd.length,
        skipped,
        errors,
      })
      toast.success(
        t('dashboard.materials.importSuccess', {
          count: formatLocaleInteger(locale, linesToAdd.length),
        })
      )
      if (skipped > 0) {
        toast.warning(
          t('dashboard.materials.importSkipped', {
            count: formatLocaleInteger(locale, skipped),
          })
        )
      }
    } catch (error) {
      console.error('Error importando lista de materiales:', error)
      toast.error(t('dashboard.materials.importReadError'))
    } finally {
      event.target.value = ''
    }
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">{t('dashboard.materials.title')}</CardTitle>
            </div>
            <CardDescription className="mt-1">{t('dashboard.materials.description')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="h-auto gap-2 whitespace-normal">
              <a href="/templates/calculadora-materiales-plantilla.xlsx" download>
                <Download className="h-4 w-4" />
                {t('dashboard.materials.downloadTemplate')}
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto gap-2 whitespace-normal"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {t('dashboard.materials.uploadList')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleMaterialListUpload}
        />

        <div className="mb-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          {t('dashboard.materials.templateHelp')}
        </div>

        {importSummary && (
          <div className="mb-4 rounded-md border bg-muted/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {t('dashboard.materials.importedList', { fileName: importSummary.fileName })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.materials.importSummary', {
                    imported: formatLocaleInteger(locale, importSummary.imported),
                    skipped: formatLocaleInteger(locale, importSummary.skipped),
                  })}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setImportSummary(null)}>
                {t('dashboard.materials.hideSummary')}
              </Button>
            </div>
            {importSummary.errors.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                {importSummary.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title={t('dashboard.materials.emptyTitle')}
            description={t('dashboard.materials.emptyDescription')}
          />
        ) : (
          <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="min-w-0 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('dashboard.materials.searchPlaceholder')}
                  className="pl-9"
                />
              </div>

              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {visibleProducts.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    {t('dashboard.materials.noMatches')}
                  </div>
                ) : (
                  visibleProducts.map((product) => (
                    <button
                      key={product.productId}
                      type="button"
                      onClick={() => setSelectedProductId(product.productId)}
                      className={`w-full rounded-md border p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 ${
                        selectedProduct?.productId === product.productId
                          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{product.productName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.code || t('dashboard.materials.noCode')} - {product.family}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatLocaleCurrency(locale, product.unitPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('dashboard.materials.stockLabel', {
                              count: formatLocaleNumber(locale, product.currentStock),
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {selectedProduct && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.materials.selectedMaterial')}
                      </p>
                      <p className="truncate text-sm font-semibold">{selectedProduct.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.materials.unitPriceLabel', {
                          amount: formatLocaleCurrency(locale, selectedProduct.unitPrice),
                        })}
                      </p>
                    </div>
                    <div className="w-full shrink-0 sm:w-28">
                      <p className="mb-1 text-xs text-muted-foreground">{t('dashboard.materials.pieces')}</p>
                      <Input
                        type="number"
                        min="0"
                        value={quickQuantity}
                        onChange={(event) => setQuickQuantity(event.target.value)}
                        className="text-right"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 border-t pt-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('dashboard.materials.calculatedCost')}</p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {formatLocaleCurrency(locale, quickTotal)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto whitespace-normal"
                        onClick={addSelectedProductToComparison}
                      >
                        <Plus className="h-4 w-4" />
                        {t('dashboard.materials.addToComparison')}
                      </Button>
                      <Button type="button" className="h-auto whitespace-normal" onClick={addSelectedProduct}>
                        <Plus className="h-4 w-4" />
                        {t('dashboard.materials.addToBase')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 overflow-hidden rounded-md border">
              <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{t('dashboard.materials.base.title')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.materials.base.description')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {costRows.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal"
                      onClick={copyBaseToComparison}
                    >
                      {t('dashboard.materials.base.copyToComparison')}
                    </Button>
                  )}
                  {costRows.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto whitespace-normal"
                      onClick={() => setCostLines([])}
                    >
                      {t('dashboard.materials.base.clear')}
                    </Button>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t('dashboard.materials.base.total')}</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatLocaleCurrency(locale, estimateTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {costRows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t('dashboard.materials.base.empty', {
                    action: t('dashboard.materials.addToBase'),
                  })}
                </div>
              ) : (
                <div className="max-h-80 min-w-0 overflow-auto">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[55%]">{t('dashboard.materials.table.material')}</TableHead>
                        <TableHead className="w-24 text-right">{t('dashboard.materials.table.pieces')}</TableHead>
                        <TableHead className="w-28 text-right">{t('dashboard.materials.table.cost')}</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costRows.map(({ line, product }) => (
                        <TableRow key={line.id}>
                          <TableCell className="min-w-0 max-w-0">
                            <p className="truncate font-medium text-sm">{product.productName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatLocaleCurrency(locale, product.unitPrice)} {t('dashboard.materials.eachShort')}
                            </p>
                          </TableCell>
                          <TableCell className="w-24 whitespace-nowrap text-right">
                            <Input
                              type="number"
                              min="0"
                              value={line.quantity}
                              onChange={(event) => updateLineQuantity(line.id, Number(event.target.value))}
                              className="ml-auto h-8 w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="w-28 whitespace-nowrap text-right font-medium tabular-nums">
                            {formatLocaleCurrency(locale, product.unitPrice * line.quantity)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(line.id)}
                              aria-label={t('dashboard.materials.removeMaterial')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="grid gap-4 xl:col-span-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="min-w-0 overflow-hidden rounded-md border">
                <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t('dashboard.materials.comparison.title')}</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.materials.comparison.description')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal"
                      onClick={addSelectedProductToComparison}
                      disabled={!selectedProduct}
                    >
                      {t('dashboard.materials.comparison.addSelected')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal"
                      onClick={addManualComparisonLine}
                    >
                      {t('dashboard.materials.comparison.manualConcept')}
                    </Button>
                    {comparisonLines.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto whitespace-normal"
                        onClick={() => setComparisonLines([])}
                      >
                        {t('dashboard.materials.comparison.clear')}
                      </Button>
                    )}
                  </div>
                </div>

                {comparisonRows.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t('dashboard.materials.comparison.empty')}
                  </div>
                ) : (
                  <div className="max-h-[430px] min-w-0 overflow-auto">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[28%]">
                            {t('dashboard.materials.comparison.table.alternative')}
                          </TableHead>
                          <TableHead className="w-[22%]">
                            {t('dashboard.materials.comparison.table.base')}
                          </TableHead>
                          <TableHead className="w-20 text-right">
                            {t('dashboard.materials.comparison.table.equivalence')}
                          </TableHead>
                          <TableHead className="w-20 text-right">{t('dashboard.materials.table.pieces')}</TableHead>
                          <TableHead className="w-24 text-right">
                            {t('dashboard.materials.comparison.table.price')}
                          </TableHead>
                          <TableHead className="w-24 text-right">{t('dashboard.materials.table.cost')}</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonRows.map(({ line, product, baseRow, effectiveQuantity }) => (
                          <TableRow key={line.id}>
                            <TableCell className="min-w-0 max-w-0 align-top">
                              <Input
                                value={line.description}
                                onChange={(event) =>
                                  updateComparisonLine(line.id, { description: event.target.value })
                                }
                                className="h-8"
                              />
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="max-w-full text-[10px] font-normal">
                                  {line.source === 'catalog'
                                    ? t('dashboard.materials.source.catalog')
                                    : t('dashboard.materials.source.manual')}
                                </Badge>
                                {product?.code && <span className="truncate">{product.code}</span>}
                                {product?.family && <span className="truncate">{product.family}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-0 max-w-0 align-top">
                              <Select
                                value={line.baseLineId ?? 'manual'}
                                onValueChange={(value) =>
                                  updateComparisonLine(line.id, {
                                    baseLineId: value === 'manual' ? null : value,
                                  })
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder={t('dashboard.materials.comparison.manualConcept')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual">
                                    {t('dashboard.materials.manualPlaceholder')}
                                  </SelectItem>
                                  {costRows.map(({ line: baseLine, product: baseProduct }) => (
                                    <SelectItem key={baseLine.id} value={baseLine.id}>
                                      {baseProduct.productName} ({formatLocaleNumber(locale, baseLine.quantity)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {baseRow
                                  ? t('dashboard.materials.baseReference', {
                                      material: baseRow.product.productName,
                                      quantity: formatLocaleNumber(locale, baseRow.line.quantity),
                                    })
                                  : t('dashboard.materials.noBaseReference')}
                              </p>
                            </TableCell>
                            <TableCell className="w-20 whitespace-nowrap text-right align-top">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.equivalenceFactor}
                                onChange={(event) =>
                                  updateComparisonLine(line.id, {
                                    equivalenceFactor: Number(event.target.value),
                                  })
                                }
                                className="ml-auto h-8 w-16 text-right"
                                disabled={!line.baseLineId}
                              />
                              <p className="mt-2 text-xs text-muted-foreground">
                                {line.baseLineId
                                  ? t('dashboard.materials.equivalenceHint')
                                  : t('dashboard.materials.equivalenceDisabled')}
                              </p>
                            </TableCell>
                            <TableCell className="w-20 whitespace-nowrap text-right align-top">
                              <Input
                                type="number"
                                min="0"
                                value={line.baseLineId ? effectiveQuantity : line.quantity}
                                onChange={(event) =>
                                  updateComparisonLine(line.id, { quantity: Number(event.target.value) })
                                }
                                className="ml-auto h-8 w-16 text-right"
                                disabled={Boolean(line.baseLineId)}
                              />
                              {line.baseLineId && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {t('dashboard.materials.autoCalculated')}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="w-24 whitespace-nowrap text-right align-top">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateComparisonLine(line.id, { unitPrice: Number(event.target.value) })
                                }
                                className="ml-auto h-8 w-20 text-right"
                              />
                            </TableCell>
                            <TableCell className="w-24 whitespace-nowrap text-right font-medium tabular-nums align-top">
                              {formatLocaleCurrency(locale, effectiveQuantity * line.unitPrice)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeComparisonLine(line.id)}
                                aria-label={t('dashboard.materials.removeComparison')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-md border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t('dashboard.materials.summary.baseCost')}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatLocaleCurrency(locale, estimateTotal)}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.materials.summary.comparisonCost')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatLocaleCurrency(locale, comparisonTotal)}
                  </p>
                </div>
                <div
                  className={`rounded-md border p-4 ${
                    comparisonDelta < 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : comparisonDelta > 0
                        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
                        : 'border-border bg-muted/20'
                  }`}
                >
                  <p className="text-xs opacity-80">{t('dashboard.materials.summary.totalDifference')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{comparisonDeltaLabel}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {estimateTotal > 0
                      ? t('dashboard.materials.delta.percent', {
                          percent: Math.abs(Math.round(comparisonDeltaPercent)),
                        })
                      : t('dashboard.materials.delta.noBase')}
                  </p>
                </div>
                <div className="rounded-md border p-4 text-xs text-muted-foreground">
                  {t('dashboard.materials.tip', {
                    action: t('dashboard.materials.base.copyToComparison'),
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardModule() {
  const { t } = useI18n()
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) throw new Error('Failed to fetch dashboard stats')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-6">
        <StatsCardsSkeleton />
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)] 2xl:items-start">
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">
            {t('dashboard.errorLoading')}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Safe defaults for arrays
  const lowStockProducts = stats.lowStockProducts || []
  const activeProjectsList = stats.activeProjectsList || []
  const recentTasks = stats.recentTasks || []
  const materialPrices = stats.materialPrices || []

  return (
    <div className="min-w-0 space-y-6">
      <StatsCards stats={stats} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <LowStockAlerts products={lowStockProducts} />
        <ActiveProjectsSection projects={activeProjectsList} />
      </div>

      <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)] 2xl:items-start">
        <MaterialCostSection products={materialPrices} />
        <RecentTasksSection tasks={recentTasks} />
      </div>
    </div>
  )
}
