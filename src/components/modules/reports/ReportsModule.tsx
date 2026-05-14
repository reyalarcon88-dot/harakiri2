'use client'

import { useMemo, useState, type ElementType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FolderKanban,
  History,
  Layers,
  Loader2,
  Package,
  Search,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  Truck,
  Warehouse,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/components/layout/I18nProvider'
import { ProjectStatusBadge } from '@/components/shared/ProjectStatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatLocaleCurrency,
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleInteger,
} from '@/lib/i18n/format'
import type { MessageKey } from '@/lib/i18n/messages'

function formatCurrency(locale: 'en' | 'es', value: number) {
  return formatLocaleCurrency(locale, value || 0, undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatNumber(locale: 'en' | 'es', value: number) {
  return formatLocaleInteger(locale, value || 0)
}

function formatPercent(locale: 'en' | 'es', value: number) {
  return `${formatLocaleInteger(locale, Math.round(value || 0))}%`
}

function formatDateTime(locale: 'en' | 'es', value: string) {
  if (!value) return ''
  return formatLocaleDateTime(locale, value, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(locale: 'en' | 'es', value: string | undefined, fallback: string) {
  if (!value) return fallback
  const formatted = formatLocaleDate(locale, value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return formatted || fallback
}

const STATUS_LABEL_KEYS: Record<string, MessageKey> = {
  planned: 'status.project.planned',
  in_progress: 'status.project.inProgress',
  dispatched: 'status.project.dispatched',
  finished: 'status.project.finished',
  cancelled: 'status.project.cancelled',
  pedido: 'status.purchase.pedido',
  pending: 'status.purchase.pending',
  received: 'status.purchase.received',
}

const STATUS_BADGES: Record<string, string> = {
  planned: 'border-teal-200 bg-teal-50 text-teal-700',
  in_progress: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  dispatched: 'border-amber-200 bg-amber-50 text-amber-700',
  finished: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
  pedido: 'border-amber-200 bg-amber-50 text-amber-700',
  pending: 'border-orange-200 bg-orange-50 text-orange-700',
  received: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const STATUS_FILLS: Record<string, string> = {
  planned: '#0f766e',
  in_progress: '#0891b2',
  dispatched: '#d97706',
  finished: '#16a34a',
  cancelled: '#e11d48',
  pedido: '#f59e0b',
  pending: '#ea580c',
  received: '#16a34a',
}

const CHART = {
  teal: '#0f766e',
  cyan: '#0891b2',
  emerald: '#16a34a',
  amber: '#d97706',
  rose: '#e11d48',
  lime: '#65a30d',
  orange: '#ea580c',
  gray: '#71717a',
}

type UsagePeriod = 'daily' | 'weekly' | 'monthly' | 'annual'
type RecentUsageRange = 'last7Days' | 'last15Days' | 'last30Days'

type UsagePeriodRow = {
  key: string
  label: string
  quantity: number
  products: number
  projects: number
}

type ProductUsageHistory = {
  productId: string
  name: string
  code: string
  family: string
  totalUsed: number
  projects: {
    projectId: string
    projectName: string
    poNumber: string
    clientName: string
    quantity: number
    dispatches: number
    lastDispatchDate: string
  }[]
}

type RecentUsageProduct = {
  productId: string
  name: string
  code: string
  family: string
  quantity: number
  projects: number
  lastDispatchDate: string
}

const USAGE_PERIOD_LABEL_KEYS: Record<UsagePeriod, MessageKey> = {
  daily: 'reports.usage.period.daily',
  weekly: 'reports.usage.period.weekly',
  monthly: 'reports.usage.period.monthly',
  annual: 'reports.usage.period.annual',
}

const RECENT_USAGE_RANGE_LABEL_KEYS: Record<RecentUsageRange, MessageKey> = {
  last7Days: 'reports.usage.recent.range.last7Days',
  last15Days: 'reports.usage.recent.range.last15Days',
  last30Days: 'reports.usage.recent.range.last30Days',
}

const USAGE_PERIOD_HELPER_KEYS: Record<UsagePeriod, MessageKey> = {
  daily: 'reports.usage.periodHelp.daily',
  weekly: 'reports.usage.periodHelp.weekly',
  monthly: 'reports.usage.periodHelp.monthly',
  annual: 'reports.usage.periodHelp.annual',
}

interface ReportsSummary {
  inventory: {
    totalProducts: number
    totalUnits: number
    outOfStock: number
    lowStock: number
    criticalStock: number
    healthyStock: number
    stockHealthScore: number
    inventoryValue: number
    unitsByWarehouse: { name: string; units: number; value: number }[]
    stockByFamily: { family: string; products: number; units: number; value: number }[]
    topStockProducts: { id: string; name: string; code: string; family: string; units: number }[]
    lowStockProducts: {
      id: string
      name: string
      code: string
      family: string
      currentStock: number
      minStock: number
      gap: number
    }[]
    lowStockThreshold: number
  }
  projects: {
    totalProjects: number
    activeProjects: number
    totalBudget: number
    plannedUnits: number
    dispatchedUnits: number
    pendingUnits: number
    dispatchProgress: number
    projectsByStatus: Record<string, number>
    projectsWithPending: {
      id: string
      name: string
      poNumber: string
      clientName: string
      pending: number
      planned: number
      dispatched: number
      progress: number
      status: string
    }[]
    clientDemand: { name: string; projects: number; pending: number; budget: number }[]
  }
  purchases: {
    totalPurchases: number
    totalPurchaseValue: number
    pendingPurchaseValue: number
    receivedPurchaseValue: number
    openPurchaseValue: number
    purchasesByStatus: Record<string, number>
    topSuppliers: { name: string; value: number; count: number }[]
    topPurchasedProducts: { productId: string; qty: number; value: number; name: string; code: string; family: string }[]
    supplierConcentration: number
  }
  usage: {
    totalUsedUnits: number
    activeProducts: number
    activeProjects: number
    topUsedProducts: {
      productId: string
      name: string
      code: string
      family: string
      quantity: number
      projects: number
    }[]
    productHistory: ProductUsageHistory[]
    recentRanges: Record<RecentUsageRange, RecentUsageProduct[]>
    byPeriod: Record<UsagePeriod, UsagePeriodRow[]>
  }
  operations: {
    pendingTasks: number
    overdueTasks: number
    dueSoonTasks: number
    pendingReturns: number
  }
  trends: {
    monthly: { key: string; month: string; purchases: number; purchaseValue: number; projects: number; dispatched: number }[]
  }
  generatedAt: string
}

type Tone = 'teal' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'orange'

const toneClasses: Record<Tone, string> = {
  teal: 'border-teal-200 bg-teal-50 text-teal-700',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  helper: string
  icon: ElementType
  tone: Tone
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
          </div>
          <div className={`rounded-md border p-2 ${toneClasses[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function statusRows(
  counts: Record<string, number>,
  t: (key: MessageKey, values?: Record<string, string | number>) => string
) {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({
      status,
      label: STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status,
      value,
      fill: STATUS_FILLS[status] || CHART.gray,
    }))
}

function StatusDonut({ counts }: { counts: Record<string, number> }) {
  const { t } = useI18n()
  const rows = statusRows(counts, t)
  if (rows.length === 0) return <EmptyChart label={t('reports.empty.statusData')} />

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_180px]">
      <ChartContainer
        className="h-[260px] w-full"
        config={{ value: { label: t('reports.common.quantity'), color: CHART.teal } }}
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            innerRadius={58}
            outerRadius={92}
            paddingAngle={2}
          >
            {rows.map((row) => (
              <Cell key={row.status} fill={row.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="space-y-2 self-center">
        {rows.map((row) => (
          <div key={row.status} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 truncate">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.fill }} />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportsLoading() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{t('reports.loading')}</span>
    </div>
  )
}

export function ReportsModule() {
  const { locale, t } = useI18n()
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriod>('monthly')
  const [recentUsageRange, setRecentUsageRange] = useState<RecentUsageRange>('last30Days')
  const [recentUsageSearch, setRecentUsageSearch] = useState('')
  const [usageSearch, setUsageSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [moneyDialogOpen, setMoneyDialogOpen] = useState(false)
  const { data, isLoading, error } = useQuery<ReportsSummary>({
    queryKey: ['reports', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/reports/summary')
      if (!res.ok) throw new Error('Error cargando reportes')
      return res.json()
    },
  })

  const monthlyValueConfig = useMemo(
    () =>
      ({
        purchaseValue: { label: t('reports.charts.purchaseValueLabel'), color: CHART.teal },
      }) satisfies ChartConfig,
    [t]
  )

  const monthlyActivityConfig = useMemo(
    () =>
      ({
        purchases: { label: t('reports.tabs.purchases'), color: CHART.amber },
        projects: { label: t('reports.tabs.projects'), color: CHART.cyan },
        dispatched: { label: t('status.project.dispatched'), color: CHART.emerald },
      }) satisfies ChartConfig,
    [t]
  )

  const familyConfig = useMemo(
    () =>
      ({
        units: { label: t('reports.common.units'), color: CHART.teal },
      }) satisfies ChartConfig,
    [t]
  )

  const supplierConfig = useMemo(
    () =>
      ({
        value: { label: t('reports.common.value'), color: CHART.amber },
      }) satisfies ChartConfig,
    [t]
  )

  const clientConfig = useMemo(
    () =>
      ({
        pending: { label: t('status.purchase.pending'), color: CHART.rose },
      }) satisfies ChartConfig,
    [t]
  )

  const usageConfig = useMemo(
    () =>
      ({
        quantity: { label: t('reports.common.used'), color: CHART.emerald },
      }) satisfies ChartConfig,
    [t]
  )

  const stockHealthRows = useMemo(() => {
    if (!data) return []
    return [
      { label: t('reports.inventory.health.healthy'), value: data.inventory.healthyStock, fill: CHART.emerald },
      { label: t('reports.inventory.health.low'), value: data.inventory.lowStock, fill: CHART.amber },
      { label: t('reports.inventory.health.critical'), value: data.inventory.criticalStock, fill: CHART.rose },
      { label: t('reports.inventory.health.outOfStock'), value: data.inventory.outOfStock, fill: CHART.gray },
    ].filter((row) => row.value > 0)
  }, [data, t])

  if (isLoading) return <ReportsLoading />

  if (error || !data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {t('reports.error')}
      </div>
    )
  }

  const { inventory, projects, purchases, usage, operations, trends } = data
  const riskScore = inventory.criticalStock + operations.overdueTasks + operations.pendingReturns
  const monthlyRows = trends.monthly || []
  const usageRows = usage.byPeriod[usagePeriod] || []
  const usagePeriodTotal = usageRows.reduce((sum, row) => sum + row.quantity, 0)
  const usagePeriodAverage = usageRows.length > 0 ? Math.round(usagePeriodTotal / usageRows.length) : 0
  const usagePeak = usageRows.reduce(
    (peak, row) => (row.quantity > peak.quantity ? row : peak),
    { label: t('reports.empty.noData'), quantity: 0 } as Pick<UsagePeriodRow, 'label' | 'quantity'>
  )
  const recentUsageRows = usage.recentRanges?.[recentUsageRange] || []
  const recentUsageSearchTerm = recentUsageSearch.trim().toLowerCase()
  const filteredRecentUsageRows = recentUsageRows.filter((product) => {
    if (!recentUsageSearchTerm) return true
    return `${product.name} ${product.code} ${product.family}`.toLowerCase().includes(recentUsageSearchTerm)
  })
  const recentUsageTotal = recentUsageRows.reduce((sum, product) => sum + product.quantity, 0)
  const usageSearchTerm = usageSearch.trim().toLowerCase()
  const filteredProductHistory = usage.productHistory
    .filter((product) => {
      if (!usageSearchTerm) return true
      return `${product.name} ${product.code} ${product.family}`.toLowerCase().includes(usageSearchTerm)
    })
    .slice(0, 20)
  const selectedProduct = selectedProductId
    ? usage.productHistory.find((product) => product.productId === selectedProductId) || null
    : null
  const moneyRows = [
    { label: t('reports.money.inventoryValue'), value: inventory.inventoryValue, helper: t('reports.money.inventoryValueHelper') },
    { label: t('reports.money.openPurchases'), value: purchases.openPurchaseValue, helper: t('reports.money.openPurchasesHelper') },
    { label: t('reports.money.receivedPurchases'), value: purchases.receivedPurchaseValue, helper: t('reports.money.receivedPurchasesHelper') },
    { label: t('reports.money.projectBudget'), value: projects.totalBudget, helper: t('reports.money.projectBudgetHelper') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-teal-700" />
            <h2 className="text-xl font-semibold tracking-tight">{t('reports.header.title')}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('reports.header.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setMoneyDialogOpen(true)}>
            <CircleDollarSign className="mr-2 h-4 w-4" />
            {t('reports.money.openDialog')}
          </Button>
          <div className="text-xs text-muted-foreground">
            {t('reports.header.updated')}:{' '}
            <span className="font-medium text-foreground">{formatDateTime(locale, data.generatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('reports.kpis.inventoryHealth')}
          value={formatPercent(locale, inventory.stockHealthScore)}
          helper={t('reports.kpis.inventoryHealthHelper', {
            critical: formatNumber(locale, inventory.criticalStock),
            outOfStock: formatNumber(locale, inventory.outOfStock),
          })}
          icon={Package}
          tone={inventory.stockHealthScore >= 80 ? 'emerald' : inventory.stockHealthScore >= 60 ? 'amber' : 'rose'}
        />
        <KpiCard
          label={t('reports.kpis.dispatchProgress')}
          value={formatPercent(locale, projects.dispatchProgress)}
          helper={t('reports.kpis.dispatchProgressHelper', {
            pending: formatNumber(locale, projects.pendingUnits),
          })}
          icon={Truck}
          tone={projects.dispatchProgress >= 80 ? 'emerald' : 'cyan'}
        />
        <KpiCard
          label={t('reports.kpis.purchaseValue')}
          value={formatCurrency(locale, purchases.totalPurchaseValue)}
          helper={t('reports.kpis.purchaseValueHelper', {
            value: formatCurrency(locale, purchases.openPurchaseValue),
          })}
          icon={CircleDollarSign}
          tone="teal"
        />
        <KpiCard
          label={t('reports.kpis.operationalRisk')}
          value={formatNumber(locale, riskScore)}
          helper={t('reports.kpis.operationalRiskHelper', {
            overdue: formatNumber(locale, operations.overdueTasks),
            returns: formatNumber(locale, operations.pendingReturns),
          })}
          icon={ShieldAlert}
          tone={riskScore > 0 ? 'rose' : 'emerald'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <ChartPanel
          title={t('reports.charts.purchaseValueByMonth.title')}
          description={t('reports.charts.purchaseValueByMonth.description')}
        >
          {monthlyRows.length === 0 ? (
            <EmptyChart label={t('reports.empty.noMonthlyActivity')} />
          ) : (
            <ChartContainer className="h-[300px] w-full" config={monthlyValueConfig}>
              <AreaChart data={monthlyRows} margin={{ left: 8, right: 16, top: 12 }}>
                <defs>
                  <linearGradient id="purchaseValueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-purchaseValue)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-purchaseValue)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums">
                          {formatCurrency(locale, Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="purchaseValue"
                  type="monotone"
                  stroke="var(--color-purchaseValue)"
                  fill="url(#purchaseValueFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </ChartPanel>

        <ChartPanel
          title={t('reports.charts.monthlyActivity.title')}
          description={t('reports.charts.monthlyActivity.description')}
        >
          {monthlyRows.length === 0 ? (
            <EmptyChart label={t('reports.empty.noMonthlyActivity')} />
          ) : (
            <ChartContainer className="h-[300px] w-full" config={monthlyActivityConfig}>
              <BarChart data={monthlyRows} margin={{ left: 0, right: 12, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="purchases" fill="var(--color-purchases)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="projects" fill="var(--color-projects)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dispatched" fill="var(--color-dispatched)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartPanel>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-3 lg:w-auto lg:grid-cols-5">
          <TabsTrigger value="inventory">{t('reports.tabs.inventory')}</TabsTrigger>
          <TabsTrigger value="usage">{t('reports.tabs.usage')}</TabsTrigger>
          <TabsTrigger value="projects">{t('reports.tabs.projects')}</TabsTrigger>
          <TabsTrigger value="purchases">{t('reports.tabs.purchases')}</TabsTrigger>
          <TabsTrigger value="risks">{t('reports.tabs.risks')}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('reports.inventory.kpis.products')}
              value={formatNumber(locale, inventory.totalProducts)}
              helper={t('reports.inventory.kpis.activeCatalog')}
              icon={Package}
              tone="teal"
            />
            <KpiCard
              label={t('reports.inventory.kpis.units')}
              value={formatNumber(locale, inventory.totalUnits)}
              helper={t('reports.inventory.kpis.totalStock')}
              icon={Layers}
              tone="cyan"
            />
            <KpiCard
              label={t('reports.inventory.kpis.inventoryValue')}
              value={formatCurrency(locale, inventory.inventoryValue)}
              helper={t('reports.inventory.kpis.referencePrice')}
              icon={CircleDollarSign}
              tone="emerald"
            />
            <KpiCard
              label={t('reports.inventory.kpis.lowStock')}
              value={formatNumber(locale, inventory.lowStock)}
              helper={t('reports.inventory.kpis.lessThanUnits', {
                count: formatNumber(locale, inventory.lowStockThreshold),
              })}
              icon={AlertTriangle}
              tone="amber"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <ChartPanel
              title={t('reports.inventory.health.title')}
              description={t('reports.inventory.health.description')}
            >
              {stockHealthRows.length === 0 ? (
                <EmptyChart label={t('reports.empty.noProducts')} />
              ) : (
                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <ChartContainer
                    className="h-[270px] w-full"
                    config={{ value: { label: t('reports.inventory.kpis.products'), color: CHART.teal } }}
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie data={stockHealthRows} dataKey="value" nameKey="label" innerRadius={62} outerRadius={96} paddingAngle={2}>
                        {stockHealthRows.map((row) => (
                          <Cell key={row.label} fill={row.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="space-y-2 self-center">
                    {stockHealthRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.fill }} />
                          {row.label}
                        </span>
                        <span className="font-medium tabular-nums">{formatNumber(locale, row.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartPanel>

            <ChartPanel
              title={t('reports.inventory.stockByFamily.title')}
              description={t('reports.inventory.stockByFamily.description')}
            >
              {inventory.stockByFamily.length === 0 ? (
                <EmptyChart label={t('reports.empty.noFamilies')} />
              ) : (
                <ChartContainer className="h-[270px] w-full" config={familyConfig}>
                  <BarChart data={inventory.stockByFamily} layout="vertical" margin={{ left: 8, right: 24, top: 8 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="family"
                      type="category"
                      width={122}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="units" fill="var(--color-units)" />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('reports.inventory.warehouses.title')}</CardTitle>
                <CardDescription className="text-xs">{t('reports.inventory.warehouses.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.tables.warehouse')}</TableHead>
                      <TableHead className="text-right">{t('reports.common.units')}</TableHead>
                      <TableHead className="text-right">{t('reports.common.value')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.unitsByWarehouse.map((warehouse) => (
                      <TableRow key={warehouse.name}>
                        <TableCell className="font-medium">{warehouse.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(locale, warehouse.units)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(locale, warehouse.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('reports.inventory.topStock.title')}</CardTitle>
                <CardDescription className="text-xs">{t('reports.inventory.topStock.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.tables.product')}</TableHead>
                      <TableHead>{t('reports.tables.family')}</TableHead>
                      <TableHead className="text-right">{t('reports.common.units')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.topStockProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.code}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.family}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatNumber(locale, product.units)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('reports.usage.kpis.materialUsed')}
              value={formatNumber(locale, usage.totalUsedUnits)}
              helper={t('reports.usage.kpis.totalDispatched')}
              icon={Truck}
              tone="emerald"
            />
            <KpiCard
              label={t('reports.usage.kpis.productsUsed')}
              value={formatNumber(locale, usage.activeProducts)}
              helper={t('reports.usage.kpis.realHistoryProducts')}
              icon={Package}
              tone="teal"
            />
            <KpiCard
              label={t('reports.usage.kpis.impactedProjects')}
              value={formatNumber(locale, usage.activeProjects)}
              helper={t('reports.usage.kpis.projectsWithConsumption')}
              icon={FolderKanban}
              tone="cyan"
            />
            <KpiCard
              label={t('reports.usage.kpis.periodUsage', {
                period: t(USAGE_PERIOD_LABEL_KEYS[usagePeriod]).toLowerCase(),
              })}
              value={formatNumber(locale, usagePeriodTotal)}
              helper={t('reports.usage.kpis.average', {
                value: formatNumber(locale, usagePeriodAverage),
              })}
              icon={BarChart3}
              tone="amber"
            />
          </div>

          <Card>
            <CardHeader className="gap-3 pb-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-sm">{t('reports.usage.recent.title')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('reports.usage.recent.description')}
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[520px] lg:flex-row lg:justify-end">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(RECENT_USAGE_RANGE_LABEL_KEYS) as RecentUsageRange[]).map((range) => (
                    <Button
                      key={range}
                      type="button"
                      size="sm"
                      variant={recentUsageRange === range ? 'default' : 'outline'}
                      onClick={() => setRecentUsageRange(range)}
                    >
                      {t(RECENT_USAGE_RANGE_LABEL_KEYS[range])}
                    </Button>
                  ))}
                </div>
                <div className="relative w-full lg:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={recentUsageSearch}
                    onChange={(event) => setRecentUsageSearch(event.target.value)}
                    placeholder={t('reports.usage.recent.searchPlaceholder')}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="rounded-md">
                  {t('reports.usage.recent.total', {
                    count: formatNumber(locale, recentUsageTotal),
                  })}
                </Badge>
                <span>
                  {t('reports.usage.recent.visible', {
                    count: formatNumber(locale, filteredRecentUsageRows.length),
                  })}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.tables.product')}</TableHead>
                    <TableHead>{t('reports.tables.family')}</TableHead>
                    <TableHead className="text-right">{t('reports.common.used')}</TableHead>
                    <TableHead className="text-right">{t('reports.tables.projects')}</TableHead>
                    <TableHead className="text-right">{t('reports.dialog.lastUse')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecentUsageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {recentUsageSearchTerm
                          ? t('reports.usage.recent.noMatches')
                          : t('reports.usage.recent.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecentUsageRows.map((product) => (
                      <TableRow key={product.productId}>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.code || t('reports.common.noCode')}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.family}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatNumber(locale, product.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(locale, product.projects)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(locale, product.lastDispatchDate, t('reports.common.noDate'))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
            <ChartPanel
              title={t('reports.usage.chart.title')}
              description={t('reports.usage.chart.description')}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {(Object.keys(USAGE_PERIOD_LABEL_KEYS) as UsagePeriod[]).map((period) => (
                  <Button
                    key={period}
                    type="button"
                    size="sm"
                    variant={usagePeriod === period ? 'default' : 'outline'}
                    onClick={() => setUsagePeriod(period)}
                  >
                    {t(USAGE_PERIOD_LABEL_KEYS[period])}
                  </Button>
                ))}
              </div>

              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t('reports.usage.stats.periodTotal')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(locale, usagePeriodTotal)}</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t('reports.usage.stats.average')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(locale, usagePeriodAverage)}</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t('reports.usage.stats.peak')}</p>
                  <p className="mt-1 text-sm font-semibold">{usagePeak.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('reports.usage.unitsLabel', {
                      count: formatNumber(locale, usagePeak.quantity),
                    })}
                  </p>
                </div>
              </div>

              <p className="mb-3 text-xs text-muted-foreground">{t(USAGE_PERIOD_HELPER_KEYS[usagePeriod])}</p>

              {usageRows.length === 0 || usageRows.every((row) => row.quantity === 0) ? (
                <EmptyChart label={t('reports.empty.noUsageInPeriod')} />
              ) : (
                <ChartContainer className="h-[320px] w-full" config={usageConfig}>
                  <BarChart data={usageRows} margin={{ left: 0, right: 12, top: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis hide />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono font-medium tabular-nums">
                              {t('reports.usage.unitsLabel', {
                                count: formatNumber(locale, Number(value)),
                              })}
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="quantity" fill="var(--color-quantity)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartPanel>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('reports.usage.topProducts.title')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('reports.usage.topProducts.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usage.topUsedProducts.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {t('reports.usage.topProducts.empty')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {usage.topUsedProducts.map((product) => (
                      <div key={product.productId} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.code || t('reports.common.noCode')} - {product.family}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatNumber(locale, product.quantity)}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('reports.usage.projectsCount', {
                                count: formatNumber(locale, product.projects),
                              })}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => setSelectedProductId(product.productId)}
                        >
                          {t('reports.usage.viewHistory')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-sm">{t('reports.usage.history.title')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('reports.usage.history.description')}
                </CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={usageSearch}
                  onChange={(event) => setUsageSearch(event.target.value)}
                  placeholder={t('reports.usage.history.searchPlaceholder')}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.tables.product')}</TableHead>
                    <TableHead>{t('reports.tables.family')}</TableHead>
                    <TableHead className="text-right">{t('reports.common.used')}</TableHead>
                    <TableHead className="text-right">{t('reports.tables.projects')}</TableHead>
                    <TableHead className="text-right">{t('reports.tables.detail')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {t('reports.usage.history.noMatches')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProductHistory.map((product) => (
                      <TableRow key={product.productId}>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.code || t('reports.common.noCode')}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.family}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatNumber(locale, product.totalUsed)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(locale, product.projects.length)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedProductId(product.productId)}
                          >
                            {t('reports.common.open')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('reports.projects.kpis.projects')}
              value={formatNumber(locale, projects.totalProjects)}
              helper={t('reports.projects.kpis.activeHelper', {
                count: formatNumber(locale, projects.activeProjects),
              })}
              icon={FolderKanban}
              tone="teal"
            />
            <KpiCard
              label={t('reports.projects.kpis.budget')}
              value={formatCurrency(locale, projects.totalBudget)}
              helper={t('reports.projects.kpis.totalRecorded')}
              icon={CircleDollarSign}
              tone="emerald"
            />
            <KpiCard
              label={t('status.project.planned')}
              value={formatNumber(locale, projects.plannedUnits)}
              helper={t('reports.projects.kpis.requiredUnits')}
              icon={Layers}
              tone="cyan"
            />
            <KpiCard
              label={t('status.purchase.pending')}
              value={formatNumber(locale, projects.pendingUnits)}
              helper={t('reports.projects.kpis.notDispatchedUnits')}
              icon={Clock}
              tone="amber"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <ChartPanel
              title={t('reports.projects.progress.title')}
              description={t('reports.projects.progress.description')}
            >
              <ChartContainer
                className="h-[270px] w-full"
                config={{ progress: { label: t('reports.projects.progress.label'), color: CHART.emerald } }}
              >
                <RadialBarChart
                  data={[{ name: t('reports.projects.progress.label'), progress: projects.dispatchProgress, fill: CHART.emerald }]}
                  startAngle={90}
                  endAngle={450}
                  innerRadius={78}
                  outerRadius={112}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="progress" background cornerRadius={8} />
                </RadialBarChart>
              </ChartContainer>
              <div className="-mt-32 flex flex-col items-center pb-12">
                <p className="text-4xl font-semibold tabular-nums">{formatPercent(locale, projects.dispatchProgress)}</p>
                <p className="text-xs text-muted-foreground">
                  {t('reports.projects.progress.summary', {
                    dispatched: formatNumber(locale, projects.dispatchedUnits),
                    planned: formatNumber(locale, projects.plannedUnits),
                  })}
                </p>
              </div>
            </ChartPanel>

            <ChartPanel
              title={t('reports.projects.status.title')}
              description={t('reports.projects.status.description')}
            >
              <StatusDonut counts={projects.projectsByStatus} />
            </ChartPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('reports.projects.pendingByProject.title')}</CardTitle>
                <CardDescription className="text-xs">{t('reports.projects.pendingByProject.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.tables.project')}</TableHead>
                      <TableHead>{t('reports.tables.status')}</TableHead>
                      <TableHead>{t('reports.tables.progress')}</TableHead>
                      <TableHead className="text-right">{t('status.purchase.pending')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.projectsWithPending.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <p className="font-medium">{project.poNumber || project.name}</p>
                          <p className="text-xs text-muted-foreground">{project.clientName}</p>
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadge status={project.status} />
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Progress value={project.progress} className="h-2" />
                            <span className="w-10 text-right text-xs tabular-nums">{formatPercent(locale, project.progress)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-amber-700">
                          {formatNumber(locale, project.pending)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <ChartPanel
              title={t('reports.projects.clientDemand.title')}
              description={t('reports.projects.clientDemand.description')}
            >
              {projects.clientDemand.length === 0 ? (
                <EmptyChart label={t('reports.projects.clientDemand.empty')} />
              ) : (
                <ChartContainer className="h-[330px] w-full" config={clientConfig}>
                  <BarChart data={projects.clientDemand} layout="vertical" margin={{ left: 4, right: 24, top: 8 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="pending" fill="var(--color-pending)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartPanel>
          </div>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('reports.tabs.purchases')}
              value={formatNumber(locale, purchases.totalPurchases)}
              helper={t('reports.purchases.kpis.registeredOrders')}
              icon={ShoppingCart}
              tone="teal"
            />
            <KpiCard
              label={t('reports.purchases.kpis.totalValue')}
              value={formatCurrency(locale, purchases.totalPurchaseValue)}
              helper={t('reports.purchases.kpis.allOrders')}
              icon={CircleDollarSign}
              tone="emerald"
            />
            <KpiCard
              label={t('status.purchase.pending')}
              value={formatCurrency(locale, purchases.pendingPurchaseValue)}
              helper={t('reports.purchases.kpis.pendingHelper')}
              icon={Clock}
              tone="amber"
            />
            <KpiCard
              label={t('reports.purchases.kpis.concentration')}
              value={formatPercent(locale, purchases.supplierConcentration)}
              helper={t('reports.purchases.kpis.primarySupplier')}
              icon={TrendingUp}
              tone={purchases.supplierConcentration > 50 ? 'orange' : 'cyan'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <ChartPanel
              title={t('reports.purchases.status.title')}
              description={t('reports.purchases.status.description')}
            >
              <StatusDonut counts={purchases.purchasesByStatus} />
            </ChartPanel>

            <ChartPanel
              title={t('reports.purchases.topSuppliers.title')}
              description={t('reports.purchases.topSuppliers.description')}
            >
              {purchases.topSuppliers.length === 0 ? (
                <EmptyChart label={t('reports.purchases.topSuppliers.empty')} />
              ) : (
                <ChartContainer className="h-[300px] w-full" config={supplierConfig}>
                  <BarChart data={purchases.topSuppliers} layout="vertical" margin={{ left: 8, right: 32, top: 8 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={130} tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono font-medium tabular-nums">
                              {formatCurrency(locale, Number(value))}
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartPanel>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('reports.purchases.topProducts.title')}</CardTitle>
              <CardDescription className="text-xs">{t('reports.purchases.topProducts.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.tables.product')}</TableHead>
                    <TableHead>{t('reports.tables.family')}</TableHead>
                    <TableHead className="text-right">{t('reports.common.quantity')}</TableHead>
                    <TableHead className="text-right">{t('reports.common.value')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.topPurchasedProducts.map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.code}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.family}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatNumber(locale, product.qty)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(locale, product.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('reports.risks.kpis.criticalStock')}
              value={formatNumber(locale, inventory.criticalStock)}
              helper={t('reports.risks.kpis.belowMinimum')}
              icon={AlertTriangle}
              tone={inventory.criticalStock > 0 ? 'rose' : 'emerald'}
            />
            <KpiCard
              label={t('reports.risks.kpis.outOfStock')}
              value={formatNumber(locale, inventory.outOfStock)}
              helper={t('reports.risks.kpis.zeroProducts')}
              icon={XCircle}
              tone={inventory.outOfStock > 0 ? 'rose' : 'emerald'}
            />
            <KpiCard
              label={t('reports.risks.kpis.overdueTasks')}
              value={formatNumber(locale, operations.overdueTasks)}
              helper={t('reports.risks.kpis.dueThisWeek', {
                count: formatNumber(locale, operations.dueSoonTasks),
              })}
              icon={Clock}
              tone={operations.overdueTasks > 0 ? 'orange' : 'emerald'}
            />
            <KpiCard
              label={t('reports.risks.kpis.returns')}
              value={formatNumber(locale, operations.pendingReturns)}
              helper={t('reports.risks.kpis.pendingResolve')}
              icon={CheckCircle2}
              tone={operations.pendingReturns > 0 ? 'amber' : 'emerald'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('reports.risks.attention.title')}</CardTitle>
              <CardDescription className="text-xs">{t('reports.risks.attention.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {inventory.lowStockProducts.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  {t('reports.risks.attention.empty')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.tables.product')}</TableHead>
                      <TableHead>{t('reports.tables.family')}</TableHead>
                      <TableHead className="text-right">{t('reports.common.stock')}</TableHead>
                      <TableHead className="text-right">{t('reports.common.minimum')}</TableHead>
                      <TableHead className="text-right">{t('reports.common.gap')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.lowStockProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.code}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.family}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(locale, product.currentStock)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(locale, product.minStock)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-rose-700">{formatNumber(locale, product.gap)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={moneyDialogOpen} onOpenChange={setMoneyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-teal-700" />
              {t('reports.money.title')}
            </DialogTitle>
            <DialogDescription>
              {t('reports.money.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-teal-50 p-4 text-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
              <p className="text-xs font-medium uppercase tracking-wide">{t('reports.money.currentTotal')}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {formatCurrency(locale, inventory.inventoryValue)}
              </p>
              <p className="mt-1 text-xs text-teal-800/80 dark:text-teal-100/80">
                {t('reports.money.currentTotalHelper')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {moneyRows.map((row) => (
                <div key={row.label} className="rounded-md border bg-muted/35 p-3">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(locale, row.value)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.helper}</p>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMoneyDialogOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => {
          if (!open) setSelectedProductId(null)
        }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-teal-700" />
                {t('reports.dialog.historyTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('reports.dialog.historyDescription')}
              </DialogDescription>
            </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t('reports.tables.product')}</p>
                  <p className="mt-1 truncate font-semibold">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedProduct.code || t('reports.common.noCode')}</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t('reports.dialog.totalUsed')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatNumber(locale, selectedProduct.totalUsed)}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t('reports.tables.projects')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatNumber(locale, selectedProduct.projects.length)}
                  </p>
                </div>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.tables.project')}</TableHead>
                      <TableHead>{t('reports.tables.client')}</TableHead>
                      <TableHead className="text-right">{t('reports.common.quantity')}</TableHead>
                      <TableHead className="text-right">{t('reports.dialog.dispatches')}</TableHead>
                      <TableHead className="text-right">{t('reports.dialog.lastUse')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProduct.projects.map((project) => (
                      <TableRow key={project.projectId}>
                        <TableCell>
                          <p className="font-medium">{project.poNumber || project.projectName}</p>
                          <p className="text-xs text-muted-foreground">{project.projectName}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{project.clientName}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatNumber(locale, project.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(locale, project.dispatches)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(locale, project.lastDispatchDate, t('reports.common.noDate'))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
