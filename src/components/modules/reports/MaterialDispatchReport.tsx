'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/layout/I18nProvider'
import {
  formatLocaleCurrency,
  formatLocaleDate,
  formatLocaleInteger,
} from '@/lib/i18n/format'

type RangePreset = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last30' | 'custom'

type ReportResponse = {
  range: { start: string; end: string; days: number }
  filters: { projectId?: string; family?: string; productIds?: string[]; compare: boolean }
  kpis: {
    totalUnits: number
    totalCost: number
    distinctItems: number
    returnedUnits: number
    delta?: { units: number; cost: number; items: number; returned: number }
  }
  byFamily: Array<{
    family: string
    items: Array<{
      productId: string
      code: string
      name: string
      quantity: number
      cost: number
      returned: number
    }>
    subtotalUnits: number
    subtotalCost: number
    subtotalReturned: number
  }>
  byProject: Array<{
    projectId: string
    name: string
    poNumber: string
    clientName: string
    status: string
    startDate: string | null
    endDate: string | null
    projectDate: string
    items: number
    units: number
    cost: number
    returned: number
    products?: Array<{
      productId: string
      code: string
      name: string
      quantity: number
      returned: number
    }>
  }>
  topMovers?: {
    up: Array<{ productId: string; code: string; name: string; quantity: number; previous: number; deltaPct: number }>
    down: Array<{ productId: string; code: string; name: string; quantity: number; previous: number; deltaPct: number }>
  }
  availableFamilies: string[]
  generatedAt: string
}

type ProjectListItem = { id: string; name: string; poNumber: string; client?: { name: string } | null }
type ProductListItem = { id: string; code: string; name: string }

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function startOfWeek(date: Date) {
  const value = new Date(date)
  value.setHours(12, 0, 0, 0)
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + diff)
  return value
}

function rangeForPreset(preset: RangePreset, today = new Date()): { start: string; end: string } {
  const base = new Date(today)
  base.setHours(12, 0, 0, 0)

  if (preset === 'thisWeek' || preset === 'lastWeek') {
    const monday = startOfWeek(base)
    if (preset === 'lastWeek') monday.setDate(monday.getDate() - 7)
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    return { start: toDateKey(monday), end: toDateKey(sunday) }
  }
  if (preset === 'thisMonth' || preset === 'lastMonth') {
    const offset = preset === 'lastMonth' ? -1 : 0
    const first = new Date(base.getFullYear(), base.getMonth() + offset, 1)
    const last = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0)
    return { start: toDateKey(first), end: toDateKey(last) }
  }
  if (preset === 'last30') {
    const end = new Date(base)
    const start = new Date(base)
    start.setDate(start.getDate() - 29)
    return { start: toDateKey(start), end: toDateKey(end) }
  }
  return { start: toDateKey(startOfWeek(base)), end: toDateKey(base) }
}

function formatDeltaPct(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}

const ALL_OPTION = '__all__'

export function MaterialDispatchReport() {
  const { locale, t } = useI18n()
  const [preset, setPreset] = useState<RangePreset>('thisWeek')
  const initialRange = useMemo(() => rangeForPreset('thisWeek'), [])
  const [start, setStart] = useState(initialRange.start)
  const [end, setEnd] = useState(initialRange.end)
  const [projectId, setProjectId] = useState<string>(ALL_OPTION)
  const [family, setFamily] = useState<string>(ALL_OPTION)
  const [selectedProducts, setSelectedProducts] = useState<ProductListItem[]>([])
  const [compare, setCompare] = useState(true)
  const [search, setSearch] = useState('')
  const printableRef = useRef<HTMLDivElement | null>(null)

  function applyPreset(next: RangePreset) {
    setPreset(next)
    if (next !== 'custom') {
      const range = rangeForPreset(next)
      setStart(range.start)
      setEnd(range.end)
    }
  }

  const queryString = useMemo(() => {
    const sp = new URLSearchParams({ start, end })
    if (projectId !== ALL_OPTION) sp.set('projectId', projectId)
    if (family !== ALL_OPTION) sp.set('family', family)
    if (selectedProducts.length > 0) {
      sp.set('productIds', selectedProducts.map((p) => p.id).join(','))
    }
    if (compare) sp.set('compare', 'prev')
    return sp.toString()
  }, [start, end, projectId, family, selectedProducts, compare])

  const reportQuery = useQuery<ReportResponse>({
    queryKey: ['material-report', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/reports/material-report?${queryString}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'request failed')
      }
      return res.json()
    },
    staleTime: 30_000,
  })

  const projectsQuery = useQuery<ProjectListItem[]>({
    queryKey: ['material-report-projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('projects')
      const data = await res.json()
      return Array.isArray(data) ? data : data?.projects ?? []
    },
    staleTime: 60_000,
  })

  const productsQuery = useQuery<ProductListItem[]>({
    queryKey: ['material-report-products'],
    queryFn: async () => {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('products')
      const data = await res.json()
      const list = Array.isArray(data) ? data : data?.products ?? []
      return list.map((p: { id: string; code?: string; name?: string }) => ({
        id: p.id,
        code: p.code ?? '',
        name: p.name ?? '',
      }))
    },
    staleTime: 60_000,
  })

  function toggleProduct(product: ProductListItem) {
    setSelectedProducts((current) =>
      current.some((p) => p.id === product.id)
        ? current.filter((p) => p.id !== product.id)
        : [...current, product]
    )
  }

  // Available families from current dataset (so the dropdown reflects what's in range)
  const familyOptions = useMemo(() => {
    const data = reportQuery.data?.availableFamilies ?? []
    return data
  }, [reportQuery.data])

  // Apply client-side search filter inside the existing byFamily groups
  const searchTerm = search.trim().toLowerCase()
  const filteredFamilies = useMemo(() => {
    if (!reportQuery.data) return []
    if (!searchTerm) return reportQuery.data.byFamily
    return reportQuery.data.byFamily
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.name.toLowerCase().includes(searchTerm) ||
            item.code.toLowerCase().includes(searchTerm)
        ),
      }))
      .filter((group) => group.items.length > 0)
      .map((group) => {
        const subtotalUnits = group.items.reduce((sum, i) => sum + i.quantity, 0)
        const subtotalCost = group.items.reduce((sum, i) => sum + i.cost, 0)
        const subtotalReturned = group.items.reduce((sum, i) => sum + i.returned, 0)
        return { ...group, subtotalUnits, subtotalCost, subtotalReturned }
      })
  }, [reportQuery.data, searchTerm])

  function resetFilters() {
    applyPreset('thisWeek')
    setProjectId(ALL_OPTION)
    setFamily(ALL_OPTION)
    setSelectedProducts([])
    setSearch('')
    setCompare(true)
  }

  function handlePrint() {
    window.print()
  }

  // Keep family dropdown valid when the dataset changes
  useEffect(() => {
    if (family !== ALL_OPTION && !familyOptions.includes(family)) {
      setFamily(ALL_OPTION)
    }
  }, [family, familyOptions])

  const data = reportQuery.data
  const isLoading = reportQuery.isLoading
  const isError = reportQuery.isError
  const isEmpty = data && data.kpis.totalUnits === 0 && data.byFamily.length === 0
  const showSearchEmpty = !!data && !isEmpty && filteredFamilies.length === 0

  const generatedAtLabel = data
    ? formatLocaleDate(locale, data.generatedAt, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''
  const rangeLabel = data
    ? `${formatLocaleDate(locale, data.range.start)} → ${formatLocaleDate(locale, data.range.end)}`
    : `${formatLocaleDate(locale, start)} → ${formatLocaleDate(locale, end)}`

  const presetOptions: { value: RangePreset; key: string }[] = [
    { value: 'thisWeek', key: 'reports.report.filters.thisWeek' },
    { value: 'lastWeek', key: 'reports.report.filters.lastWeek' },
    { value: 'thisMonth', key: 'reports.report.filters.thisMonth' },
    { value: 'lastMonth', key: 'reports.report.filters.lastMonth' },
    { value: 'last30', key: 'reports.report.filters.last30' },
    { value: 'custom', key: 'reports.report.filters.custom' },
  ]

  return (
    <div className="mdr-root space-y-4">
      <ReportStyles />

      {/* ────── Filter bar (hidden in print) ────── */}
      <div className="mdr-controls rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {presetOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={preset === opt.value ? 'default' : 'outline'}
              onClick={() => applyPreset(opt.value)}
            >
              {t(opt.key as Parameters<typeof t>[0])}
            </Button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {t('reports.report.actions.reset')}
            </Button>
            <Button type="button" size="sm" onClick={handlePrint}>
              <Printer className="mr-1 h-3.5 w-3.5" />
              {t('reports.report.actions.print')}
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <Label className="text-xs text-muted-foreground">
              {t('reports.report.filters.start')}
            </Label>
            <Input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value)
                setPreset('custom')
              }}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              {t('reports.report.filters.end')}
            </Label>
            <Input
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value)
                setPreset('custom')
              }}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              {t('reports.report.filters.project')}
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={t('reports.report.filters.allProjects')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>
                  {t('reports.report.filters.allProjects')}
                </SelectItem>
                {(projectsQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.client?.name ? ` · ${p.client.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              {t('reports.report.filters.family')}
            </Label>
            <Select value={family} onValueChange={setFamily}>
              <SelectTrigger>
                <SelectValue placeholder={t('reports.report.filters.allFamilies')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>
                  {t('reports.report.filters.allFamilies')}
                </SelectItem>
                {familyOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              {t('reports.report.filters.materials')}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedProducts.length > 0
                      ? t('reports.report.filters.materialsSelected', {
                          count: selectedProducts.length,
                        })
                      : t('reports.report.filters.materials')}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t('reports.report.filters.materialsPlaceholder')}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {t('reports.report.filters.materialsEmpty')}
                    </CommandEmpty>
                    {(productsQuery.data ?? []).map((product) => {
                      const isSelected = selectedProducts.some((p) => p.id === product.id)
                      return (
                        <CommandItem
                          key={product.id}
                          value={`${product.name} ${product.code}`}
                          onSelect={() => toggleProduct(product)}
                        >
                          <Check
                            className={`h-4 w-4 ${isSelected ? 'opacity-100 text-emerald-600' : 'opacity-0'}`}
                          />
                          <span className="truncate">{product.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {product.code}
                          </span>
                        </CommandItem>
                      )
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              {t('reports.report.filters.searchMaterial')}
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('reports.report.filters.searchMaterial')}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {selectedProducts.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {selectedProducts.map((product) => (
              <Badge
                key={product.id}
                variant="secondary"
                className="gap-1 border pr-1 font-normal"
              >
                <span className="max-w-[180px] truncate">{product.name}</span>
                <button
                  type="button"
                  onClick={() => toggleProduct(product)}
                  className="rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                  aria-label={`Quitar ${product.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => setSelectedProducts([])}
            >
              {t('reports.report.actions.reset')}
            </Button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Switch id="mdr-compare" checked={compare} onCheckedChange={setCompare} />
          <Label htmlFor="mdr-compare" className="text-xs text-muted-foreground">
            {t('reports.report.filters.compare')}
          </Label>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('reports.report.loading')}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {t('reports.report.error')}
        </div>
      )}

      {!isLoading && !isError && data && (
        <div ref={printableRef} className="mdr-printable">
          {/* ─── Masthead ─── */}
          <header className="mdr-masthead">
            <div className="mdr-eyebrow">{t('reports.report.eyebrow')}</div>
            <h1 className="mdr-title">{t('reports.report.title')} — {rangeLabel}</h1>
            <p className="mdr-subtitle">{t('reports.report.subtitle')}</p>
            <div className="mdr-meta">
              <span>
                {t('reports.report.meta.projects')}:{' '}
                <b>{formatLocaleInteger(locale, data.byProject.length)}</b>
              </span>
              <span>
                {t('reports.report.meta.basis')}:{' '}
                <b>{t('reports.report.meta.basisValue')}</b>
              </span>
              <span>
                {t('reports.report.meta.generated')}: <b>{generatedAtLabel}</b>
              </span>
            </div>
          </header>

          {/* ─── KPI cards ─── */}
          <div className="mdr-cards">
            <KpiTile
              accent
              label={t('reports.report.kpis.totalDispatched')}
              value={formatLocaleInteger(locale, data.kpis.totalUnits)}
              helper={t('reports.report.kpis.totalDispatchedHelper', {
                projects: formatLocaleInteger(locale, data.byProject.length),
              })}
              delta={data.kpis.delta?.units}
            />
            <KpiTile
              label={t('reports.report.kpis.totalCost')}
              value={formatLocaleCurrency(locale, data.kpis.totalCost)}
              helper={t('reports.report.kpis.totalCostHelper')}
              delta={data.kpis.delta?.cost}
            />
            <KpiTile
              label={t('reports.report.kpis.distinctItems')}
              value={formatLocaleInteger(locale, data.kpis.distinctItems)}
              helper={t('reports.report.kpis.distinctItemsHelper')}
              delta={data.kpis.delta?.items}
            />
            <KpiTile
              label={t('reports.report.kpis.returns')}
              value={formatLocaleInteger(locale, data.kpis.returnedUnits)}
              helper={t('reports.report.kpis.returnsHelper')}
              delta={data.kpis.delta?.returned}
              invertColor
            />
          </div>

          {/* ─── Tables grouped by family ─── */}
          <h2 className="mdr-section">{t('reports.report.sections.weeklyTotals')}</h2>
          <p className="mdr-section-note">
            {t('reports.report.sections.weeklyTotalsNote')}
          </p>

          {isEmpty && (
            <div className="mdr-empty">{t('reports.report.empty')}</div>
          )}
          {showSearchEmpty && (
            <div className="mdr-empty">{t('reports.report.empty')}</div>
          )}

          {filteredFamilies.map((group) => (
            <table key={group.family} className="mdr-table">
              <caption>{group.family}</caption>
              <thead>
                <tr>
                  <th>{t('reports.report.tables.material')}</th>
                  <th className="num">{t('reports.report.tables.dispatched')}</th>
                  <th className="num">{t('reports.report.tables.returned')}</th>
                  <th className="num">{t('reports.report.tables.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <span>{item.name}</span>
                      <span className="mdr-code">{item.code}</span>
                    </td>
                    <td className="num">{formatLocaleInteger(locale, item.quantity)}</td>
                    <td className="num">
                      {item.returned > 0 ? (
                        <span className="mdr-ret">
                          {formatLocaleInteger(locale, item.returned)}
                        </span>
                      ) : (
                        <span className="mdr-dash">—</span>
                      )}
                    </td>
                    <td className="num">{formatLocaleCurrency(locale, item.cost)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>
                    {t('reports.report.tables.subtotal', { family: group.family })}
                  </td>
                  <td className="num">{formatLocaleInteger(locale, group.subtotalUnits)}</td>
                  <td className="num">
                    {group.subtotalReturned > 0 ? (
                      <span className="mdr-ret">
                        {formatLocaleInteger(locale, group.subtotalReturned)}
                      </span>
                    ) : (
                      <span className="mdr-dash">—</span>
                    )}
                  </td>
                  <td className="num">{formatLocaleCurrency(locale, group.subtotalCost)}</td>
                </tr>
              </tbody>
            </table>
          ))}

          {/* ─── Per-project cards ─── */}
          {data.byProject.length > 0 && (
            <>
              <h2 className="mdr-section">{t('reports.report.sections.perProject')}</h2>
              <p className="mdr-section-note">{t('reports.report.sections.perProjectNote')}</p>
              <div className="mdr-proj-grid">
                {data.byProject.map((proj) => (
                  <div key={proj.projectId} className="mdr-proj">
                    <Badge variant="outline" className="mdr-proj-badge">
                      {proj.status}
                    </Badge>
                    <h3>{proj.name}</h3>
                    <div className="mdr-proj-client">
                      {proj.clientName || '—'}
                      {proj.poNumber ? ` · PO ${proj.poNumber}` : ''}
                    </div>
                    <dl>
                      <dt>{t('reports.report.project.items')}</dt>
                      <dd>{formatLocaleInteger(locale, proj.items)}</dd>
                      <dt>{t('reports.report.project.units')}</dt>
                      <dd>{formatLocaleInteger(locale, proj.units)}</dd>
                      <dt>{t('reports.report.project.cost')}</dt>
                      <dd>{formatLocaleCurrency(locale, proj.cost)}</dd>
                      <dt>{t('reports.report.project.returns')}</dt>
                      <dd>
                        {proj.returned > 0 ? (
                          <span className="mdr-ret">
                            {formatLocaleInteger(locale, proj.returned)}
                          </span>
                        ) : (
                          '0'
                        )}
                      </dd>
                      {(proj.startDate || proj.endDate || proj.projectDate) && (
                        <>
                          <dt>{t('reports.report.project.dates')}</dt>
                          <dd>
                            {[proj.startDate || proj.projectDate, proj.endDate]
                              .filter(Boolean)
                              .map((d) => formatLocaleDate(locale, d as string))
                              .join(' → ')}
                          </dd>
                        </>
                      )}
                    </dl>

                    {proj.products && proj.products.length > 0 && (
                      <div className="mdr-proj-products">
                        <div className="mdr-proj-products-head">
                          {t('reports.report.project.materialBreakdown')}
                        </div>
                        <ul>
                          {proj.products.map((prod) => (
                            <li key={prod.productId}>
                              <span className="mdr-proj-product-name" title={prod.name}>
                                {prod.name}
                              </span>
                              <span className="mdr-proj-product-qty">
                                {formatLocaleInteger(locale, prod.quantity)}
                                {prod.returned > 0 && (
                                  <span className="mdr-ret">
                                    {' '}−{formatLocaleInteger(locale, prod.returned)}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── Top movers ─── */}
          {data.topMovers && (data.topMovers.up.length > 0 || data.topMovers.down.length > 0) && (
            <>
              <h2 className="mdr-section">{t('reports.report.sections.topMovers')}</h2>
              <p className="mdr-section-note">{t('reports.report.sections.topMoversNote')}</p>
              <div className="mdr-movers-grid">
                <MoverList
                  title={t('reports.report.topMovers.up')}
                  icon="up"
                  rows={data.topMovers.up}
                  locale={locale}
                  prevLabel={t('reports.report.topMovers.previous')}
                  currentLabel={t('reports.report.topMovers.current')}
                />
                <MoverList
                  title={t('reports.report.topMovers.down')}
                  icon="down"
                  rows={data.topMovers.down}
                  locale={locale}
                  prevLabel={t('reports.report.topMovers.previous')}
                  currentLabel={t('reports.report.topMovers.current')}
                />
              </div>
            </>
          )}

          {/* ─── Callout summary ─── */}
          {!isEmpty && (
            <div className="mdr-callout">
              <b>{t('reports.report.callout.title')}:</b>{' '}
              {t('reports.report.callout.body', {
                units: formatLocaleInteger(locale, data.kpis.totalUnits),
                items: formatLocaleInteger(locale, data.kpis.distinctItems),
                cost: formatLocaleCurrency(locale, data.kpis.totalCost),
                returns: formatLocaleInteger(locale, data.kpis.returnedUnits),
              })}
            </div>
          )}

          <footer className="mdr-footer">
            {t('reports.report.eyebrow')} · {generatedAtLabel}
          </footer>
        </div>
      )}
    </div>
  )
}

function KpiTile({
  accent,
  label,
  value,
  helper,
  delta,
  invertColor,
}: {
  accent?: boolean
  label: string
  value: string
  helper: string
  delta?: number
  invertColor?: boolean
}) {
  const hasDelta = typeof delta === 'number'
  const isUp = (delta ?? 0) > 0
  const isDown = (delta ?? 0) < 0
  // For Returns: more returns is usually neutral/negative — invert color so "up" is bronze
  const goodWhenUp = !invertColor
  const tone =
    !hasDelta || delta === 0
      ? 'neutral'
      : (isUp && goodWhenUp) || (isDown && !goodWhenUp)
        ? 'good'
        : 'bad'
  return (
    <div className={`mdr-card ${accent ? 'accent' : ''}`}>
      <div className="mdr-card-label">{label}</div>
      <div className="mdr-card-value">{value}</div>
      <div className="mdr-card-note">{helper}</div>
      {hasDelta && (
        <span className={`mdr-delta mdr-delta-${tone}`}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
          {formatDeltaPct(delta!)}
        </span>
      )}
    </div>
  )
}

function MoverList({
  title,
  icon,
  rows,
  locale,
  prevLabel,
  currentLabel,
}: {
  title: string
  icon: 'up' | 'down'
  rows: Array<{ productId: string; code: string; name: string; quantity: number; previous: number; deltaPct: number }>
  locale: 'en' | 'es'
  prevLabel: string
  currentLabel: string
}) {
  return (
    <div className="mdr-mover">
      <div className="mdr-mover-head">
        {icon === 'up' ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : (
          <TrendingDown className="h-4 w-4" style={{ color: '#a9712f' }} />
        )}
        <span>{title}</span>
      </div>
      <ul>
        {rows.length === 0 && <li className="mdr-mover-empty">—</li>}
        {rows.map((row) => (
          <li key={row.productId}>
            <div className="mdr-mover-name">
              <span>{row.name}</span>
              <span className="mdr-code">{row.code}</span>
            </div>
            <div className="mdr-mover-stats">
              <span>
                {prevLabel}: <b>{formatLocaleInteger(locale, row.previous)}</b>
              </span>
              <span>
                {currentLabel}: <b>{formatLocaleInteger(locale, row.quantity)}</b>
              </span>
              <span className={`mdr-delta-inline ${row.deltaPct >= 0 ? 'good' : 'bad'}`}>
                {formatDeltaPct(row.deltaPct)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReportStyles() {
  return (
    <style>{`
      .mdr-root { --navy:#1f2a44; --navy-soft:#2c3b5e; --bronze:#a9712f; --bronze-soft:#c79a5b; --line:#e3e6ea; --ink:#222831; --muted:#6b7280; --row:#fafbfc; }
      .mdr-printable { color: var(--ink); }
      .mdr-masthead { background: linear-gradient(135deg, var(--navy) 0%, var(--navy-soft) 100%); color:#fff; padding:28px 24px; border-radius:12px; border-bottom:4px solid var(--bronze); }
      .mdr-eyebrow { font-size:11px; letter-spacing:.18em; text-transform:uppercase; color: var(--bronze-soft); font-weight:600; margin-bottom:6px; }
      .mdr-title { margin:0; font-size:22px; font-weight:700; letter-spacing:-0.01em; }
      .mdr-subtitle { margin:6px 0 0; color:#c6cdda; font-size:13px; }
      .mdr-meta { margin-top:14px; display:flex; flex-wrap:wrap; gap:18px; font-size:12px; color:#aeb7c8; }
      .mdr-meta b { color:#fff; font-weight:600; }

      .mdr-cards { display:grid; grid-template-columns:repeat(4, 1fr); gap:14px; margin-top:18px; }
      .mdr-card { position:relative; background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px; box-shadow:0 1px 2px rgba(20,30,50,.04); }
      .mdr-card.accent { background: var(--navy); border-color: var(--navy); color:#fff; }
      .mdr-card-label { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color: var(--muted); font-weight:600; }
      .mdr-card.accent .mdr-card-label { color: var(--bronze-soft); }
      .mdr-card-value { font-size:24px; font-weight:700; color: var(--navy); margin-top:4px; line-height:1.1; font-variant-numeric:tabular-nums; }
      .mdr-card.accent .mdr-card-value { color:#fff; }
      .mdr-card-note { font-size:11.5px; color: var(--muted); margin-top:4px; }
      .mdr-card.accent .mdr-card-note { color:#fff; opacity:.78; }
      .mdr-delta { position:absolute; top:12px; right:12px; display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; background:#eef0f4; color:var(--muted); }
      .mdr-delta-good { background:#e7f0e8; color:#2f6b3a; }
      .mdr-delta-bad { background:#fdf1e0; color:#9a6418; }
      .mdr-card.accent .mdr-delta-good { background: rgba(255,255,255,.15); color:#a7e3b3; }
      .mdr-card.accent .mdr-delta-bad { background: rgba(255,255,255,.15); color:#f0c489; }
      .mdr-card.accent .mdr-delta { background: rgba(255,255,255,.15); color:#fff; }

      .mdr-section { font-size:16px; color: var(--navy); margin:32px 0 4px; display:flex; align-items:center; gap:10px; }
      .mdr-section::before { content:""; width:5px; height:18px; background: var(--bronze); border-radius:2px; display:inline-block; }
      .mdr-section-note { font-size:12.5px; color: var(--muted); margin:0 0 12px; }

      .mdr-table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:10px; overflow:hidden; font-size:13px; margin-bottom:8px; }
      .mdr-table caption { caption-side:top; text-align:left; font-weight:600; color: var(--navy-soft); font-size:13.5px; padding:12px 14px 4px; }
      .mdr-table thead th { background: var(--navy); color:#fff; text-align:left; padding:9px 14px; font-weight:600; font-size:11.5px; letter-spacing:.03em; }
      .mdr-table thead th.num { text-align:right; }
      .mdr-table tbody td { padding:7px 14px; border-top:1px solid var(--line); }
      .mdr-table tbody td.num { text-align:right; font-variant-numeric:tabular-nums; }
      .mdr-table tbody tr:nth-child(even) { background: var(--row); }
      .mdr-table tbody tr.total td { background:#eef0f4; font-weight:700; color: var(--navy); border-top:2px solid var(--bronze); }
      .mdr-ret { color: var(--bronze); font-weight:600; }
      .mdr-dash { color:#c2c7cf; }
      .mdr-code { font-family: ui-monospace, monospace; font-size:10.5px; color:#94a3b8; margin-left:8px; letter-spacing:.01em; }

      .mdr-proj-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; margin-top:6px; }
      .mdr-proj { background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px; }
      .mdr-proj-badge { margin-bottom:6px; text-transform:capitalize; }
      .mdr-proj h3 { margin:0 0 2px; font-size:14.5px; color: var(--navy); }
      .mdr-proj-client { font-size:12px; color: var(--muted); margin-bottom:10px; }
      .mdr-proj dl { margin:0; display:grid; grid-template-columns:1fr auto; gap:5px 12px; font-size:12.5px; }
      .mdr-proj dt { color: var(--muted); }
      .mdr-proj dd { margin:0; text-align:right; font-weight:600; font-variant-numeric:tabular-nums; }

      .mdr-proj-products { margin-top:12px; padding-top:10px; border-top:1px dashed var(--line); }
      .mdr-proj-products-head { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color: var(--bronze); font-weight:600; margin-bottom:6px; }
      .mdr-proj-products ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
      .mdr-proj-products li { display:flex; align-items:baseline; justify-content:space-between; gap:10px; font-size:12.5px; }
      .mdr-proj-product-name { color: var(--ink); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mdr-proj-product-qty { font-weight:700; color: var(--navy); font-variant-numeric:tabular-nums; white-space:nowrap; }

      .mdr-movers-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
      .mdr-mover { background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
      .mdr-mover-head { display:flex; align-items:center; gap:8px; font-weight:600; color: var(--navy); font-size:13px; margin-bottom:10px; }
      .mdr-mover ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
      .mdr-mover li { display:flex; flex-direction:column; gap:3px; padding-bottom:8px; border-bottom:1px dashed var(--line); }
      .mdr-mover li:last-child { border-bottom:0; padding-bottom:0; }
      .mdr-mover-name { display:flex; align-items:baseline; gap:4px; font-size:12.5px; color: var(--ink); }
      .mdr-mover-stats { display:flex; gap:14px; font-size:11.5px; color: var(--muted); font-variant-numeric:tabular-nums; }
      .mdr-mover-empty { color: var(--muted); font-size:12.5px; }
      .mdr-delta-inline { font-weight:600; }
      .mdr-delta-inline.good { color:#2f6b3a; }
      .mdr-delta-inline.bad { color:#9a6418; }

      .mdr-callout { background:#fff; border:1px solid var(--line); border-left:4px solid var(--bronze); border-radius:8px; padding:14px 16px; font-size:13px; color: var(--ink); margin-top:16px; }
      .mdr-callout b { color: var(--navy); }
      .mdr-empty { background:#fff; border:1px dashed var(--line); border-radius:10px; padding:24px; text-align:center; color: var(--muted); font-size:13px; }
      .mdr-footer { margin-top:32px; padding-top:14px; border-top:1px solid var(--line); font-size:11.5px; color: var(--muted); }

      @media (max-width: 980px) {
        .mdr-cards { grid-template-columns: repeat(2, 1fr); }
        .mdr-proj-grid { grid-template-columns: 1fr; }
        .mdr-movers-grid { grid-template-columns: 1fr; }
      }

      @media print {
        body { background:#fff !important; }
        .mdr-controls { display:none !important; }
        nav, aside, header[role="banner"] { display:none !important; }
        .mdr-printable { padding:0 !important; }
        .mdr-card, .mdr-proj, .mdr-table, .mdr-callout, .mdr-mover { box-shadow:none !important; page-break-inside:avoid; }
        .mdr-masthead, .mdr-card.accent, .mdr-table thead th { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      }
    `}</style>
  )
}
