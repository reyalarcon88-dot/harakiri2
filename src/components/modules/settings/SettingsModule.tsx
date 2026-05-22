'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HardHat,
  Layers,
  Loader2,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  Users,
  Warehouse,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/components/layout/I18nProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatLocaleDate, formatLocaleInteger } from '@/lib/i18n/format'
import { useDocumentViewerStore } from '@/stores/document-viewer'
import { TemplatesManagement } from './TemplatesManagement'
import { ExpenseCategoriesManagement } from './ExpenseCategoriesManagement'
import { PhaseTypesManagement } from './PhaseTypesManagement'

interface DbStats {
  warehouses: number
  racks: number
  shelves: number
  products: number
  shelfStocks: number
  suppliers: number
  clients: number
  contractors: number
  purchases: number
  purchaseItems: number
  projects: number
  projectMaterials: number
  dispatches: number
  transfers: number
  tasks: number
  phaseTypes: number
  projectPhases: number
  templates: number
  pendingPurchases: number
  lowStockProducts: number
}

interface ProductImportResult {
  message: string
  created: number
  updated: number
  skipped: number
  totalRows: number
  errors: { row: number; reason: string }[]
}

export function SettingsModule() {
  const { locale, t } = useI18n()
  const openDocumentViewer = useDocumentViewerStore((state) => state.openViewer)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmSeed, setConfirmSeed] = useState(false)
  const [loading, setLoading] = useState<'seed' | 'clear' | 'import' | null>(null)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [documentLaunch, setDocumentLaunch] = useState({ fileName: '', fileUrl: '' })
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery<DbStats>({
    queryKey: ['db-stats'],
    queryFn: () => fetch('/api/settings/stats').then((response) => response.json()),
  })

  const isEmpty =
    !!stats && stats.warehouses === 0 && stats.products === 0 && stats.suppliers === 0

  async function handleSeed() {
    setLoading('seed')

    try {
      const response = await fetch('/api/settings/seed', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || t('settings.toast.seedError'))
      } else {
        toast.success(t('settings.toast.seedSuccess'))
        queryClient.invalidateQueries({ queryKey: ['db-stats'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      }
    } catch {
      toast.error(t('settings.toast.connectionError'))
    } finally {
      setLoading(null)
      setConfirmSeed(false)
    }
  }

  async function handleClear() {
    setLoading('clear')

    try {
      const response = await fetch('/api/settings/clear', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || t('settings.toast.clearError'))
      } else {
        toast.success(t('settings.toast.clearSuccess'))
        queryClient.invalidateQueries({ queryKey: ['db-stats'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        queryClient.invalidateQueries({ queryKey: ['warehouses'] })
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['purchases'] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        queryClient.invalidateQueries({ queryKey: ['transfers'] })
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['suppliers'] })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        queryClient.invalidateQueries({ queryKey: ['contractors'] })
      }
    } catch {
      toast.error(t('settings.toast.connectionError'))
    } finally {
      setLoading(null)
      setConfirmClear(false)
    }
  }

  async function handleProductImport() {
    if (!productFile) {
      toast.error(t('settings.toast.selectFile'))
      return
    }

    setLoading('import')
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', productFile)

      const response = await fetch('/api/settings/products-import', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || t('settings.toast.importError'))
        return
      }

      setImportResult(data)
      setProductFile(null)
      setFileInputKey((value) => value + 1)
      toast.success(
        t('settings.toast.importSuccess', {
          created: formatLocaleInteger(locale, data.created),
          updated: formatLocaleInteger(locale, data.updated),
          skipped: formatLocaleInteger(locale, data.skipped),
        })
      )

      queryClient.invalidateQueries({ queryKey: ['db-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-list'] })
      queryClient.invalidateQueries({ queryKey: ['transfer-products'] })
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] })
    } catch {
      toast.error(t('settings.toast.connectionError'))
    } finally {
      setLoading(null)
    }
  }

  function inferFileName(fileUrl: string) {
    const cleaned = fileUrl.split('?')[0].split('#')[0]
    const lastSegment = cleaned.split('/').filter(Boolean).pop()
    return lastSegment ? decodeURIComponent(lastSegment) : 'document.pdf'
  }

  function handleDocumentLaunch() {
    const fileUrl = documentLaunch.fileUrl.trim()

    if (!fileUrl) {
      toast.error(t('settings.viewer.urlRequired'))
      return
    }

    const fileName = documentLaunch.fileName.trim() || inferFileName(fileUrl)
    const source = /^https?:\/\//i.test(fileUrl) ? 'url' : 'local-path'
    const inventorySection = t('projects.viewer.inventorySection')
    const viewerTitle = t('settings.viewer.title')

    openDocumentViewer({
      documents: [
        {
          id: `manual-${Date.now()}`,
          fileName,
          fileType: '',
          fileUrl,
          entityType: 'other',
          entityId: 'manual-launch',
          uploadedAt: formatLocaleDate(locale, new Date()),
          uploadedBy: t('settings.viewer.manualUser'),
          version: '1.0',
          source,
          locationPath: [inventorySection, t('navigation.page.settings'), viewerTitle],
          metadata: {
            launchMode: source === 'url' ? t('settings.viewer.launchModeUrl') : t('settings.viewer.launchModeLocal'),
            sourcePath: fileUrl,
          },
        },
      ],
      contextTitle: viewerTitle,
      contextPath: [inventorySection, t('navigation.page.settings'), viewerTitle],
    })
  }

  const statItems = stats
    ? [
        { key: 'warehouses', label: t('settings.stats.warehouses'), value: stats.warehouses, icon: Warehouse, color: 'text-emerald-600' },
        { key: 'racks', label: t('settings.stats.racks'), value: stats.racks, icon: ShieldCheck, color: 'text-emerald-600' },
        { key: 'shelves', label: t('settings.stats.shelves'), value: stats.shelves, icon: Database, color: 'text-emerald-600' },
        { key: 'products', label: t('settings.stats.products'), value: stats.products, icon: Package, color: 'text-violet-600' },
        { key: 'shelfStocks', label: t('settings.stats.shelfStocks'), value: stats.shelfStocks, icon: ClipboardList, color: 'text-violet-600' },
        { key: 'suppliers', label: t('settings.stats.suppliers'), value: stats.suppliers, icon: Truck, color: 'text-amber-600' },
        { key: 'clients', label: t('settings.stats.clients'), value: stats.clients, icon: Users, color: 'text-amber-600' },
        { key: 'contractors', label: t('settings.stats.contractors'), value: stats.contractors, icon: HardHat, color: 'text-amber-600' },
        { key: 'purchases', label: t('settings.stats.purchases'), value: stats.purchases, icon: ShoppingCart, color: 'text-rose-600' },
        { key: 'purchaseItems', label: t('settings.stats.purchaseItems'), value: stats.purchaseItems, icon: ShoppingCart, color: 'text-rose-600' },
        { key: 'projects', label: t('settings.stats.projects'), value: stats.projects, icon: FolderKanban, color: 'text-sky-600' },
        { key: 'projectMaterials', label: t('settings.stats.projectMaterials'), value: stats.projectMaterials, icon: FolderKanban, color: 'text-sky-600' },
        { key: 'dispatches', label: t('settings.stats.dispatches'), value: stats.dispatches, icon: ArrowRightLeft, color: 'text-teal-600' },
        { key: 'transfers', label: t('settings.stats.transfers'), value: stats.transfers, icon: ArrowRightLeft, color: 'text-teal-600' },
        { key: 'tasks', label: t('settings.stats.tasks'), value: stats.tasks, icon: ClipboardList, color: 'text-orange-600' },
        { key: 'phaseTypes', label: 'Tipos de fases', value: stats.phaseTypes, icon: Layers, color: 'text-teal-600' },
        { key: 'projectPhases', label: 'Fases de proyectos', value: stats.projectPhases, icon: Layers, color: 'text-teal-600' },
        { key: 'templates', label: t('settings.stats.templates'), value: stats.templates, icon: FileText, color: 'text-pink-600' },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('settings.header.title')}</h2>
        <p className="text-muted-foreground">{t('settings.header.description')}</p>
      </div>

      <Card className="border-2">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                isEmpty ? 'bg-amber-50' : 'bg-emerald-50'
              }`}
            >
              <Database className={`h-6 w-6 ${isEmpty ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base">
                {isLoading
                  ? t('settings.banner.loadingTitle')
                  : isEmpty
                    ? t('settings.banner.emptyTitle')
                    : t('settings.banner.loadedTitle')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? t('settings.banner.loadingDescription')
                  : isEmpty
                    ? t('settings.banner.emptyDescription')
                    : t('settings.banner.loadedDescription', {
                        products: formatLocaleInteger(locale, stats?.products ?? 0),
                        warehouses: formatLocaleInteger(locale, stats?.warehouses ?? 0),
                        projects: formatLocaleInteger(locale, stats?.projects ?? 0),
                      })}
              </p>
            </div>
            {!isEmpty ? (
              <Badge
                variant="outline"
                className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                {t('settings.banner.activeBadge')}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">{t('settings.seed.title')}</CardTitle>
            </div>
            <CardDescription>{t('settings.seed.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>{t('settings.seed.includesLabel')}</p>
                <ul className="ml-1 list-inside list-disc space-y-0.5">
                  <li>{t('settings.seed.includes.warehouses')}</li>
                  <li>{t('settings.seed.includes.products')}</li>
                  <li>{t('settings.seed.includes.people')}</li>
                  <li>{t('settings.seed.includes.purchases')}</li>
                  <li>{t('settings.seed.includes.projects')}</li>
                  <li>{t('settings.seed.includes.operations')}</li>
                </ul>
              </div>
              <Button
                onClick={() => setConfirmSeed(true)}
                disabled={loading !== null || !isEmpty}
                className="w-full"
              >
                {loading === 'seed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                <Download className="mr-2 h-4 w-4" />
                {t('settings.seed.button')}
              </Button>
              {!isEmpty ? (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {t('settings.seed.warning')}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-teal-600" />
              <CardTitle className="text-base">{t('settings.import.title')}</CardTitle>
            </div>
            <CardDescription>{t('settings.import.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button variant="outline" asChild className="w-full">
                <a href="/templates/productos-carga-inicial.xlsx" download>
                  <Download className="mr-2 h-4 w-4" />
                  {t('settings.import.downloadTemplate')}
                </a>
              </Button>

              <div className="space-y-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="product-import-file"
                >
                  {t('settings.import.fileLabel')}
                </label>
                <input
                  key={fileInputKey}
                  id="product-import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    setProductFile(event.target.files?.[0] ?? null)
                    setImportResult(null)
                  }}
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
                />
                <p className="text-xs text-muted-foreground">{t('settings.import.requiredFields')}</p>
              </div>

              <Button
                onClick={handleProductImport}
                disabled={loading !== null || !productFile}
                className="w-full"
              >
                {loading === 'import' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                <Upload className="mr-2 h-4 w-4" />
                {t('settings.import.uploadButton')}
              </Button>

              {importResult ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs">
                  <p className="font-medium">
                    {t('settings.import.resultSummary', {
                      created: formatLocaleInteger(locale, importResult.created),
                      updated: formatLocaleInteger(locale, importResult.updated),
                      skipped: formatLocaleInteger(locale, importResult.skipped),
                    })}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-background p-2">
                      <p className="text-lg font-bold text-emerald-600">
                        {formatLocaleInteger(locale, importResult.created)}
                      </p>
                      <p className="text-muted-foreground">{t('settings.import.created')}</p>
                    </div>
                    <div className="rounded-md bg-background p-2">
                      <p className="text-lg font-bold text-sky-600">
                        {formatLocaleInteger(locale, importResult.updated)}
                      </p>
                      <p className="text-muted-foreground">{t('settings.import.updated')}</p>
                    </div>
                    <div className="rounded-md bg-background p-2">
                      <p className="text-lg font-bold text-amber-600">
                        {formatLocaleInteger(locale, importResult.skipped)}
                      </p>
                      <p className="text-muted-foreground">{t('settings.import.skipped')}</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 ? (
                    <div className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                      {importResult.errors.slice(0, 4).map((error) => (
                        <p key={`${error.row}-${error.reason}`}>
                          {t('settings.import.errorRow', {
                            row: formatLocaleInteger(locale, error.row),
                            reason: error.reason,
                          })}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-500" />
              <CardTitle className="text-base">{t('settings.clear.title')}</CardTitle>
            </div>
            <CardDescription>{t('settings.clear.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                <p className="flex items-center gap-1 text-xs font-medium text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('settings.clear.warningTitle')}
                </p>
                <p className="mt-1 text-xs text-rose-600">{t('settings.clear.warningDescription')}</p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setConfirmClear(true)}
                disabled={loading !== null || isEmpty}
                className="w-full"
              >
                {loading === 'clear' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                <Trash2 className="mr-2 h-4 w-4" />
                {t('settings.clear.button')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              <CardTitle className="text-base">{t('settings.viewer.title')}</CardTitle>
            </div>
            <CardDescription>{t('settings.viewer.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="viewer-file-name">
                  {t('settings.viewer.fileNameLabel')}
                </label>
                <Input
                  id="viewer-file-name"
                  value={documentLaunch.fileName}
                  onChange={(event) =>
                    setDocumentLaunch((current) => ({ ...current, fileName: event.target.value }))
                  }
                  placeholder={t('settings.viewer.fileNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="viewer-file-url">
                  {t('settings.viewer.fileUrlLabel')}
                </label>
                <Input
                  id="viewer-file-url"
                  value={documentLaunch.fileUrl}
                  onChange={(event) =>
                    setDocumentLaunch((current) => ({ ...current, fileUrl: event.target.value }))
                  }
                  placeholder={t('settings.viewer.fileUrlPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.viewer.helperPrefix')}{' '}
                  <span className="font-mono">/uploads/...</span>{' '}
                  {t('settings.viewer.helperSuffix')}
                </p>
              </div>

              <Button onClick={handleDocumentLaunch} className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                {t('settings.viewer.openButton')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <TemplatesManagement />

      <PhaseTypesManagement />

      <ExpenseCategoriesManagement />

      {stats && !isEmpty ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{t('settings.stats.title')}</CardTitle>
            </div>
            <CardDescription>{t('settings.stats.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statItems.map((item) => (
                <div key={item.key} className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <p className="truncate text-xs text-muted-foreground" title={item.label}>
                      {item.label}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {formatLocaleInteger(locale, item.value)}
                  </p>
                </div>
              ))}
              {stats.pendingPurchases > 0 ? (
                <div className="col-span-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 sm:col-span-4">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700">
                    {t('settings.stats.pendingSummary', {
                      purchases: formatLocaleInteger(locale, stats.pendingPurchases),
                      products: formatLocaleInteger(locale, stats.lowStockProducts),
                    })}
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={confirmSeed} onOpenChange={setConfirmSeed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-emerald-500" />
              {t('settings.seed.dialogTitle')}
            </DialogTitle>
            <DialogDescription>{t('settings.seed.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSeed(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSeed} disabled={loading !== null}>
              {loading === 'seed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('settings.seed.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              {t('settings.clear.dialogTitle')}
            </DialogTitle>
            <DialogDescription>{t('settings.clear.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleClear} disabled={loading !== null}>
              {loading === 'clear' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('settings.clear.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
