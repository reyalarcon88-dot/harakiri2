'use client'

import { compareStructuralFrameMaterials, compareFastenerMaterials, extractDimensions, getProductFamily, compareMaterialsByDimensions } from '@/lib/structural-frame-sort'
import { sortMaterialsForDisplay } from '@/lib/material-sort'
import { useState, useRef, useMemo, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  CalendarDays,
  DollarSign,
  User,
  HardHat,
  Package,
  Truck,
  RotateCcw,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Trash2,
  Edit3,
  Check,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Clock,
  ClipboardList,
  Layers,
  Maximize2,
  Minimize2,
  ShoppingBag,
  Copy,
  Inbox,
  Send,
  ChevronsUpDown,
  Bell,
  Download,
  Eye,
  Loader2,
  Printer,
  Receipt,
  Camera,
  RefreshCw,
  Scissors,
  CircleAlert,
  Lock,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  Columns2,
  Wand2,
  PrinterCheck,
  Settings2,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSidebar } from '@/components/ui/sidebar'
import { useI18n } from '@/components/layout/I18nProvider'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProjectStatusBadge } from '@/components/shared/ProjectStatusBadge'
import { MaterialProgressBar } from '@/components/shared/MaterialProgressBar'
import { ProjectNotesFeed } from '@/components/modules/projects/ProjectNotesFeed'
import {
  CollapsedListStrip,
  MaterialsCompactView,
  PlanPdfPane,
  SplitDragHandle,
  useSplitViewSettings,
  type CompactMaterial,
} from '@/components/modules/projects/MaterialsPlanWorkspace'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { ProjectEngineeringDialog } from '@/components/modules/projects/ProjectEngineeringDialog'
import { ProjectPendingsPad } from '@/components/modules/projects/ProjectPendingsPad'
import dynamic from 'next/dynamic'

const ProjectExpensesTab = dynamic(
  () => import('@/components/modules/projects/ProjectExpensesTab').then((m) => m.ProjectExpensesTab),
  { ssr: false },
)
import { useDocumentViewerStore } from '@/stores/document-viewer'
import { useNavigationStore } from '@/stores/navigation'
import type { InventoryDocumentRecord } from '@/types/documents'
import { formatLocaleCurrency, formatLocaleDate, formatLocaleInteger } from '@/lib/i18n/format'
import type { Locale, MessageKey } from '@/lib/i18n/messages'
import { getMaterialProgressTotals } from '@/lib/project-material-progress'
import { getSectionOrder } from '@/lib/engineering-sections'
import { isProductCompatibleWithProjectColor } from '@/lib/project-color'
import { PROJECT_PHASE_COLOR_CLASS, PROJECT_PHASE_PRESETS } from '@/lib/project-phases'
import {
  computeCutPlan,
  detectCutLength,
  findCuttableSourcesForTarget,
  type CuttableSource,
} from '@/lib/cut-stock'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectMaterial {
  id: string
  projectId: string
  productId: string
  plannedQuantity: number
  dispatchedQuantity: number
  engineeringSection?: string
  notes?: string
  sortOrder?: number
  createdAt?: string
  product: { id: string; name: string; code: string; color?: string; unitQuantity?: string | number; engineeringSection?: string; referencePrice?: number; currentStock?: number; _totalShelfStock?: number }
}

interface DispatchItem {
  id: string
  dispatchId: string
  productId: string
  shelfId: string | null
  quantity: number
  product: { id: string; name: string; code: string }
  shelf: { id: string; name: string; rack: { name: string; warehouse: { name: string } } } | null
}

interface Dispatch {
  id: string
  projectId: string
  dispatchDate: string
  notes: string
  items: DispatchItem[]
}

interface ReturnItem {
  id: string
  returnId: string
  productIdDelivered: string
  productIdReturned: string | null
  quantityDelivered: number
  quantityReturned: number
  shelfIdFrom: string | null
  shelfIdTo: string | null
  changeType: string
  specificationDelivered: string
  specificationReturned: string
  notes: string
  productDelivered: { id: string; name: string; code: string }
  productReturned: { id: string; name: string; code: string } | null
  shelfFrom: { id: string; name: string; rack: { id: string; name: string; warehouse: { id: string; name: string } } } | null
  shelfTo: { id: string; name: string; rack: { id: string; name: string; warehouse: { id: string; name: string } } } | null
  returnDestination?: string
  scrapCharged?: boolean
}

interface Return {
  id: string
  projectId: string
  returnDate: string
  notes: string
  status: string
  items: ReturnItem[]
}

interface Project {
  id: string
  name: string
  poNumber?: string
  projectType?: string
  clientId: string
  contractorId: string | null
  projectDate: string
  startDate: string | null
  endDate: string | null
  status: string
  budget: number
  notes: string
  color: string
  createdAt: string
  client: { id: string; name: string; address?: string; phone?: string; email?: string; contactName?: string }
  contractor: { id: string; name: string } | null
  materials: ProjectMaterial[]
  dispatches: Dispatch[]
  returns?: Return[]
  documents?: ProjectDocument[]
  purchases?: ProjectPurchase[]
  phases?: ProjectPhase[]
  tasks?: Array<{
    id: string
    title: string
    dueDate: string | null
    priority: number
    autoGenerated: boolean
    automationKey: string | null
  }>
}

interface ProjectPhaseType {
  id: string
  name: string
  color: string
  sortOrder: number
  active: boolean
}

interface ProjectPhase {
  id: string
  projectId: string
  phaseTypeId: string
  startDate: string
  endDate: string
  status: string
  sortOrder: number
  completedAt: string | null
  phaseType: ProjectPhaseType
}

interface ProjectPurchase {
  id: string
  purchaseCode: string
  poNumber?: string
  purchaseDate?: string
  status: string
  supplierId: string
  supplier: { id: string; name: string }
  items: { id: string; productId: string; quantity: number; product: { id: string; name: string; code: string } }[]
}

interface MaterialTemplate {
  id: string
  name: string
  description: string
  projectType?: string
  sourceFileName?: string
  items: {
    id: string
    productId: string
    plannedQuantity: number
    section?: string
    sortOrder?: number
    product: { id: string; name: string; code: string }
  }[]
}

interface ProjectDocument {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
  category: string
  uploadedAt: string
}

interface Product {
  id: string
  name: string
  code: string
  currentStock: number
  _totalShelfStock?: number
  _availableShelfStock?: number
  _reservedShelfStock?: number
  family?: string
  engineeringSection?: string
  color?: string
  unitOfMeasure?: string
  unitQuantity?: string | number
  shelfStocks?: {
    id: string
    shelfId: string
    quantity: number
    reserveQuantity: number
    isReserveShelf: boolean
    reserveMinimum: number
    reserveNotes: string
    availableQuantity: number
    shelf: { id: string; name: string; rackId: string; rack: { name: string; warehouseId: string; warehouse: { name: string } } }
  }[]
}

interface WarehouseData {
  id: string
  name: string
  racks: { id: string; name: string; shelves: { id: string; name: string }[] }[]
}

interface BomPreviewItem {
  productId: string
  productCode: string
  productName: string
  engineeringSection: string
  quantity: number
  unit: string
  calculationNote: string
}
interface BomPreviewResult {
  items: BomPreviewItem[]
  warnings: string[]
  unmatched: { description: string; family: string }[]
  summary: { perimeter: number; wallArea: number; totalPosts: number; totalBays: number }
}
type BomRoofType = 'hip' | 'gable' | 'flat'

interface ShelfOption {
  id: string
  name: string
  warehouseName: string
  rackName: string
  available: number
}

interface RecepcionListItem {
  id: string
  quantity: number
  product: { id: string; name: string; code: string; unitOfMeasure?: string }
  purchase: {
    id: string
    purchaseCode: string
    poNumber?: string
    project?: { id: string; name: string; poNumber?: string } | null
  } | null
  return?: {
    id: string
    project?: { id: string; name: string; poNumber?: string } | null
  } | null
  sourceProjectId?: string | null
  sourceProjectName?: string | null
}

const EMPTY_RECEPCION_ITEMS: RecepcionListItem[] = []

// Cross-cut candidate: a recepción item of a LONGER product that can be cut into
// the project's planned (shorter) product. The frontend shows these in the cut
// picker alongside shelf-based candidates, distinguished by a "Recepción" badge.
interface ProjectRecepcionCutCandidate {
  recepcionItemId: string
  sourceProduct: { id: string; code: string; name: string; unitOfMeasure: string }
  targetProduct: { id: string; code: string; name: string }
  sourceProjectId: string | null
  sourceProjectName: string | null
  purchaseCode: string | null
  poNumber: string | null
  originalSize: number
  targetSize: number
  pieces: number
}

interface ProjectRecepcionResponse {
  own: RecepcionListItem[]
  crossProject: RecepcionListItem[]
  crossCut: ProjectRecepcionCutCandidate[]
}

const EMPTY_PROJECT_RECEPCION: ProjectRecepcionResponse = { own: [], crossProject: [], crossCut: [] }
const EMPTY_RECEPCION_CUT_CANDIDATES: ProjectRecepcionCutCandidate[] = []

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TAB_VALUES = ['planned', 'scheduled', 'dispatched', 'in_progress', 'finished', 'cancelled', 'all'] as const
const STATUS_OPTION_VALUES = ['planned', 'scheduled', 'dispatched', 'in_progress', 'finished', 'cancelled'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(locale: Locale, value: number): string {
  return formatLocaleCurrency(locale, value)
}

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function calculatePlannedMaterialBudget(project: Project): number {
  return project.materials.reduce(
    (sum, material) => sum + material.plannedQuantity * (material.product.referencePrice || 0),
    0
  )
}

function calculateDispatchedMaterialExpense(project: Project): number {
  return project.materials.reduce(
    (sum, material) => sum + material.dispatchedQuantity * (material.product.referencePrice || 0),
    0
  )
}

function calculateReturnedMaterialCredit(project: Project): number {
  const priceByProduct = new Map(
    project.materials.map((material) => [material.productId, material.product.referencePrice || 0])
  )

  return (project.returns || []).reduce((sum, returnOrder) => {
    if (returnOrder.status !== 'completed') return sum

    return sum + (returnOrder.items || []).reduce((itemSum, item) => {
      // La merma no vuelve al almacén: no genera crédito.
      if (item.returnDestination === 'scrap') return itemSum
      const returnedId = item.productReturned?.id || item.productIdDelivered || ''
      const quantity = toFiniteNumber(item.quantityReturned || item.quantityDelivered)
      // Los remanentes auto-creados no están en materials; usan el precio del producto original.
      const unitPrice = priceByProduct.get(returnedId) ?? priceByProduct.get(item.productIdDelivered) ?? 0
      return itemSum + quantity * unitPrice
    }, 0)
  }, 0)
}

function calculateNetProjectExpense(project: Project): number {
  return Math.max(calculateDispatchedMaterialExpense(project) - calculateReturnedMaterialCredit(project), 0)
}

function getProjectBudgetStats(project: Project) {
  const plannedBudget = calculatePlannedMaterialBudget(project)
  const dispatchedExpense = calculateDispatchedMaterialExpense(project)
  const returnedCredit = calculateReturnedMaterialCredit(project)
  const totalExpense = calculateNetProjectExpense(project)
  const missingPriceMaterials = project.materials.filter((material) => !material.product.referencePrice)
  const remaining = plannedBudget - totalExpense
  const usagePercent = plannedBudget > 0 ? Math.min(Math.round((totalExpense / plannedBudget) * 100), 100) : 0

  return {
    plannedBudget,
    dispatchedExpense,
    returnedCredit,
    totalExpense,
    missingPriceMaterials,
    missingPriceCount: missingPriceMaterials.length,
    remaining,
    usagePercent,
  }
}

function formatDate(locale: Locale, dateStr: string, fallback = '-'): string {
  return formatLocaleDate(locale, dateStr, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) || fallback
}

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function diffDaysInclusive(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.floor((endUtc - startUtc) / 86400000) + 1
}

function diffCalendarDays(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.floor((endUtc - startUtc) / 86400000)
}

function formatProjectTaskSummary(
  project: Project,
  task: NonNullable<Project['tasks']>[number],
  locale: Locale,
  t: (key: MessageKey, values?: Record<string, string | number>) => string
): string {
  if (task.automationKey !== 'start_project_notice') return task.title

  const startDate = project.startDate || project.projectDate
  const parsedStart = parseDateValue(startDate || '')
  if (!startDate || !parsedStart) return task.title

  const daysUntilStart = diffCalendarDays(new Date(), parsedStart)
  const formattedDate = formatDate(locale, startDate)

  if (daysUntilStart === 0) {
    return t('projects.card.startReminderToday', { date: formattedDate })
  }

  if (daysUntilStart === 1) {
    return t('projects.card.startReminderOne', { date: formattedDate })
  }

  if (daysUntilStart > 1) {
    return t('projects.card.startReminderOther', { count: daysUntilStart, date: formattedDate })
  }

  return t('projects.card.startReminderPast', { count: Math.abs(daysUntilStart), date: formattedDate })
}

function getProjectExecutionTime(project: Project): number {
  const executionDate = parseDateValue(project.startDate || project.projectDate || project.endDate || '')
  return executionDate?.getTime() ?? Number.MAX_SAFE_INTEGER
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getProjectStatusLabelKey(status: string): MessageKey {
  switch (status) {
    case 'planned':
      return 'status.project.planned'
    case 'scheduled':
      return 'status.project.scheduled'
    case 'in_progress':
      return 'status.project.inProgress'
    case 'dispatched':
      return 'status.project.dispatched'
    case 'finished':
      return 'status.project.finished'
    case 'cancelled':
      return 'status.project.cancelled'
    default:
      return 'status.project.planned'
  }
}

function getStatusTabs(t: (key: MessageKey, values?: Record<string, string | number>) => string) {
  return STATUS_TAB_VALUES.map((value) => ({
    key: value,
    label: value === 'all' ? t('projects.filters.allStatuses') : t(getProjectStatusLabelKey(value)),
  }))
}

function getStatusOptions(t: (key: MessageKey, values?: Record<string, string | number>) => string) {
  return STATUS_OPTION_VALUES.map((value) => ({
    value,
    label: t(getProjectStatusLabelKey(value)),
  }))
}

// ──────────────────────────────────────────────────────────────────────────
// ProjectStatusPicker — Badge clickable que abre un popover para cambiar el estado
// rápidamente sin necesidad de ir a la info del proyecto.
// ──────────────────────────────────────────────────────────────────────────

const STATUS_PICKER_OPTIONS: { value: 'planned' | 'scheduled' | 'in_progress' | 'dispatched' | 'finished'; icon: LucideIcon; bg: string; text: string; border: string }[] = [
  { value: 'planned',     icon: ClipboardList, bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  { value: 'scheduled',   icon: CalendarDays,  bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  { value: 'in_progress', icon: Clock,         bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  { value: 'dispatched',  icon: Truck,         bg: 'bg-emerald-100',text: 'text-emerald-700', border: 'border-emerald-200' },
  { value: 'finished',    icon: CheckCircle,   bg: 'bg-emerald-100',text: 'text-emerald-700', border: 'border-emerald-200' },
]

interface ProjectStatusPickerProps {
  status: string
  onChange: (newStatus: string) => void
  hasStartDate: boolean
  hasMaterials: boolean
  disabled?: boolean
}

function ProjectStatusPicker({ status, onChange, hasStartDate, hasMaterials, disabled }: ProjectStatusPickerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  // Si el proyecto está cancelado, el badge es de solo lectura (cancelación
  // tiene su propio flujo con confirmación). 'Finished' SÍ se puede cambiar
  // (puede revertirse a Dispatched si fuera necesario).
  if (disabled || status === 'cancelled') {
    return <ProjectStatusBadge status={status} />
  }

  const handleSelect = (newStatus: string) => {
    if (newStatus === status) {
      setOpen(false)
      return
    }
    // Validación para 'scheduled': requiere startDate y materiales
    if (newStatus === 'scheduled' && (!hasStartDate || !hasMaterials)) {
      toast.error(
        !hasStartDate && !hasMaterials
          ? 'Scheduled projects need a start date and materials list'
          : !hasStartDate
            ? 'Scheduled projects need a start date'
            : 'Scheduled projects need a materials list'
      )
      setOpen(false)
      return
    }
    onChange(newStatus)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md transition hover:ring-2 hover:ring-offset-1 hover:ring-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300 cursor-pointer"
          title={t('projects.actions.changeStatus')}
        >
          <ProjectStatusBadge status={status} />
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Cambiar estado
        </div>
        <div className="space-y-0.5">
          {STATUS_PICKER_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isCurrent = opt.value === status
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                disabled={isCurrent}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition disabled:cursor-default disabled:opacity-100 ${
                  isCurrent
                    ? `${opt.bg} ${opt.text} border ${opt.border}`
                    : 'hover:bg-muted text-foreground border border-transparent'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isCurrent ? opt.text : 'text-muted-foreground'}`} />
                <span className="flex-1 text-left">{t(getProjectStatusLabelKey(opt.value))}</span>
                {isCurrent && <Check className="h-3 w-3 text-emerald-600" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function getProjectColorLabel(
  color: string,
  t: (key: MessageKey, values?: Record<string, string | number>) => string
) {
  switch (color) {
    case 'Blanco':
      return t('projects.colors.white')
    case 'Bronze':
      return t('projects.colors.bronze')
    default:
      return color
  }
}

function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) return '📄'
  if (fileType.includes('image')) return '🖼️'
  if (fileType.includes('word') || fileType.includes('doc')) return '📝'
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('xls')) return '📊'
  return '📎'
}

function getProjectStatusAccent(status: string) {
  switch (status) {
    case 'planned':     return { card: 'border-l-4 border-l-teal-400',    header: 'bg-teal-50/70' }
    case 'scheduled':   return { card: 'border-l-4 border-l-sky-400',     header: 'bg-sky-50/70' }
    case 'in_progress': return { card: 'border-l-4 border-l-cyan-400',    header: 'bg-cyan-50/70' }
    case 'dispatched':  return { card: 'border-l-4 border-l-emerald-400', header: 'bg-emerald-50/70' }
    case 'finished':    return { card: 'border-l-4 border-l-emerald-400', header: 'bg-emerald-50/70' }
    case 'cancelled':   return { card: 'border-l-4 border-l-rose-400',    header: 'bg-rose-50/70' }
    default:            return { card: '',                                 header: 'bg-muted/30' }
  }
}

// Pending units = planificado - despachado, across all materials of a project.
// Only meaningful for projects that aren't finished/cancelled.
function calcPendingUnits(project: Project): number {
  if (project.status === 'finished' || project.status === 'cancelled') return 0
  return getMaterialProgressTotals(project.materials).pending
}

function calcPendingMaterialCount(project: Project): number {
  if (project.status === 'finished' || project.status === 'cancelled') return 0
  return project.materials.filter((material) => material.plannedQuantity > material.dispatchedQuantity).length
}

function calcPendingActionCount(project: Project, products: Product[] = []): number {
  if (project.status === 'finished' || project.status === 'cancelled') return 0

  const purchasedByProduct = new Map<string, number>()
  for (const purchase of project.purchases || []) {
    if (purchase.status === 'cancelled') continue
    for (const item of purchase.items || []) {
      purchasedByProduct.set(item.productId, (purchasedByProduct.get(item.productId) || 0) + item.quantity)
    }
  }

  return project.materials.reduce((count, material) => {
    const remaining = Math.max(material.plannedQuantity - material.dispatchedQuantity, 0)
    if (remaining <= 0) return count

    const product = products.find((item) => item.id === material.productId)
    const materialProduct = material.product as ProjectMaterial['product'] & {
      currentStock?: number
      _totalShelfStock?: number
    }
    const inStock =
      product?._availableShelfStock ??
      product?._totalShelfStock ??
      product?.currentStock ??
      (materialProduct as Product & { _availableShelfStock?: number })._availableShelfStock ??
      materialProduct._totalShelfStock ??
      materialProduct.currentStock ??
      0
    const cuttableStock = findCuttableSourcesForTarget(
      {
        id: material.productId,
        code: material.product.code,
        name: material.product.name,
        color: material.product.color,
        unitQuantity: material.product.unitQuantity,
      },
      products,
    ).reduce((sum, source) => sum + source.coveredTargetPieces, 0)
    const purchased = purchasedByProduct.get(material.productId) || 0
    const uncovered = Math.max(remaining - purchased - inStock - cuttableStock, 0)
    const canDispatch = inStock > 0 || cuttableStock > 0
    const needsPurchase = uncovered > 0

    return count + (canDispatch ? 1 : 0) + (needsPurchase ? 1 : 0)
  }, 0)
}

function buildProjectViewerDocuments(
  project: Project,
  locale: Locale,
  t: (key: MessageKey, values?: Record<string, string | number>) => string
): InventoryDocumentRecord[] {
  return (project.documents || []).map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileUrl: `/api/projects/${project.id}/documents/${doc.id}`,
    downloadUrl: `/api/projects/${project.id}/documents/${doc.id}?download=1`,
    entityType: 'project',
    entityId: project.id,
    uploadedAt: formatDate(locale, doc.uploadedAt),
    uploadedBy: t('purchases.viewer.systemUser'),
    version: '1.0',
    fileSize: doc.fileSize,
    source: 'database',
    originalFileUrl: doc.fileUrl,
    locationPath: [t('projects.viewer.inventorySection'), t('navigation.page.projects'), project.name, t('projects.tabs.documents')],
    metadata: {
      projectName: project.name,
      projectStatus: project.status,
      client: project.client.name,
      poNumber: project.poNumber || t('projects.fields.noPo'),
    },
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectsModule() {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const targetProjectId = useNavigationStore((state) => state.targetProjectId)
  const clearNavigationTargets = useNavigationStore((state) => state.clearTargets)
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('planned')
  const [searchQuery, setSearchQuery] = useState('')

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      return res.json() as Promise<Project[]>
    },
  })

  const { data: selectedProject, isLoading: projectLoading } = useQuery({
    queryKey: ['project', selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      return res.json() as Promise<Project>
    },
    enabled: !!selectedProjectId && view === 'detail',
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to fetch products')
      return res.json() as Promise<Product[]>
    },
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error('Failed to fetch clients')
      return res.json() as Promise<{ id: string; name: string }[]>
    },
  })

  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors'],
    queryFn: async () => {
      const res = await fetch('/api/contractors')
      if (!res.ok) throw new Error('Failed to fetch contractors')
      return res.json() as Promise<{ id: string; name: string }[]>
    },
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['material-templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json() as Promise<MaterialTemplate[]>
    },
  })

  const { data: phaseTypes = [] } = useQuery({
    queryKey: ['project-phase-types'],
    queryFn: async () => {
      const res = await fetch('/api/project-phase-types')
      if (!res.ok) throw new Error('Failed to fetch phase types')
      return res.json() as Promise<ProjectPhaseType[]>
    },
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Failed to fetch warehouses')
      return res.json() as Promise<WarehouseData[]>
    },
  })

  const { data: recepcionItems = [] } = useQuery({
    queryKey: ['recepcion'],
    queryFn: async () => {
      const res = await fetch('/api/recepcion')
      if (!res.ok) throw new Error('Failed to fetch receiving')
      return res.json() as Promise<RecepcionListItem[]>
    },
  })

  useEffect(() => {
    if (!targetProjectId) return
    setSelectedProjectId(targetProjectId)
    setView('detail')
    clearNavigationTargets()
  }, [clearNavigationTargets, targetProjectId])

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createProjectMutation = useMutation({
    mutationFn: async (data: {
      name: string
      poNumber?: string
      projectType?: string
      clientId: string
      contractorId?: string
      projectDate?: string
      startDate?: string
      endDate?: string
      color?: string
      materialListFile?: File | null
      phases?: Array<{ phaseTypeId: string; startDate?: string; endDate?: string; sortOrder?: number }>
    }) => {
      const materialListFile = data.materialListFile
      const body = { ...data }
      delete body.materialListFile

      if (materialListFile) {
        const formData = new FormData()
        Object.entries(body).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            formData.append(key, key === 'phases' ? JSON.stringify(value) : String(value))
          }
        })
        formData.append('materialListFile', materialListFile)

        const res = await fetch('/api/projects', {
          method: 'POST',
          body: formData,
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok) throw new Error(payload?.error || t('projects.toast.createError'))
        return payload
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || t('projects.toast.createError'))
      return payload
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.created'))
      if (created?.autoTemplate?.createdCount > 0) {
        toast.info(
          t('projects.toast.autoTemplateApplied', {
            name: created.autoTemplate.name,
            count: formatLocaleInteger(locale, created.autoTemplate.createdCount),
          })
        )
      }
      if (created?.autoTemplate?.skippedIncompatibleCount > 0) {
        toast.info(
          t('projects.toast.autoTemplateSkippedIncompatible', {
            count: formatLocaleInteger(locale, created.autoTemplate.skippedIncompatibleCount),
          })
        )
      }
      if (created?.materialListImport?.createdCount > 0) {
        toast.info(
          t('projects.toast.materialListImported', {
            count: formatLocaleInteger(locale, created.materialListImport.createdCount),
            products: formatLocaleInteger(locale, created.materialListImport.createdProductsCount || 0),
          })
        )
      }
      if (created?.materialListImport?.skippedIncompatibleCount > 0) {
        toast.info(
          t('projects.toast.materialListSkippedIncompatible', {
            count: formatLocaleInteger(locale, created.materialListImport.skippedIncompatibleCount),
          })
        )
      }
      // Open the newly created project
      setSelectedProjectId(created.id)
      setView('detail')
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.createError')),
  })

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Failed to update project')
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      toast.success(t('projects.toast.updated'))
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.updateError')),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete project')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setView('list')
      setSelectedProjectId(null)
      toast.success(t('projects.toast.deleted'))
    },
    onError: () => toast.error(t('projects.toast.deleteError')),
  })

  const cancelProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}/cancel`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to cancel project')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      toast.success(t('projects.toast.cancelled'))
    },
    onError: () => toast.error(t('projects.toast.cancelError')),
  })

  const finishProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}/finish`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to finish project')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      toast.success(t('projects.toast.finished'))
    },
    onError: () => toast.error(t('projects.toast.finishError')),
  })

  // ─── Filtered Projects ──────────────────────────────────────────────────────

  const filteredProjects = projects
    .filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.client.name.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const aTime = getProjectExecutionTime(a)
      const bTime = getProjectExecutionTime(b)
      const dateDiff = statusFilter === 'finished' ? bTime - aTime : aTime - bTime
      if (dateDiff !== 0) return dateDiff
      return a.name.localeCompare(b.name)
    })

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const openDetail = (id: string) => {
    setSelectedProjectId(id)
    setView('detail')
  }

  const goBack = () => {
    setView('list')
    setSelectedProjectId(null)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (view === 'detail' && selectedProjectId) {
    return (
      <ProjectDetailView
        project={selectedProject}
        loading={projectLoading}
        products={products}
        clients={clients}
        contractors={contractors}
        templates={templates}
        warehouses={warehouses}
        phaseTypes={phaseTypes}
        onBack={goBack}
        onUpdateProject={(data) => updateProjectMutation.mutate({ id: selectedProjectId, data })}
        onDeleteProject={() => deleteProjectMutation.mutate(selectedProjectId)}
        onCancelProject={() => cancelProjectMutation.mutate(selectedProjectId)}
        onFinishProject={() => finishProjectMutation.mutate(selectedProjectId)}
        queryClient={queryClient}
      />
    )
  }

  return (
    <ProjectListView
      projects={filteredProjects}
      allProjects={projects}
      loading={projectsLoading}
      statusFilter={statusFilter}
      searchQuery={searchQuery}
      onStatusFilterChange={setStatusFilter}
      onSearchChange={setSearchQuery}
      onSelectProject={openDetail}
      onCreateProject={(data) => createProjectMutation.mutate(data)}
      clients={clients}
      contractors={contractors}
      templates={templates}
      products={products}
      phaseTypes={phaseTypes}
      recepcionItems={recepcionItems}
    />
  )
}

// ─── Existing Projects Warning ────────────────────────────────────────────────
// Soft warning that surfaces a client's existing projects while filling the
// "New project" form, so the user can open the one they forgot they had
// instead of creating a duplicate. Filters out cancelled projects, sorts by
// createdAt desc, caps at 5.

interface ExistingProjectsWarningProps {
  clientId: string
  projects: Project[]
  onSelectExisting: (id: string) => void
}

function ExistingProjectsWarning({ clientId, projects, onSelectExisting }: ExistingProjectsWarningProps) {
  const { locale } = useI18n()
  const matches = useMemo(() => {
    if (!clientId) return []
    return projects
      .filter((p) => p.clientId === clientId && p.status !== 'cancelled')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5)
  }, [clientId, projects])

  if (matches.length === 0) return null

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-gradient-to-b from-amber-50 to-amber-50/40 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-amber-800">
            Este cliente ya tiene {matches.length} proyecto{matches.length !== 1 ? 's' : ''}
          </div>
          <div className="text-[11.5px] text-amber-700">
            ¿Querés abrir alguno en vez de crear uno nuevo?
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {matches.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectExisting(p.id)}
            className="group flex w-full items-center gap-2.5 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-left transition hover:border-amber-300 hover:bg-amber-50/60 hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-slate-800">{p.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                <span>Creado {formatLocaleDate(locale, p.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }) || '—'}</span>
                {p.poNumber && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>PO {p.poNumber}</span>
                  </>
                )}
              </div>
            </div>
            <ProjectStatusBadge status={p.status} />
            <span className="shrink-0 text-amber-600 transition group-hover:translate-x-0.5">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────

interface ProjectListViewProps {
  projects: Project[]
  allProjects: Project[]
  loading: boolean
  statusFilter: string
  searchQuery: string
  onStatusFilterChange: (v: string) => void
  onSearchChange: (v: string) => void
  onSelectProject: (id: string) => void
  onCreateProject: (data: {
    name: string
    poNumber?: string
    projectType?: string
    clientId: string
    contractorId?: string
    projectDate?: string
    startDate?: string
    endDate?: string
  color?: string
  materialListFile?: File | null
  phases?: Array<{ phaseTypeId: string; startDate?: string; endDate?: string; sortOrder?: number }>
  }) => void
  clients: { id: string; name: string }[]
  contractors: { id: string; name: string }[]
  templates: MaterialTemplate[]
  products: Product[]
  phaseTypes: ProjectPhaseType[]
  recepcionItems: RecepcionListItem[]
}

function ProjectListView({
  projects,
  allProjects,
  loading,
  statusFilter,
  searchQuery,
  onStatusFilterChange,
  onSearchChange,
  onSelectProject,
  onCreateProject,
  clients,
  contractors,
  templates,
  products,
  phaseTypes,
  recepcionItems,
}: ProjectListViewProps) {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const openPurchase = useNavigationStore((state) => state.openPurchase)
  const openRecepcionForProject = useNavigationStore((state) => state.openRecepcionForProject)
  const [createOpen, setCreateOpen] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '',
    poNumber: '',
    projectType: '',
    clientId: '',
    contractorId: '',
    projectDate: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    color: '',
  })
  const [materialListFile, setMaterialListFile] = useState<File | null>(null)
  const materialListInputRef = useRef<HTMLInputElement | null>(null)
  const [startDateCalendarOpen, setStartDateCalendarOpen] = useState(false)
  const [endDateCalendarOpen, setEndDateCalendarOpen] = useState(false)
  const activePhaseTypes = useMemo(() => phaseTypes.filter((type) => type.active), [phaseTypes])
  const [selectedPhaseTypeIds, setSelectedPhaseTypeIds] = useState<string[]>([])

  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', contactName: '', email: '', phone: '', address: '' })
  const [contractorDialogOpen, setContractorDialogOpen] = useState(false)
  const [newContractor, setNewContractor] = useState({ name: '', contactName: '', email: '', phone: '', specialty: '' })
  const statusTabs = useMemo(() => getStatusTabs(t), [t])

  const createClientMutation = useMutation({
    mutationFn: async (data: typeof newClient) => {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('projects.toast.clientCreateError'))
      }
      return res.json() as Promise<{ id: string; name: string }>
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setNewProject((p) => ({ ...p, clientId: created.id }))
      setClientDialogOpen(false)
      setNewClient({ name: '', contactName: '', email: '', phone: '', address: '' })
      toast.success(t('projects.toast.clientCreated'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createContractorMutation = useMutation({
    mutationFn: async (data: typeof newContractor) => {
      const res = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('projects.toast.contractorCreateError'))
      }
      return res.json() as Promise<{ id: string; name: string }>
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] })
      setNewProject((p) => ({ ...p, contractorId: created.id }))
      setContractorDialogOpen(false)
      setNewContractor({ name: '', contactName: '', email: '', phone: '', specialty: '' })
      toast.success(t('projects.toast.contractorCreated'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const countsByStatus = {
    all: allProjects.length,
    planned: allProjects.filter((p) => p.status === 'planned').length,
    scheduled: allProjects.filter((p) => p.status === 'scheduled').length,
    in_progress: allProjects.filter((p) => p.status === 'in_progress').length,
    dispatched: allProjects.filter((p) => p.status === 'dispatched').length,
    finished: allProjects.filter((p) => p.status === 'finished').length,
    cancelled: allProjects.filter((p) => p.status === 'cancelled').length,
  }

  const recepcionCountByProject = useMemo(() => {
    const counts = new Map<string, number>()

    for (const item of recepcionItems) {
      const projectId = item.purchase?.project?.id || item.return?.project?.id
      if (!projectId) continue
      counts.set(projectId, (counts.get(projectId) || 0) + 1)
    }

    return counts
  }, [recepcionItems])

  const activeProjects = allProjects.filter((p) => !['finished', 'cancelled'].includes(p.status)).length
  const pendingProjects = allProjects
    .filter((p) => calcPendingActionCount(p, products) > 0)
    .sort((a, b) => {
      const dateDiff = getProjectExecutionTime(a) - getProjectExecutionTime(b)
      if (dateDiff !== 0) return dateDiff
      return a.name.localeCompare(b.name)
    })
  const totalPendingUnits = pendingProjects.reduce((s, p) => s + calcPendingUnits(p), 0)
  const totalPendingMaterialCount = pendingProjects.reduce((s, p) => s + calcPendingActionCount(p, products), 0)
  const totalPlannedUnits = allProjects.reduce(
    (sum, p) => sum + getMaterialProgressTotals(p.materials).planned,
    0
  )
  const totalDispatchedUnits = allProjects.reduce(
    (sum, p) => sum + getMaterialProgressTotals(p.materials).dispatched,
    0
  )
  const portfolioProgress = totalPlannedUnits > 0
    ? Math.round((totalDispatchedUnits / totalPlannedUnits) * 100)
    : 0

  const startDateValue = parseDateValue(newProject.startDate)
  const endDateValue = parseDateValue(newProject.endDate)
  const durationDays = startDateValue && endDateValue ? diffDaysInclusive(startDateValue, endDateValue) : null
  const endCalendarModifiers = {
    ...(startDateValue ? { projectStart: startDateValue } : {}),
    ...(startDateValue && endDateValue ? { projectRange: { from: startDateValue, to: endDateValue } } : {}),
  }

  const handleCreate = () => {
    if (!newProject.name || !newProject.clientId) {
      toast.error(t('projects.validation.nameClientRequired'))
      return
    }
    onCreateProject({
      name: newProject.name,
      poNumber: newProject.poNumber || undefined,
      projectType: newProject.projectType.trim() || undefined,
      clientId: newProject.clientId,
      contractorId: newProject.contractorId && newProject.contractorId !== 'none'
        ? newProject.contractorId
        : undefined,
      projectDate: newProject.startDate || newProject.projectDate,
      startDate: newProject.startDate || undefined,
      endDate: newProject.endDate || undefined,
      color: newProject.color || undefined,
      materialListFile,
      phases: selectedPhaseTypeIds.map((phaseTypeId, index) => ({
        phaseTypeId,
        startDate: newProject.startDate || newProject.projectDate,
        endDate: newProject.endDate || newProject.startDate || newProject.projectDate,
        sortOrder: index,
      })),
    })
    setCreateOpen(false)
    setNewProject({
      name: '',
      poNumber: '',
      projectType: '',
      clientId: '',
      contractorId: '',
      projectDate: new Date().toISOString().split('T')[0],
      startDate: '',
      endDate: '',
      color: '',
    })
    setMaterialListFile(null)
    setSelectedPhaseTypeIds([])
    if (materialListInputRef.current) materialListInputRef.current.value = ''
  }

  function toggleCreatePhase(phaseTypeId: string, checked: boolean) {
    setSelectedPhaseTypeIds((current) => {
      if (checked) return current.includes(phaseTypeId) ? current : [...current, phaseTypeId]
      return current.filter((id) => id !== phaseTypeId)
    })
  }

  function applyCreatePhasePreset(phaseNames: readonly string[]) {
    const ids = phaseNames
      .map((name) => activePhaseTypes.find((type) => type.name === name)?.id)
      .filter((id): id is string => Boolean(id))
    setSelectedPhaseTypeIds(ids)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-teal-700" />
            <h1 className="text-xl font-semibold tracking-tight">{t('navigation.page.projects')}</h1>
          </div>
          <p className="text-xs text-muted-foreground">{t('projects.header.description')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t('projects.actions.newProject')}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: t('projects.stats.total'),
            value: formatLocaleInteger(locale, allProjects.length),
            sub: t('projects.stats.totalSub'),
          },
          {
            label: t('projects.stats.active'),
            value: formatLocaleInteger(locale, activeProjects),
            sub: t('projects.stats.activeSub'),
          },
          {
            label: t('projects.stats.pending'),
            value: formatLocaleInteger(locale, totalPendingUnits),
            sub: t('projects.stats.pendingSub'),
          },
          {
            label: t('projects.stats.progress'),
            value: `${portfolioProgress}%`,
            sub: t('projects.stats.progressSub', {
              dispatched: formatLocaleInteger(locale, totalDispatchedUnits),
              planned: formatLocaleInteger(locale, totalPlannedUnits),
            }),
          },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-card px-4 py-2.5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Pending Operations Notification */}
      {pendingProjects.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {pendingProjects.length === 1
                ? t('projects.pending.one')
                : t('projects.pending.other', { count: formatLocaleInteger(locale, pendingProjects.length) })}
              <span className="ml-2 font-normal text-muted-foreground">
                ({t('projects.pending.items', { count: formatLocaleInteger(locale, totalPendingMaterialCount) })})
              </span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {pendingProjects.slice(0, 6).map((p) => {
                const calcPendingUnits = (project: Project) => calcPendingActionCount(project, products)
                return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className="rounded-md border bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:border-teal-300 hover:text-teal-800"
                >
                  {p.poNumber ? `PO ${p.poNumber}` : p.name} · {calcPendingUnits(p)}
                </button>
                )
              })}
              {pendingProjects.length > 6 && (
                <span className="self-center text-xs text-muted-foreground">
                  {t('projects.pending.more', { count: formatLocaleInteger(locale, pendingProjects.length - 6) })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('projects.filters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onStatusFilterChange(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-teal-700 text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
                <span className={`rounded px-1.5 py-0.5 text-xs ${
                  statusFilter === tab.key ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {countsByStatus[tab.key as keyof typeof countsByStatus] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Project Cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={t('projects.empty.title')}
          description={
            searchQuery || statusFilter !== 'all'
              ? t('projects.empty.filtered')
              : t('projects.empty.default')
          }
          action={
            !searchQuery && statusFilter === 'all' ? (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('projects.actions.createProject')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              recepcionCount={recepcionCountByProject.get(project.id) || 0}
              onClick={() => onSelectProject(project.id)}
              onOpenPurchase={openPurchase}
              onOpenRecepcion={() => openRecepcionForProject(project.id)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-teal-700" />
              {t('projects.actions.newProject')}
            </DialogTitle>
            <DialogDescription>{t('projects.create.description')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <div className="space-y-2">
              <Label>{t('projects.fields.nameRequired')}</Label>
              <Input
                placeholder={t('projects.fields.namePlaceholder')}
                value={newProject.name}
                onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('projects.fields.po')}</Label>
              <Input
                placeholder={t('projects.fields.poPlaceholder')}
                value={newProject.poNumber}
                onChange={(e) => setNewProject((p) => ({ ...p, poNumber: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t('projects.fields.poHelper')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('projects.fields.projectType')}</Label>
              {templates.filter((tmpl) => tmpl.projectType).length > 0 ? (
                <Select
                  value={newProject.projectType || '__none__'}
                  onValueChange={(v) =>
                    setNewProject((p) => ({ ...p, projectType: v === '__none__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('projects.fields.projectTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin plantilla —</SelectItem>
                    {templates
                      .filter((tmpl) => tmpl.projectType)
                      .map((tmpl) => (
                        <SelectItem key={tmpl.id} value={tmpl.projectType!}>
                          <span className="font-medium">{tmpl.projectType}</span>
                          <span className="ml-2 text-muted-foreground text-xs">({tmpl.name})</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={t('projects.fields.projectTypePlaceholder')}
                  value={newProject.projectType}
                  onChange={(e) => setNewProject((p) => ({ ...p, projectType: e.target.value }))}
                />
              )}
              {newProject.projectType ? (
                <p className="text-xs text-teal-700 font-medium">
                  ✓ Se cargarán automáticamente los materiales de la plantilla al crear el proyecto.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('projects.fields.projectTypeHelper')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('projects.fields.materialList')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={materialListInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => setMaterialListFile(event.target.files?.[0] ?? null)}
                  className="flex-1"
                />
                {materialListFile ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setMaterialListFile(null)
                      if (materialListInputRef.current) materialListInputRef.current.value = ''
                    }}
                    title={t('projects.actions.clearMaterialList')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              {materialListFile ? (
                <p className="text-xs text-teal-700 font-medium">
                  {t('projects.fields.materialListSelected', { fileName: materialListFile.name })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('projects.fields.materialListHelper')}</p>
              )}
            </div>

            {/* Color del proyecto */}
            <div className="space-y-2">
              <Label>{t('projects.fields.color')}</Label>
              <div className="flex gap-2">
                {['Blanco', 'Bronze'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewProject((p) => ({ ...p, color: p.color === c ? '' : c }))}
                    className={`flex-1 rounded-md border-2 py-2 px-3 text-sm font-medium transition-all ${
                      newProject.color === c
                        ? c === 'Blanco'
                          ? 'border-slate-400 bg-slate-50 text-slate-900 ring-2 ring-slate-300'
                          : 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-300'
                        : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    <span className={`inline-block w-3 h-3 rounded-full mr-2 align-middle ${c === 'Blanco' ? 'bg-slate-200 border border-slate-400' : 'bg-amber-600'}`} />
                    {getProjectColorLabel(c, t)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('projects.fields.colorHelper')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('projects.fields.clientRequired')}</Label>
              <div className="flex gap-2">
                <Select value={newProject.clientId} onValueChange={(v) => setNewProject((p) => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={t('projects.fields.selectClient')} /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setClientDialogOpen(true)} title={t('projects.actions.newClient')}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ExistingProjectsWarning
                clientId={newProject.clientId}
                projects={allProjects}
                onSelectExisting={(id) => {
                  setCreateOpen(false)
                  onSelectProject(id)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('projects.fields.contractor')}</Label>
              <div className="flex gap-2">
                <Select value={newProject.contractorId} onValueChange={(v) => setNewProject((p) => ({ ...p, contractorId: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={t('projects.fields.selectContractor')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('projects.fields.noContractor')}</SelectItem>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setContractorDialogOpen(true)} title={t('projects.actions.newContractor')}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('projects.fields.startDate')}</Label>
                <Popover open={startDateCalendarOpen} onOpenChange={setStartDateCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 font-normal"
                    >
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {newProject.startDate ? formatDate(locale, newProject.startDate) : t('projects.fields.selectStartDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDateValue}
                      defaultMonth={startDateValue}
                      onSelect={(date) => {
                        if (!date) return
                        const startDate = toDateValue(date)
                        setNewProject((p) => ({
                          ...p,
                          startDate,
                          projectDate: startDate || p.projectDate,
                          endDate:
                            startDate && p.endDate && p.endDate < startDate
                              ? ''
                              : p.endDate,
                        }))
                        setStartDateCalendarOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t('projects.fields.endDate')}</Label>
                <Popover open={endDateCalendarOpen} onOpenChange={setEndDateCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 font-normal"
                    >
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {newProject.endDate ? formatDate(locale, newProject.endDate) : t('projects.fields.selectEndDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="border-b px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">{t('projects.fields.startDate')}</span>
                        <span className="font-medium">
                          {newProject.startDate ? formatDate(locale, newProject.startDate) : t('projects.fields.noStartDate')}
                        </span>
                      </div>
                      {durationDays !== null && durationDays > 0 ? (
                        <div className="mt-1 flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">{t('projects.fields.duration')}</span>
                          <span className="font-medium">
                            {durationDays === 1
                              ? t('projects.fields.durationOne', { count: formatLocaleInteger(locale, durationDays) })
                              : t('projects.fields.durationOther', { count: formatLocaleInteger(locale, durationDays) })}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <Calendar
                      mode="single"
                      selected={endDateValue}
                      defaultMonth={startDateValue || endDateValue}
                      disabled={startDateValue ? { before: startDateValue } : undefined}
                      modifiers={endCalendarModifiers}
                      modifiersClassNames={{
                        projectStart:
                          '!bg-teal-100 !text-teal-900 ring-2 ring-teal-500 dark:!bg-teal-900/60 dark:!text-teal-100',
                        projectRange:
                          'bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-100',
                      }}
                      onSelect={(date) => {
                        if (!date) return
                        setNewProject((p) => ({ ...p, endDate: toDateValue(date) }))
                        setEndDateCalendarOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {newProject.startDate && !newProject.endDate ? (
                  <p className="text-xs text-muted-foreground">
                    {t('projects.fields.startDateHint')}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-teal-700" />
                    Fases
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Selecciona las fases que se verán en el calendario.
                  </p>
                </div>
                {selectedPhaseTypeIds.length > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPhaseTypeIds([])}>
                    Limpiar
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {PROJECT_PHASE_PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => applyCreatePhasePreset(preset.phaseNames)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activePhaseTypes.map((phaseType) => {
                  const color = PROJECT_PHASE_COLOR_CLASS[phaseType.color] || PROJECT_PHASE_COLOR_CLASS.teal
                  const checked = selectedPhaseTypeIds.includes(phaseType.id)
                  return (
                    <label
                      key={phaseType.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleCreatePhase(phaseType.id, value === true)}
                      />
                      <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                      <span className="font-medium">{phaseType.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate}>
              {t('projects.actions.createProject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Create Client Dialog */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-teal-700" />
              {t('projects.actions.newClient')}
            </DialogTitle>
            <DialogDescription>{t('projects.clientDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                placeholder={t('projects.clientDialog.namePlaceholder')}
                value={newClient.name}
                onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('projects.clientDialog.contact')}</Label>
                <Input
                  placeholder={t('projects.clientDialog.contactPlaceholder')}
                  value={newClient.contactName}
                  onChange={(e) => setNewClient((c) => ({ ...c, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('projects.clientDialog.phone')}</Label>
                <Input
                  placeholder={t('projects.clientDialog.phonePlaceholder')}
                  value={newClient.phone}
                  onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('projects.clientDialog.email')}</Label>
              <Input
                type="email"
                placeholder={t('projects.clientDialog.emailPlaceholder')}
                value={newClient.email}
                onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('projects.clientDialog.address')}</Label>
              <Input
                placeholder={t('projects.clientDialog.addressPlaceholder')}
                value={newClient.address}
                onChange={(e) => setNewClient((c) => ({ ...c, address: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => {
                if (!newClient.name.trim()) {
                  toast.error(t('projects.validation.nameRequired'))
                  return
                }
                createClientMutation.mutate(newClient)
              }}
              disabled={createClientMutation.isPending}
            >
              {createClientMutation.isPending ? t('projects.actions.creating') : t('projects.actions.createClient')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Create Contractor Dialog */}
      <Dialog open={contractorDialogOpen} onOpenChange={setContractorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-teal-700" />
              {t('projects.actions.newContractor')}
            </DialogTitle>
            <DialogDescription>{t('projects.contractorDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t('common.nameRequired')}</Label>
              <Input
                placeholder={t('projects.contractorDialog.namePlaceholder')}
                value={newContractor.name}
                onChange={(e) => setNewContractor((c) => ({ ...c, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('projects.contractorDialog.contact')}</Label>
                <Input
                  placeholder={t('projects.contractorDialog.contactPlaceholder')}
                  value={newContractor.contactName}
                  onChange={(e) => setNewContractor((c) => ({ ...c, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('projects.contractorDialog.phone')}</Label>
                <Input
                  placeholder={t('projects.contractorDialog.phonePlaceholder')}
                  value={newContractor.phone}
                  onChange={(e) => setNewContractor((c) => ({ ...c, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('projects.contractorDialog.email')}</Label>
              <Input
                type="email"
                placeholder={t('projects.contractorDialog.emailPlaceholder')}
                value={newContractor.email}
                onChange={(e) => setNewContractor((c) => ({ ...c, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('projects.contractorDialog.specialty')}</Label>
              <Input
                placeholder={t('projects.contractorDialog.specialtyPlaceholder')}
                value={newContractor.specialty}
                onChange={(e) => setNewContractor((c) => ({ ...c, specialty: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractorDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => {
                if (!newContractor.name.trim()) {
                  toast.error(t('projects.validation.nameRequired'))
                  return
                }
                createContractorMutation.mutate(newContractor)
              }}
              disabled={createContractorMutation.isPending}
            >
              {createContractorMutation.isPending ? t('projects.actions.creating') : t('projects.actions.createContractor')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

type CardAccent = { stripe: string; border: string; opacity: string }

function getCardAccent(status: string, pendingUnits: number): CardAccent {
  if (status === 'cancelled')
    return { stripe: 'bg-rose-400',    border: 'border-l-4 border-l-rose-300',   opacity: 'opacity-70' }
  if (status === 'finished')
    return { stripe: 'bg-emerald-500', border: 'border-l-4 border-l-emerald-400', opacity: '' }
  if (status === 'scheduled')
    return { stripe: 'bg-sky-500',     border: 'border-l-4 border-l-sky-400',     opacity: '' }
  if (pendingUnits > 0 || status === 'in_progress')
    return { stripe: 'bg-amber-400',   border: 'border-l-4 border-l-amber-400',  opacity: '' }
  if (status === 'dispatched')
    return { stripe: 'bg-teal-500',    border: 'border-l-4 border-l-teal-400',   opacity: '' }
  return   { stripe: 'bg-sky-400',    border: 'border-l-4 border-l-sky-400',    opacity: '' }
}

function ProjectCard({
  project,
  recepcionCount,
  onClick,
  onOpenPurchase,
  onOpenRecepcion,
}: {
  project: Project
  recepcionCount: number
  onClick: () => void
  onOpenPurchase: (purchaseId: string) => void
  onOpenRecepcion: () => void
}) {
  const { locale, t } = useI18n()
  const pendingUnits = calcPendingUnits(project)
  const pendingMaterialCount = calcPendingMaterialCount(project)
  const materialTotals = getMaterialProgressTotals(project.materials)
  const plannedBudget = calculatePlannedMaterialBudget(project)
  const accent = getCardAccent(project.status, pendingUnits)
  const activePurchases = (project.purchases || [])
    .filter((purchase) => purchase.status !== 'cancelled')
    .sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''))
  const primaryPurchase = activePurchases[0]

  return (
    <Card
      className={`group relative cursor-pointer overflow-hidden py-0 transition-all duration-150 hover:-translate-y-1 hover:shadow-md ${accent.border} ${accent.opacity}`}
      onClick={onClick}
    >
      {/* Banda de color — identificación de estado de un vistazo */}
      <div className={`h-1.5 w-full ${accent.stripe}`} />

      {/* Pending badge — posicionado tras la banda */}
      {pendingMaterialCount > 0 && (
        <span
          title={t('projects.card.pendingTitle', { count: formatLocaleInteger(locale, pendingMaterialCount) })}
          className="absolute right-3 top-[10px] z-10 flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
        >
          <Bell className="h-3 w-3" />
          {pendingMaterialCount}
        </span>
      )}
      <CardContent className="space-y-2.5 p-3.5">
        {/* Nivel 1: identidad del proyecto */}
        <div className="flex items-start justify-between gap-2 pr-10">
          <div className="min-w-0 flex-1">
            {project.poNumber && (
              <p className="mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-700">
                PO {project.poNumber}
              </p>
            )}
            <h3 className="line-clamp-1 text-sm font-semibold leading-snug">{project.name}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <ProjectStatusBadge status={project.status} />
            {(primaryPurchase || recepcionCount > 0) && (
              <div className="flex max-w-[220px] flex-wrap justify-end gap-1">
                {primaryPurchase ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 rounded-md border-blue-200 bg-blue-50 px-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenPurchase(primaryPurchase.id)
                    }}
                  >
                    <ShoppingBag className="h-3 w-3" />
                    <span>Purchase</span>
                    <span className="max-w-[86px] truncate font-mono">
                      {primaryPurchase.poNumber || primaryPurchase.purchaseCode}
                    </span>
                  </Button>
                ) : null}
                {activePurchases.length > 1 ? (
                  <span className="inline-flex h-6 items-center rounded-md border bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
                    +{formatLocaleInteger(locale, activePurchases.length - 1)}
                  </span>
                ) : null}
                {recepcionCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 rounded-md border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenRecepcion()
                    }}
                  >
                    <Inbox className="h-3 w-3" />
                    <span>Receiving</span>
                    <span className="tabular-nums">{formatLocaleInteger(locale, recepcionCount)}</span>
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Nivel 2: meta info */}
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{project.client.name}</span>
          </div>
          {(project.startDate || project.endDate || project.projectDate) && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {project.startDate && project.endDate
                  ? `${formatDate(locale, project.startDate)} → ${formatDate(locale, project.endDate)}`
                  : project.startDate
                    ? t('projects.card.fromDate', { date: formatDate(locale, project.startDate) })
                    : project.endDate
                      ? t('projects.card.untilDate', { date: formatDate(locale, project.endDate) })
                      : formatDate(locale, project.projectDate)
                }
              </span>
            </div>
          )}
        </div>

        {/* Progreso de materiales */}
        {project.materials.length > 0 && (
          <div className="border-t pt-2">
            <MaterialProgressBar dispatched={materialTotals.dispatched} planned={materialTotals.planned} />
          </div>
        )}

        {/* Nivel 3: metadatos */}
        <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          <span>
            {project.materials.length === 1
              ? t('projects.materials.countOne', { count: formatLocaleInteger(locale, project.materials.length) })
              : t('projects.materials.countOther', { count: formatLocaleInteger(locale, project.materials.length) })}
          </span>
          {plannedBudget > 0 && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(locale, plannedBudget)}
            </span>
          )}
        </div>

        {/* Next Action — tarea pendiente más urgente */}
        {project.tasks && project.tasks.length > 0 && (
          <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 dark:border-amber-800 dark:bg-amber-950/30">
            <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
            <span className="truncate text-[11px] font-medium text-amber-800 dark:text-amber-300">
              {formatProjectTaskSummary(project, project.tasks[0], locale, t)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Detail View ──────────────────────────────────────────────────────────────

interface ProjectDetailViewProps {
  project: Project | undefined
  loading: boolean
  products: Product[]
  clients: { id: string; name: string }[]
  contractors: { id: string; name: string }[]
  templates: MaterialTemplate[]
  warehouses: WarehouseData[]
  phaseTypes: ProjectPhaseType[]
  onBack: () => void
  onUpdateProject: (data: Record<string, unknown>) => void
  onDeleteProject: () => void
  onCancelProject: () => void
  onFinishProject: () => void
  queryClient: ReturnType<typeof useQueryClient>
}

function ProjectDetailView({
  project,
  loading,
  products,
  clients,
  contractors,
  templates,
  warehouses,
  phaseTypes,
  onBack,
  onUpdateProject,
  onDeleteProject,
  onCancelProject,
  onFinishProject,
  queryClient,
}: ProjectDetailViewProps) {
  const { locale, t } = useI18n()
  const openDocumentViewer = useDocumentViewerStore((state) => state.openViewer)
  const openPurchase = useNavigationStore((state) => state.openPurchase)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [addMaterialSignal, setAddMaterialSignal] = useState(0)
  const [activeProjectTab, setActiveProjectTab] = useState('materials')
  const viewerDocuments = useMemo(() => project ? buildProjectViewerDocuments(project, locale, t) : [], [project, locale, t])

  // Workspace split view + UX prefs (header slim/collapsed, list collapsed) — persiste por proyecto
  const splitView = useSplitViewSettings(project?.id || '')

  // Modo "Enfocar plano": colapsa sidebar + lista + header en un click. Estado de sesión, no persiste.
  const [focusMode, setFocusMode] = useState(false)
  const focusRestoreRef = useRef<{
    listCollapsed: boolean
    headerCollapsed: boolean
    sidebarOpen: boolean
  } | null>(null)

  // Auto-colapsar sidebar al activar split mode; restaurar al desactivar
  const { setOpen: setSidebarOpen, open: sidebarOpen } = useSidebar()
  const prevSidebarOpenRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (splitView.enabled) {
      if (prevSidebarOpenRef.current === null) {
        prevSidebarOpenRef.current = sidebarOpen
      }
      setSidebarOpen(false)
    } else if (prevSidebarOpenRef.current !== null) {
      setSidebarOpen(prevSidebarOpenRef.current)
      prevSidebarOpenRef.current = null
    }

    return () => {
      if (splitView.enabled && prevSidebarOpenRef.current !== null) {
        setSidebarOpen(prevSidebarOpenRef.current)
        prevSidebarOpenRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitView.enabled, setSidebarOpen])

  const toggleFocusMode = useCallback(() => {
    if (focusMode) {
      // Restaurar
      if (focusRestoreRef.current) {
        splitView.setListCollapsed(focusRestoreRef.current.listCollapsed)
        splitView.setHeaderCollapsed(focusRestoreRef.current.headerCollapsed)
        setSidebarOpen(focusRestoreRef.current.sidebarOpen)
        focusRestoreRef.current = null
      }
      setFocusMode(false)
    } else {
      // Guardar y colapsar todo
      focusRestoreRef.current = {
        listCollapsed: splitView.listCollapsed,
        headerCollapsed: splitView.headerCollapsed,
        sidebarOpen,
      }
      splitView.setListCollapsed(true)
      splitView.setHeaderCollapsed(true)
      setSidebarOpen(false)
      setFocusMode(true)
    }
  }, [focusMode, splitView, sidebarOpen, setSidebarOpen])

  // Atajos de teclado: [ lista · ] header · f enfoque (solo cuando no escribiendo en un input)
  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '[') {
        if (splitView.enabled) splitView.setListCollapsed(!splitView.listCollapsed)
      } else if (e.key === ']') {
        splitView.setHeaderCollapsed(!splitView.headerCollapsed)
      } else if (e.key === 'f' || e.key === 'F') {
        if (splitView.enabled) toggleFocusMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [splitView, toggleFocusMode])

  useEffect(() => {
    if (!splitView.enabled && focusMode) {
      focusRestoreRef.current = null
      setFocusMode(false)
    }
  }, [splitView.enabled, focusMode])

  if (loading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const materialTotals = getMaterialProgressTotals(project.materials)
  const progress = materialTotals.progress
  const totalPlanned = materialTotals.planned
  const totalDispatched = materialTotals.dispatched
  const canCancel = !['finished', 'cancelled'].includes(project.status)
  const canFinish = project.status === 'dispatched'
  const isPostDispatch = project.status === 'finished' || project.status === 'cancelled'
  const activePurchases = (project.purchases || [])
    .filter((purchase) => purchase.status !== 'cancelled')
    .sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''))
  const { plannedBudget: headerPlannedBudget, totalExpense: headerTotalExpense } = getProjectBudgetStats(project)
  const headerBudgetText = `Gasto ${formatCurrency(locale, headerTotalExpense)} / Presupuesto ${formatCurrency(locale, headerPlannedBudget)}`
  const materialProgressText = totalPlanned > 0
    ? `${formatLocaleInteger(locale, totalDispatched)} / ${formatLocaleInteger(locale, totalPlanned)} unidades`
    : 'Sin materiales'
  const materialProgressMini = (
    <div className="w-[260px] max-w-[28vw] text-center">
      <div className="mb-0.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-teal-700">
        <span>Materiales</span>
        <span>{progress}%</span>
        <span className="font-medium text-muted-foreground">-</span>
        <span className="font-medium tabular-nums text-teal-700">{materialProgressText}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-teal-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-6 text-left text-[10px] tabular-nums text-muted-foreground">{progress}%</span>
      </div>
    </div>
  )
  const detailZoomStyle = splitView.enabled ? undefined : { zoom: 0.9 }

  const openPlanViewer = () => {
    if (viewerDocuments.length === 0) {
      toast.error(t('projects.plan.emptyDescription'))
      return
    }

    openDocumentViewer({
      documents: viewerDocuments,
      initialPanel: 'info',
      contextTitle: t('projects.viewer.contextTitle', { name: project.name }),
      contextPath: [t('projects.viewer.inventorySection'), t('navigation.page.projects'), project.name, t('projects.tabs.documents')],
    })
  }

  const openProjectTab = (tab: string) => {
    if (tab !== 'materials' && splitView.enabled) {
      splitView.setEnabled(false)
    }
    setActiveProjectTab(tab)
  }

  const projectSectionMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <FolderKanban className="h-3.5 w-3.5" />
          Proyecto
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Secciones</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openProjectTab('info')}>
          <ClipboardList className="mr-2 h-4 w-4" />
          {t('projects.tabs.info')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openProjectTab('materials')}>
          <Package className="mr-2 h-4 w-4" />
          {t('projects.tabs.materials')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openProjectTab('phases')}>
          <Layers className="mr-2 h-4 w-4" />
          Fases
        </DropdownMenuItem>
        {!isPostDispatch && (
          <DropdownMenuItem onSelect={() => openProjectTab('dispatches')}>
            <Truck className="mr-2 h-4 w-4" />
            {t('projects.tabs.dispatches')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => openProjectTab('returns')}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {t('projects.tabs.returns')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openProjectTab('documents')}>
          <FileText className="mr-2 h-4 w-4" />
          {t('projects.tabs.documents')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openProjectTab('notes')}>
          <StickyNote className="mr-2 h-4 w-4" />
          Notas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openProjectTab('expenses')}>
          <Receipt className="mr-2 h-4 w-4" />
          {t('projects.tabs.expenses')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setAddMaterialSignal((value) => value + 1)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('projects.actions.addMaterial')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openPlanViewer}>
          <Eye className="mr-2 h-4 w-4" />
          {t('projects.actions.showPlan')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className={splitView.enabled ? 'space-y-2' : 'space-y-6'} style={detailZoomStyle}>
      {splitView.headerCollapsed ? (
        <div className="sticky top-2 z-30 flex min-h-7 items-center gap-2 rounded-md border bg-card/95 px-2 py-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-6 w-6 shrink-0" title="Volver">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold leading-none">{project.name}</div>
          </div>
          {splitView.enabled && projectSectionMenu}
          <ProjectPendingsPad projectId={project.id} projectMaterials={project.materials} slim />
          <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{project.client.name}</span>
          <span className="hidden text-[11px] font-semibold tabular-nums text-teal-700 md:inline">
            Materiales {progress}%
          </span>
          {splitView.enabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => splitView.setListCollapsed(!splitView.listCollapsed)}
              className="h-6 w-6 shrink-0"
              title={splitView.listCollapsed ? 'Mostrar materiales' : 'Colapsar materiales'}
            >
              <Layers className="h-3.5 w-3.5" />
            </Button>
          )}
          {splitView.enabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => splitView.setEnabled(false)}
              className="h-6 w-6 shrink-0"
              title="Cerrar Plano + Lista"
            >
              <Columns2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {splitView.enabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFocusMode}
              className="h-6 w-6 shrink-0"
              title={focusMode ? 'Salir de modo enfocado' : 'Enfocar plano'}
            >
              {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => splitView.setHeaderCollapsed(false)}
            className="h-6 w-6 shrink-0"
            title="Mostrar header del proyecto"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : splitView.enabled ? (
        <div className="sticky top-2 z-30 rounded-lg border bg-card/95 px-2 py-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="outline" size="icon" onClick={onBack} className="h-8 w-8 shrink-0" title="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                {project.poNumber && (
                  <span className="hidden rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teal-800 sm:inline-flex">
                    PO {project.poNumber}
                  </span>
                )}
                <h1 className="truncate text-base font-semibold leading-tight">{project.name}</h1>
                <ProjectStatusPicker
                  status={project.status}
                  onChange={(newStatus) => onUpdateProject({ status: newStatus })}
                  hasStartDate={Boolean(project.startDate)}
                  hasMaterials={project.materials.length > 0}
                />
                {projectSectionMenu}
                <ProjectPendingsPad projectId={project.id} projectMaterials={project.materials} slim />
              </div>
              <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{project.client.name}</span>
                <span className="hidden shrink-0 tabular-nums md:inline">{headerBudgetText}</span>
              </div>
            </div>
            <div className="hidden shrink-0 justify-center xl:flex">
              {materialProgressMini}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant={splitView.listCollapsed ? 'default' : 'outline'}
                size="icon"
                onClick={() => splitView.setListCollapsed(!splitView.listCollapsed)}
                className={`h-8 w-8 ${splitView.listCollapsed ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                title={splitView.listCollapsed ? 'Mostrar materiales' : 'Colapsar materiales'}
              >
                <Layers className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => splitView.setEnabled(false)}
                className="h-8 w-8"
                title="Cerrar Plano + Lista"
              >
                <Columns2 className="h-4 w-4" />
              </Button>
              <Button
                variant={focusMode ? 'default' : 'outline'}
                size="icon"
                onClick={toggleFocusMode}
                className={`h-8 w-8 ${focusMode ? 'bg-cyan-700 text-white hover:bg-cyan-800' : ''}`}
                title={focusMode ? 'Salir de modo enfocado' : 'Enfocar plano'}
              >
                {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {activePurchases.slice(0, 1).map((purchase) => (
                <Button
                  key={purchase.id}
                  variant="outline"
                  size="icon"
                  onClick={() => openPurchase(purchase.id)}
                  className="h-8 w-8 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                  title={`Purchase ${purchase.poNumber || purchase.purchaseCode}`}
                >
                  <ShoppingBag className="h-4 w-4" />
                </Button>
              ))}
              <Button
                size="icon"
                onClick={() => setAddMaterialSignal((value) => value + 1)}
                className="h-8 w-8 bg-amber-600 text-white hover:bg-amber-700"
                title={t('projects.actions.addMaterial')}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={openPlanViewer} className="h-8 w-8" title={t('projects.actions.showPlan')}>
                <Eye className="h-4 w-4" />
              </Button>
              {canCancel && (
                <Button variant="ghost" size="icon" onClick={() => setCancelOpen(true)} className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700" title={t('projects.actions.cancelProject')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => splitView.setHeaderCollapsed(true)}
                className="h-8 w-8"
                title="Colapsar header"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="sticky top-2 z-30 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="outline" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {project.poNumber && (
                  <span className="rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-teal-800">
                    PO {project.poNumber}
                  </span>
                )}
                {project.projectType && (
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
                    {project.projectType}
                  </span>
                )}
                <ProjectStatusPicker
                  status={project.status}
                  onChange={(newStatus) => onUpdateProject({ status: newStatus })}
                  hasStartDate={Boolean(project.startDate)}
                  hasMaterials={project.materials.length > 0}
                />
                {project.color && (
                  <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
                    project.color === 'Blanco'
                      ? 'border-slate-300 bg-slate-50 text-slate-700'
                      : 'border-amber-400 bg-amber-50 text-amber-800'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${project.color === 'Blanco' ? 'bg-slate-300 border border-slate-400' : 'bg-amber-500'}`} />
                    {getProjectColorLabel(project.color, t)}
                  </span>
                )}
              </div>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">{project.name}</h1>
              <p className="text-xs text-muted-foreground">{project.client.name}</p>
            </div>
          </div>
          <div className="flex justify-center">
            <HeaderBudgetSummary project={project} />
          </div>
          <div className="flex items-center gap-2 flex-wrap xl:justify-end">
              {projectSectionMenu}
              <ProjectPendingsPad projectId={project.id} projectMaterials={project.materials} />
              {activePurchases.map((purchase) => (
                <Button
                  key={purchase.id}
                  variant="outline"
                  size="sm"
                  onClick={() => openPurchase(purchase.id)}
                  className="gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Purchase {purchase.poNumber || purchase.purchaseCode}
                </Button>
              ))}
              <Button
                size="sm"
                onClick={() => setAddMaterialSignal((value) => value + 1)}
                className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
              >
                <Plus className="h-4 w-4" />
                {t('projects.actions.addMaterial')}
              </Button>
              <Button variant="outline" size="sm" onClick={openPlanViewer} className="gap-2">
                <Eye className="h-4 w-4" />
                {t('projects.actions.showPlan')}
              </Button>
              {canCancel && (
                <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)} className="gap-2">
                  <X className="h-4 w-4" />
                  {t('projects.actions.cancelProject')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => splitView.setHeaderCollapsed(true)}
                className="h-8 w-8"
                title="Colapsar header"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
          </div>
        </div>
        </div>
            )}

      {/* Tabs — Despachos se oculta solo cuando el proyecto está finalizado o cancelado */}
      {(() => {
        return (
          <Tabs value={activeProjectTab} onValueChange={setActiveProjectTab} className={splitView.enabled ? 'space-y-1' : 'space-y-3'}>
            <TabsContent value="info">
              <InfoTab
                project={project}
                clients={clients}
                contractors={contractors}
                onUpdateProject={onUpdateProject}
                onCancelProject={() => setCancelOpen(true)}
                onFinishProject={onFinishProject}
                onDeleteProject={() => setDeleteOpen(true)}
                onOpenPurchase={openPurchase}
                canCancel={canCancel}
                canFinish={canFinish}
              />
            </TabsContent>

            <TabsContent value="materials" className={splitView.enabled ? 'mt-0' : undefined}>
              <MaterialsTab
                project={project}
                products={products}
                templates={templates}
                queryClient={queryClient}
                warehouses={warehouses}
                openAddSignal={addMaterialSignal}
                splitView={splitView}
                focusMode={focusMode}
                onToggleFocusMode={toggleFocusMode}
              />
            </TabsContent>

            <TabsContent value="phases">
              <ProjectPhasesTab
                project={project}
                phaseTypes={phaseTypes}
                queryClient={queryClient}
                onFinishProject={onFinishProject}
              />
            </TabsContent>

            {!isPostDispatch && (
              <TabsContent value="dispatches">
                <DispatchesTab project={project} products={products} warehouses={warehouses} queryClient={queryClient} />
              </TabsContent>
            )}

            <TabsContent value="returns">
              <ReturnsTab project={project} queryClient={queryClient} warehouses={warehouses} />
            </TabsContent>

            <TabsContent value="documents">
              <DocumentsTab project={project} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="notes">
              <ProjectNotesFeed projectId={project.id} projectName={project.name} />
            </TabsContent>

            <TabsContent value="expenses">
              <ProjectExpensesTab projectId={project.id} />
            </TabsContent>
          </Tabs>
        )
      })()}

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              {t('projects.actions.cancelProject')}
            </DialogTitle>
            <DialogDescription>{t('projects.cancelDialog.intro')}</DialogDescription>
          </DialogHeader>
          {/* Consecuencias — con peso visual propio, no enterradas en muted */}
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-3 dark:bg-rose-950/20 dark:border-rose-800/40">
            <ul className="space-y-2 text-sm text-rose-800 dark:text-rose-300">
              {[
                t('projects.cancelDialog.pendingReturn'),
                t('projects.cancelDialog.statusCancelled'),
                t('projects.cancelDialog.pendingOrders'),
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="border-t border-rose-200 pt-3 dark:border-rose-800/40">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                {t('projects.cancelDialog.warning')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{t('projects.actions.back')}</Button>
            <Button variant="destructive" onClick={() => { onCancelProject(); setCancelOpen(false) }}>
              {t('projects.actions.confirmCancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => { onDeleteProject(); setDeleteOpen(false) }}
        title={t('projects.confirm.deleteTitle')}
        description={t('projects.confirm.deleteDescription', { name: project.name })}
      />
    </div>
  )
}

function getPhaseStatusLabel(status: string) {
  if (status === 'completed') return 'Completada'
  if (status === 'in_progress') return 'En progreso'
  return 'Pendiente'
}

function getPhaseStatusClass(status: string) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (status === 'in_progress') return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
}

function ProjectPhasesTab({
  project,
  phaseTypes,
  queryClient,
  onFinishProject,
}: {
  project: Project
  phaseTypes: ProjectPhaseType[]
  queryClient: ReturnType<typeof useQueryClient>
  onFinishProject: () => void
}) {
  const { locale } = useI18n()
  const activeTypes = phaseTypes.filter((type) => type.active)
  const phases = project.phases || []
  const [phaseTypeId, setPhaseTypeId] = useState(activeTypes[0]?.id || '')
  const [startDate, setStartDate] = useState(project.startDate || project.projectDate || '')
  const [endDate, setEndDate] = useState(project.endDate || project.startDate || project.projectDate || '')

  useEffect(() => {
    if (!phaseTypeId && activeTypes[0]?.id) setPhaseTypeId(activeTypes[0].id)
  }, [activeTypes, phaseTypeId])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['project'] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['calendar-projects'] })
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phaseTypeId,
          startDate,
          endDate: endDate || startDate,
          sortOrder: phases.length,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'No se pudo crear la fase')
      return payload
    },
    onSuccess: () => {
      invalidate()
      toast.success('Fase creada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ phase, data }: { phase: ProjectPhase; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/projects/${project.id}/phases/${phase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'No se pudo actualizar la fase')
      return payload
    },
    onSuccess: () => {
      invalidate()
      toast.success('Fase actualizada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (phase: ProjectPhase) => {
      const res = await fetch(`/api/projects/${project.id}/phases/${phase.id}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'No se pudo eliminar la fase')
      return payload
    },
    onSuccess: () => {
      invalidate()
      toast.success('Fase eliminada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const allComplete = phases.length > 0 && phases.every((phase) => phase.status === 'completed')
  const canSuggestFinish = allComplete && !['finished', 'cancelled'].includes(project.status)

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-4">
        {canSuggestFinish ? (
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Todas las fases estan completadas</p>
              <p className="text-xs text-emerald-700">Puedes finalizar el proyecto usando el flujo existente.</p>
            </div>
            <Button size="sm" onClick={onFinishProject} className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Check className="mr-2 h-4 w-4" />
              Finalizar proyecto
            </Button>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 lg:grid-cols-[1fr_150px_150px_auto]">
          <Select value={phaseTypeId} onValueChange={setPhaseTypeId}>
            <SelectTrigger><SelectValue placeholder="Tipo de fase" /></SelectTrigger>
            <SelectContent>
              {activeTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!phaseTypeId || !startDate || createMutation.isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>

        {phases.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Sin fases"
            description="Agrega las fases operativas para verlas en el calendario."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fase</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phases.map((phase) => {
                  const color = PROJECT_PHASE_COLOR_CLASS[phase.phaseType.color] || PROJECT_PHASE_COLOR_CLASS.teal
                  return (
                    <TableRow key={phase.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                          {phase.phaseType.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={phase.startDate}
                          className="h-8 w-36"
                          onChange={(event) => updateMutation.mutate({ phase, data: { startDate: event.target.value } })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={phase.endDate}
                          className="h-8 w-36"
                          onChange={(event) => updateMutation.mutate({ phase, data: { endDate: event.target.value } })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={phase.status}
                          onValueChange={(status) => updateMutation.mutate({ phase, data: { status } })}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="in_progress">En progreso</SelectItem>
                            <SelectItem value="completed">Completada</SelectItem>
                          </SelectContent>
                        </Select>
                        {phase.completedAt ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDate(locale, phase.completedAt)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Badge variant="secondary" className={getPhaseStatusClass(phase.status)}>
                            {getPhaseStatusLabel(phase.status)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(phase)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
  )
}

// ─── Budget Card ──────────────────────────────────────────────────────────────

function MissingPriceMaterialsDialog({
  open,
  onOpenChange,
  materials,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: ProjectMaterial[]
}) {
  const { locale } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Items without reference price</DialogTitle>
          <DialogDescription>
            These planned materials are not included in the calculated budget until a reference price is set.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {materials.map((material) => (
            <div key={material.id} className="rounded-md border px-3 py-2">
              <p className="text-sm font-medium">{material.product.name}</p>
              <p className="text-xs text-muted-foreground">
                {material.product.code} · Planned {formatLocaleInteger(locale, material.plannedQuantity)}
                {material.engineeringSection ? ` · ${material.engineeringSection}` : ''}
              </p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HeaderBudgetSummary({ project }: { project: Project }) {
  const { locale, t } = useI18n()
  const [missingPricesOpen, setMissingPricesOpen] = useState(false)
  const {
    plannedBudget,
    totalExpense,
    missingPriceMaterials,
    missingPriceCount,
    remaining,
    usagePercent,
  } = getProjectBudgetStats(project)

  return (
    <div className="w-full min-w-0 xl:w-[460px]">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          {t('projects.budget.title')}
        </div>
        <span className="text-base font-semibold tabular-nums">{formatCurrency(locale, plannedBudget)}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('projects.budget.totalExpense')}</span>
          <span className="font-medium tabular-nums">{formatCurrency(locale, totalExpense)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('projects.budget.remaining')}</span>
          <span className={`font-medium tabular-nums ${remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatCurrency(locale, remaining)}
          </span>
        </div>
      </div>
      {plannedBudget > 0 && (
        <div className="mt-1 flex items-center gap-2">
          <Progress value={usagePercent} className="h-1 flex-1 [&>div]:bg-teal-600" />
          <span className="text-[11px] text-muted-foreground tabular-nums">{usagePercent}%</span>
        </div>
      )}
      {missingPriceCount > 0 && (
        <button
          type="button"
          className="mt-0.5 block w-full text-center text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
          onClick={() => setMissingPricesOpen(true)}
        >
          {formatLocaleInteger(locale, missingPriceCount)} planned item(s) have no reference price.
        </button>
      )}
      <MissingPriceMaterialsDialog
        open={missingPricesOpen}
        onOpenChange={setMissingPricesOpen}
        materials={missingPriceMaterials}
      />
    </div>
  )
}

function BudgetCard({ project }: { project: Project; onUpdateProject: (data: Record<string, unknown>) => void }) {
  const { locale, t } = useI18n()
  const [missingPricesOpen, setMissingPricesOpen] = useState(false)
  const {
    plannedBudget,
    dispatchedExpense,
    returnedCredit,
    totalExpense,
    missingPriceMaterials,
    missingPriceCount,
    remaining,
    usagePercent,
  } = getProjectBudgetStats(project)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {t('projects.budget.title')}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-2xl font-semibold text-foreground">{formatCurrency(locale, plannedBudget)}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('projects.budget.totalExpense')}</span>
              <span className="font-medium">{formatCurrency(locale, totalExpense)}</span>
            </div>
            {returnedCredit > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-800">Dispatched before returns</span>
                  <span className="font-medium text-emerald-900">{formatCurrency(locale, dispatchedExpense)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-emerald-800">Confirmed returns deducted</span>
                  <span className="font-medium text-emerald-900">-{formatCurrency(locale, returnedCredit)}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('projects.budget.remaining')}</span>
              <span className={`font-medium ${remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(locale, remaining)}
              </span>
            </div>
            {plannedBudget > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Progress value={usagePercent} className="h-2 flex-1 [&>div]:bg-teal-600" />
                <span className="text-xs text-muted-foreground tabular-nums">{usagePercent}%</span>
              </div>
            )}
            {missingPriceCount > 0 && (
              <button
                type="button"
                className="text-left text-[11px] font-medium text-amber-700 underline-offset-2 hover:underline"
                onClick={() => setMissingPricesOpen(true)}
              >
                {formatLocaleInteger(locale, missingPriceCount)} planned item(s) have no reference price.
              </button>
            )}
          </div>
        </div>
      </CardContent>
      <Dialog open={missingPricesOpen} onOpenChange={setMissingPricesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Items without reference price</DialogTitle>
            <DialogDescription>
              These planned materials are not included in the calculated budget until a reference price is set.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {missingPriceMaterials.map((material) => (
              <div key={material.id} className="rounded-md border px-3 py-2">
                <p className="text-sm font-medium">{material.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {material.product.code} · Planned {formatLocaleInteger(locale, material.plannedQuantity)}
                  {material.engineeringSection ? ` · ${material.engineeringSection}` : ''}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingPricesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────

function InfoTab({
  project,
  clients,
  contractors,
  onUpdateProject,
  onCancelProject,
  onFinishProject,
  onDeleteProject,
  onOpenPurchase,
  canCancel,
  canFinish,
}: {
  project: Project
  clients: { id: string; name: string }[]
  contractors: { id: string; name: string }[]
  onUpdateProject: (data: Record<string, unknown>) => void
  onCancelProject: () => void
  onFinishProject: () => void
  onDeleteProject: () => void
  onOpenPurchase: (purchaseId: string) => void
  canCancel: boolean
  canFinish: boolean
}) {
  const { locale, t } = useI18n()
  const [editName, setEditName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editPo, setEditPo] = useState(false)
  const [poInput, setPoInput] = useState('')
  const [editProjectType, setEditProjectType] = useState(false)
  const [projectTypeInput, setProjectTypeInput] = useState('')
  const [editContractor, setEditContractor] = useState(false)
  const [contractorInput, setContractorInput] = useState('none')
  const [editStartDate, setEditStartDate] = useState(false)
  const [startDateInput, setStartDateInput] = useState('')
  const [startDateCalendarOpen, setStartDateCalendarOpen] = useState(false)
  const [editEndDate, setEditEndDate] = useState(false)
  const [endDateCalendarOpen, setEndDateCalendarOpen] = useState(false)
  const [endDateInput, setEndDateInput] = useState('')
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState(project.status)
  const statusOptions = useMemo(() => getStatusOptions(t), [t])

  const startEditName = () => {
    setNameInput(project.name)
    setEditName(true)
  }

  const startEditPo = () => {
    setPoInput(project.poNumber || '')
    setEditPo(true)
  }

  const startEditProjectType = () => {
    setProjectTypeInput(project.projectType || '')
    setEditProjectType(true)
  }

  const startEditContractor = () => {
    setContractorInput(project.contractor?.id || 'none')
    setEditContractor(true)
  }

  const startEditStartDate = () => {
    setStartDateInput(project.startDate || '')
    setEditStartDate(true)
  }

  const startEditEndDate = () => {
    setEndDateInput(project.endDate || '')
    setEditEndDate(true)
  }

  const handleStatusChange = () => {
    if (newStatus === 'scheduled') {
      const hasDate = Boolean(project.startDate)
      const hasMaterials = project.materials.length > 0

      if (!hasDate || !hasMaterials) {
        toast.error(
          !hasDate && !hasMaterials
            ? 'Scheduled projects need a start date and materials list'
            : !hasDate
              ? 'Scheduled projects need a start date'
              : 'Scheduled projects need a materials list'
        )
        return
      }
    }
    onUpdateProject({ status: newStatus })
    setStatusDialogOpen(false)
  }

  return (
    <Card className="shadow-none">
      <CardContent className="p-6 space-y-5">

        {/* ── Acciones — siempre visibles al tope ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <ProjectStatusBadge status={project.status} />
          </div>
          {!['finished', 'cancelled'].includes(project.status) && (
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(project.status); setStatusDialogOpen(true) }} className="gap-2">
              <Edit3 className="h-3.5 w-3.5" />
              {t('projects.actions.changeStatus')}
            </Button>
          )}
          {project.dispatches.length > 0 && (
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a href={`/api/projects/${project.id}/invoice-pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                {t('projects.actions.downloadInvoice')}
              </a>
            </Button>
          )}
          {(project.purchases || []).map((purchase) => (
            <Button
              key={purchase.id}
              variant="outline"
              size="sm"
              onClick={() => onOpenPurchase(purchase.id)}
              className="gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Purchase {purchase.purchaseCode}
            </Button>
          ))}
          {canFinish && (
            <Button size="sm" onClick={onFinishProject} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="h-3.5 w-3.5" />
              {t('projects.actions.finishProject')}
            </Button>
          )}
          {['finished', 'cancelled'].includes(project.status) && (
            <Button variant="destructive" size="sm" onClick={onDeleteProject} className="gap-2">
              <Trash2 className="h-3.5 w-3.5" />
              {t('projects.actions.deleteProject')}
            </Button>
          )}
        </div>

        <Separator />

        {/* ── Nombre y PO en grid ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('projects.fields.projectName')}</Label>
            {editName ? (
              <div className="flex items-center gap-2">
                <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                <Button size="sm" onClick={() => { onUpdateProject({ name: nameInput }); setEditName(false) }} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditName(false)} className="h-8 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold">{project.name}</p>
                <Button variant="ghost" size="sm" onClick={startEditName} className="h-7 w-7 p-0 shrink-0">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('projects.fields.color')}</Label>
            <div className="flex gap-2">
              {['Blanco', 'Bronze'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdateProject({ color: project.color === c ? '' : c })}
                  className={`flex-1 rounded-md border-2 py-1.5 px-2 text-xs font-medium transition-all ${
                    project.color === c
                      ? c === 'Blanco'
                        ? 'border-slate-400 bg-slate-50 text-slate-900 ring-2 ring-slate-300'
                        : 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-300'
                      : 'border-border bg-background text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle ${c === 'Blanco' ? 'bg-slate-200 border border-slate-400' : 'bg-amber-600'}`} />
                  {getProjectColorLabel(c, t)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('projects.fields.po')}</Label>
            {editPo ? (
              <div className="flex items-center gap-2">
                <Input value={poInput} onChange={(e) => setPoInput(e.target.value)} placeholder={t('projects.fields.poPlaceholder')} />
                <Button size="sm" onClick={() => { onUpdateProject({ poNumber: poInput }); setEditPo(false) }} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditPo(false)} className="h-8 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {project.poNumber ? (
                  <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200 font-mono">
                    {project.poNumber}
                  </Badge>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t('projects.fields.noPo')}</p>
                )}
                <Button variant="ghost" size="sm" onClick={startEditPo} className="h-7 w-7 p-0 shrink-0">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('projects.fields.projectType')}</Label>
            {editProjectType ? (
              <div className="flex items-center gap-2">
                <Input
                  value={projectTypeInput}
                  onChange={(e) => setProjectTypeInput(e.target.value)}
                  placeholder={t('projects.fields.projectTypePlaceholder')}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    onUpdateProject({ projectType: projectTypeInput.trim() })
                    setEditProjectType(false)
                  }}
                  className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditProjectType(false)} className="h-8 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {project.projectType ? (
                  <Badge variant="secondary">{project.projectType}</Badge>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t('projects.fields.projectTypeEmpty')}</p>
                )}
                <Button variant="ghost" size="sm" onClick={startEditProjectType} className="h-7 w-7 p-0 shrink-0">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Detalles ── */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {t('projects.fields.client')}
            </Label>
            <div className="rounded-md bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-base font-semibold leading-tight">{project.client.name}</p>
                {project.client.contactName ? (
                  <p className="text-sm text-muted-foreground">{project.client.contactName}</p>
                ) : null}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="leading-relaxed text-foreground">{project.client.address || 'No address'}</span>
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{project.client.phone || 'No phone'}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{project.client.email || 'No email'}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <HardHat className="h-3.5 w-3.5" /> {t('projects.fields.contractor')}
              </Label>
              {editContractor ? (
                <div className="flex items-center gap-2">
                  <Select value={contractorInput} onValueChange={setContractorInput}>
                    <SelectTrigger className="h-8 min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('projects.fields.noContractor')}</SelectItem>
                      {contractors.map((contractor) => (
                        <SelectItem key={contractor.id} value={contractor.id}>
                          {contractor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      onUpdateProject({ contractorId: contractorInput === 'none' ? null : contractorInput })
                      setEditContractor(false)
                    }}
                    className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditContractor(false)} className="h-8 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{project.contractor?.name || '-'}</p>
                  <Button variant="ghost" size="sm" onClick={startEditContractor} className="h-7 w-7 p-0 shrink-0">
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {t('projects.fields.createdAt')}
              </Label>
              <p className="text-sm font-medium">{formatDate(locale, project.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {t('projects.fields.projectDate')}
              </Label>
              <p className="text-sm font-medium">{formatDate(locale, project.projectDate)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {t('projects.fields.startDate')}
              </Label>
              {editStartDate ? (
                <div className="flex items-center gap-2">
                  <Popover open={startDateCalendarOpen} onOpenChange={setStartDateCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 flex-1 justify-start gap-2 font-normal text-sm"
                      >
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        {startDateInput ? formatDate(locale, startDateInput) : t('projects.fields.selectStartDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseDateValue(startDateInput)}
                        defaultMonth={parseDateValue(startDateInput) || parseDateValue(project.startDate || '')}
                        onSelect={(date) => {
                          if (!date) return
                          setStartDateInput(toDateValue(date))
                          setStartDateCalendarOpen(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    onClick={() => {
                      onUpdateProject({
                        startDate: startDateInput || null,
                        projectDate: startDateInput || project.projectDate,
                        ...(startDateInput && project.endDate && project.endDate < startDateInput
                          ? { endDate: startDateInput }
                          : {}),
                      })
                      setEditStartDate(false)
                    }}
                    className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditStartDate(false)} className="h-8 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {project.startDate ? formatDate(locale, project.startDate) : '-'}
                  </p>
                  <Button variant="ghost" size="sm" onClick={startEditStartDate} className="h-7 w-7 p-0 shrink-0">
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {t('projects.fields.endDate')}
              </Label>
              {editEndDate ? (
                <div className="flex items-center gap-2">
                  <Popover open={endDateCalendarOpen} onOpenChange={setEndDateCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 flex-1 justify-start gap-2 font-normal text-sm"
                      >
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        {endDateInput ? formatDate(locale, endDateInput) : t('projects.fields.selectEndDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseDateValue(endDateInput)}
                        defaultMonth={parseDateValue(endDateInput) || parseDateValue(project.startDate || '') || parseDateValue(project.endDate || '')}
                        disabled={project.startDate ? { before: parseDateValue(project.startDate)! } : undefined}
                        onSelect={(date) => {
                          if (!date) return
                          setEndDateInput(toDateValue(date))
                          setEndDateCalendarOpen(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (endDateInput && project.startDate && endDateInput < project.startDate) {
                        toast.error(t('projects.fields.endDateAfterStart'))
                        return
                      }

                      onUpdateProject({ endDate: endDateInput || null })
                      setEditEndDate(false)
                    }}
                    className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditEndDate(false)} className="h-8 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{project.endDate ? formatDate(locale, project.endDate) : '-'}</p>
                  <Button variant="ghost" size="sm" onClick={startEditEndDate} className="h-7 w-7 p-0 shrink-0">
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

      </CardContent>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('projects.actions.changeStatus')}</DialogTitle>
            <DialogDescription>{t('projects.statusDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Estado actual como referencia visual */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actual</span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.filter((s) => s.value !== project.status).map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleStatusChange}>{t('common.saveChanges')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ─── Materials Tab ────────────────────────────────────────────────────────────

function normalizeSwitchText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function dimensionsMatch(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => Math.abs(value - b[index]) < 0.0001)
}

function getProfileDimensions(dimensions: number[]): number[] {
  return dimensions.length > 1 ? dimensions.slice(0, -1) : []
}

function getFinalDimension(dimensions: number[]): number | null {
  return dimensions.length > 0 ? dimensions[dimensions.length - 1] : null
}

function getSwitchProductRank(currentProduct: Product, currentSection: string, candidate: Product): number {
  const currentBase = getProductFamily(currentProduct.name)
  const candidateBase = getProductFamily(candidate.name)
  const sameBase = Boolean(currentBase && candidateBase && currentBase === candidateBase)
  const currentDimensions = extractDimensions(currentProduct.name)
  const candidateDimensions = extractDimensions(candidate.name)
  const currentProfile = getProfileDimensions(currentDimensions)
  const candidateProfile = getProfileDimensions(candidateDimensions)
  const currentLength = getFinalDimension(currentDimensions)
  const candidateLength = getFinalDimension(candidateDimensions)
  const sameProfileWithDifferentLength =
    currentProfile.length > 0 &&
    dimensionsMatch(currentProfile, candidateProfile) &&
    currentLength !== null &&
    candidateLength !== null &&
    Math.abs(currentLength - candidateLength) > 0.0001

  if (sameProfileWithDifferentLength && (sameBase || !currentBase || !candidateBase)) {
    return 0
  }

  if (sameBase) {
    return 1
  }

  const currentCatalogFamily = normalizeSwitchText(currentProduct.family)
  const candidateCatalogFamily = normalizeSwitchText(candidate.family)
  const currentEngineeringSection = normalizeSwitchText(currentSection || currentProduct.engineeringSection)
  const candidateEngineeringSection = normalizeSwitchText(candidate.engineeringSection)

  if (
    currentCatalogFamily &&
    currentCatalogFamily === candidateCatalogFamily &&
    currentEngineeringSection &&
    currentEngineeringSection === candidateEngineeringSection
  ) {
    return 2
  }

  return 3
}

function compareSwitchBySection(section: string, aName: string, bName: string): number {
  if (section === 'Structural Frame') return compareStructuralFrameMaterials(aName, bName)
  if (section === 'Fasteners & Hardware') return compareFastenerMaterials(aName, bName)

  const aFamily = getProductFamily(aName)
  const bFamily = getProductFamily(bName)
  if (aFamily !== bFamily) return aFamily.localeCompare(bFamily)

  return compareMaterialsByDimensions(aName, bName)
}

function compareSameProfileSwitchOptions(currentProduct: Product, a: Product, b: Product): number {
  const currentLength = getFinalDimension(extractDimensions(currentProduct.name))
  const aLength = getFinalDimension(extractDimensions(a.name))
  const bLength = getFinalDimension(extractDimensions(b.name))

  if (currentLength !== null && aLength !== null && bLength !== null) {
    const distanceDiff = Math.abs(aLength - currentLength) - Math.abs(bLength - currentLength)
    if (distanceDiff !== 0) return distanceDiff

    const aIsLonger = aLength >= currentLength
    const bIsLonger = bLength >= currentLength
    if (aIsLonger !== bIsLonger) return aIsLonger ? -1 : 1
  }

  return a.name.localeCompare(b.name)
}

function compareSwitchProductOptions(currentProduct: Product, currentSection: string, a: Product, b: Product): number {
  const aRank = getSwitchProductRank(currentProduct, currentSection, a)
  const bRank = getSwitchProductRank(currentProduct, currentSection, b)
  if (aRank !== bRank) return aRank - bRank

  if (aRank === 0) {
    const sameProfileDiff = compareSameProfileSwitchOptions(currentProduct, a, b)
    if (sameProfileDiff !== 0) return sameProfileDiff
  }

  if (aRank <= 1) {
    return compareSwitchBySection(currentSection || currentProduct.engineeringSection || '', a.name, b.name)
  }

  const sectionDiff = getSectionOrder(a.engineeringSection || '') - getSectionOrder(b.engineeringSection || '')
  if (sectionDiff !== 0) return sectionDiff

  const catalogFamilyDiff = normalizeSwitchText(a.family).localeCompare(normalizeSwitchText(b.family))
  if (catalogFamilyDiff !== 0) return catalogFamilyDiff

  return compareSwitchBySection(a.engineeringSection || '', a.name, b.name)
}

function MaterialsTab({
  project,
  products,
  templates,
  queryClient,
  warehouses,
  openAddSignal,
  splitView,
  focusMode,
  onToggleFocusMode,
}: {
  project: Project
  products: Product[]
  templates: MaterialTemplate[]
  queryClient: ReturnType<typeof useQueryClient>
  warehouses: WarehouseData[]
  openAddSignal?: number
  splitView: ReturnType<typeof useSplitViewSettings>
  focusMode: boolean
  onToggleFocusMode: () => void
}) {
  const { locale, t } = useI18n()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [engineeringDialogOpen, setEngineeringDialogOpen] = useState(false)
  const [engineeringDialogMode, setEngineeringDialogMode] = useState<'apply' | 'template'>('apply')
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)

  // Workspace "Plano + Lista" (split view) — persiste por proyecto en localStorage
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [workspaceHeight, setWorkspaceHeight] = useState<number | null>(null)

  useEffect(() => {
    if (!splitView.enabled) {
      setWorkspaceHeight(null)
      return
    }

    let frame = 0
    const measure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const rect = workspaceRef.current?.getBoundingClientRect()
        if (!rect) return
        setWorkspaceHeight(Math.max(360, Math.floor(window.innerHeight - rect.top - 12)))
      })
    }

    measure()
    const timer = window.setTimeout(measure, 80)
    window.addEventListener('resize', measure)

    return () => {
      window.clearTimeout(timer)
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [splitView.enabled, splitView.headerCollapsed, splitView.listCollapsed])

  // BOM auto-generation state
  const [bomDialogOpen, setBomDialogOpen] = useState(false)
  const [bomStep, setBomStep] = useState<1 | 2 | 3>(1)
  const [bomSelectedDoc, setBomSelectedDoc] = useState('')
  const [bomExtracting, setBomExtracting] = useState(false)
  const [bomCalculating, setBomCalculating] = useState(false)
  const [bomApplying, setBomApplying] = useState(false)
  const [bomForm, setBomForm] = useState({ widthFt: '', depthFt: '', wallHeightFt: '', roofType: 'hip' as BomRoofType, bayCount: '', roofPitchFt: '' })
  const [bomResult, setBomResult] = useState<BomPreviewResult | null>(null)
  const [bomEditItems, setBomEditItems] = useState<BomPreviewItem[]>([])
  const [deleteMaterialId, setDeleteMaterialId] = useState<string | null>(null)
  const [deleteAllMaterialsOpen, setDeleteAllMaterialsOpen] = useState(false)
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)
  const [editingQty, setEditingQty] = useState('')
  const [editingNoteMaterialId, setEditingNoteMaterialId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [switchingMaterial, setSwitchingMaterial] = useState<ProjectMaterial | null>(null)
  const [matSearch, setMatSearch] = useState('')
  const [materialActionFilter, setMaterialActionFilter] = useState<'all' | 'dispatch' | 'order'>('all')

  useEffect(() => {
    if (!openAddSignal) return
    setAddDialogOpen(true)
  }, [openAddSignal])

  // Request materials state
  const [missingMaterials, setMissingMaterials] = useState<{ productId: string; productName: string; productCode: string; needed: number }[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedRequestProductIds, setSelectedRequestProductIds] = useState<string[]>([])

  // Fetch suppliers for request dialog
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      return res.json() as Promise<{ id: string; name: string }[]>
    },
  })

  // Fetch project documents for BOM extraction
  const { data: projectDocs } = useQuery({
    queryKey: ['project-docs', project.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/documents`)
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data as { id: string; fileName: string; fileType: string }[] : []
    },
    enabled: bomDialogOpen,
  })

  const selectedMissingMaterials = useMemo(
    () => missingMaterials.filter((material) => selectedRequestProductIds.includes(material.productId)),
    [missingMaterials, selectedRequestProductIds]
  )

  const addMaterialMutation = useMutation({
    mutationFn: async ({ productId, plannedQuantity }: { productId: string; plannedQuantity: number }) => {
      const res = await fetch(`/api/projects/${project.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, plannedQuantity }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('projects.toast.materialAddError'))
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.materialAdded'))
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.materialAddError')),
  })

  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const res = await fetch(`/api/projects/${project.id}/materials/${materialId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('projects.toast.materialDeleteError'))
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.materialDeleted'))
      setDeleteMaterialId(null)
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.materialDeleteError')),
  })

  const deleteAllMaterialsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/materials`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || t('projects.toast.materialListDeleteError'))
      return data as { deleted?: number }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.materialListDeleted', { count: formatLocaleInteger(locale, data.deleted || 0) }))
      setDeleteAllMaterialsOpen(false)
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.materialListDeleteError')),
  })

  const editMaterialMutation = useMutation({
    mutationFn: async ({ materialId, plannedQuantity }: { materialId: string; plannedQuantity: number }) => {
      const res = await fetch(`/api/projects/${project.id}/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plannedQuantity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('projects.toast.updateError'))
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.quantityUpdated'))
      setEditingMaterialId(null)
      setEditingQty('')
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.updateError')),
  })

  const editMaterialNotesMutation = useMutation({
    mutationFn: async ({ materialId, notes }: { materialId: string; notes: string }) => {
      const res = await fetch(`/api/projects/${project.id}/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('projects.toast.updateError'))
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditingNoteMaterialId(null)
      setEditingNote('')
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.updateError')),
  })

  const saveNoteEdit = (materialId: string) => {
    const current = project.materials.find((m) => m.id === materialId)
    const trimmed = editingNote.trim()
    if (current && (current.notes ?? '') === trimmed) {
      setEditingNoteMaterialId(null)
      setEditingNote('')
      return
    }
    editMaterialNotesMutation.mutate({ materialId, notes: trimmed })
  }

  const switchMaterialMutation = useMutation({
    mutationFn: async ({ materialId, productId }: { materialId: string; productId: string }) => {
      const res = await fetch(`/api/projects/${project.id}/materials/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('projects.toast.materialSwitchError'))
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.materialSwitched'))
      setSwitchingMaterial(null)
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.materialSwitchError')),
  })

  const saveEdit = (materialId: string, dispatched: number) => {
    const qty = parseFloat(editingQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t('projects.validation.invalidQuantity'))
      return
    }
    if (qty < dispatched) {
      toast.error(t('projects.validation.lessThanDispatched', {
        count: formatLocaleInteger(locale, dispatched),
      }))
      return
    }
    editMaterialMutation.mutate({ materialId, plannedQuantity: qty })
  }

  const openSwitchMaterial = (material: ProjectMaterial) => {
    setSwitchingMaterial(material)
  }

  // Pending recepción items split by ownership:
  //   - own: items from this project's purchases/returns (or unassigned)
  //   - crossProject: items from OTHER projects (suggested when own doesn't cover)
  const { data: pendingRecepcionData } = useQuery({
    queryKey: ['project-recepcion', project.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/dispatch-recepcion`)
      if (!res.ok) return EMPTY_PROJECT_RECEPCION
      return res.json() as Promise<ProjectRecepcionResponse>
    },
    // staleTime: 0 + refetchOnMount: 'always' ensures the response is always
    // fresh — important so cross-cut candidates appear without manual refresh
    // when the schema/response shape changes.
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const pendingRecepcion = pendingRecepcionData?.own ?? EMPTY_RECEPCION_ITEMS
  const crossProjectRecepcion = pendingRecepcionData?.crossProject ?? EMPTY_RECEPCION_ITEMS
  const recepcionCutCandidates = pendingRecepcionData?.crossCut ?? EMPTY_RECEPCION_CUT_CANDIDATES

  // Cross-project items the user has explicitly opted to consume (checkbox state
  // inside the dispatch dialog). Reset when dialog closes.
  const [selectedCrossProjectIds, setSelectedCrossProjectIds] = useState<Set<string>>(new Set())

  const dispatchRecepcionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/dispatch-recepcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crossProjectItemIds: [...selectedCrossProjectIds],
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('projects.toast.dispatchReceptionError'))
      }
      return res.json() as Promise<{ count: number }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      queryClient.invalidateQueries({ queryKey: ['project-recepcion', project.id] })
      toast.success(t('projects.toast.dispatchReception', {
        count: formatLocaleInteger(locale, data.count),
      }))
      setDispatchRecepcionOpen(false)
      setSelectedCrossProjectIds(new Set())
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const [dispatchRecepcionOpen, setDispatchRecepcionOpen] = useState(false)

  const requestMaterialsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/request-materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          productIds: selectedRequestProductIds,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('projects.toast.requestError'))
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      if (data.missingMaterials?.length > 0) {
        toast.success(t('projects.toast.requestCreated', {
          count: formatLocaleInteger(locale, data.missingMaterials.length),
        }))
        if (data.automation?.pdfSaved) {
          toast.success('PO PDF saved to the purchase and project documents')
        }
        if (data.automation?.emailSent) {
          toast.success('PO email sent to supplier')
        } else if (data.automation?.skippedEmailReason) {
          toast.info(`PO email not sent: ${data.automation.skippedEmailReason}`)
        }
      } else {
        toast.info(t('projects.toast.noMissingMaterials'))
      }
      setRequestDialogOpen(false)
      setSelectedSupplierId('')
      setSelectedRequestProductIds([])
    },
    onError: (err) => toast.error(err.message || t('projects.toast.requestError')),
  })

  const handleOpenRequestDialog = () => {
    // Only request what is still uncovered after dispatches, open purchases,
    // and current stock available in shelves.
    // Iterar en el mismo orden visual que la tabla, para que el diálogo
    // muestre los items en el orden que el usuario reconoce.
    const missing: { productId: string; productName: string; productCode: string; needed: number }[] = []
    for (const mat of sortMaterialsForDisplay(project.materials)) {
      const product = products.find((p) => p.id === mat.productId)
      if (!product) continue
      const coverage = getMaterialCoverage(mat)
      const needed = coverage.uncovered
      if (needed > 0) {
        missing.push({ productId: mat.productId, productName: mat.product.name, productCode: mat.product.code, needed })
      }
    }
    setMissingMaterials(missing)
    setSelectedSupplierId('')
    setSelectedRequestProductIds(missing.map((item) => item.productId))
    setRequestDialogOpen(true)
  }

  const toggleRequestMaterialSelection = (productId: string, checked: boolean) => {
    setSelectedRequestProductIds((current) => {
      if (checked) {
        return current.includes(productId) ? current : [...current, productId]
      }

      return current.filter((id) => id !== productId)
    })
  }

  const handleBomExtract = async () => {
    if (!bomSelectedDoc) return
    setBomExtracting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/extract-engineering`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: bomSelectedDoc }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Error al extraer datos del plano'); return }
      const e = data.extracted
      setBomForm({
        widthFt: e.widthFt != null ? String(e.widthFt) : '',
        depthFt: e.depthFt != null ? String(e.depthFt) : '',
        wallHeightFt: e.wallHeightFt != null ? String(e.wallHeightFt) : '',
        roofType: e.roofType ?? 'hip',
        bayCount: e.bayCount != null ? String(e.bayCount) : '',
        roofPitchFt: e.roofPitchFt != null ? String(e.roofPitchFt) : '',
      })
      if (data.confidence === 'low') toast.info('Extracción con baja confianza — revisa los valores')
      else toast.success('Dimensiones extraídas del plano')
      setBomStep(2)
    } catch { toast.error('Error al extraer datos del plano') }
    finally { setBomExtracting(false) }
  }

  const handleBomCalculate = async () => {
    const widthFt = parseFloat(bomForm.widthFt)
    const depthFt = parseFloat(bomForm.depthFt)
    const wallHeightFt = parseFloat(bomForm.wallHeightFt)
    const bayCount = parseInt(bomForm.bayCount)
    if (!widthFt || !depthFt || !wallHeightFt || !bayCount) { toast.error('Completa todas las dimensiones requeridas'); return }
    setBomCalculating(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/generate-bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widthFt, depthFt, wallHeightFt, roofType: bomForm.roofType, bayCount, roofPitchFt: parseFloat(bomForm.roofPitchFt) || undefined }),
      })
      const data: BomPreviewResult = await res.json()
      if (!res.ok) { toast.error((data as unknown as { error: string }).error || 'Error al calcular'); return }
      setBomResult(data)
      setBomEditItems(data.items.map((i) => ({ ...i })))
      setBomStep(3)
    } catch { toast.error('Error al calcular la lista de materiales') }
    finally { setBomCalculating(false) }
  }

  const handleBomApply = async () => {
    if (!bomEditItems.length) return
    setBomApplying(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/materials/sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearMissing: false,
          items: bomEditItems.map((item, idx) => ({
            productId: item.productId,
            plannedQuantity: item.quantity,
            engineeringSection: item.engineeringSection,
            sortOrder: idx,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Error al aplicar BOM'); return }
      toast.success(`BOM aplicado: ${data.created} creados, ${data.updated} actualizados`)
      setBomDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
    } catch { toast.error('Error al aplicar la lista de materiales') }
    finally { setBomApplying(false) }
  }

  const returnedByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of (project.returns ?? [])) {
      if (r.status !== 'completed') continue
      for (const it of (r.items ?? [])) {
        const pid = (it as ReturnItem).productIdDelivered ?? (it as unknown as { productId: string }).productId
        const qty = toFiniteNumber(
          (it as ReturnItem).quantityDelivered ?? (it as unknown as { quantity: number }).quantity
        )
        map.set(pid, (map.get(pid) || 0) + qty)
      }
    }
    return map
  }, [project.returns])

  // Aggregate per-product quantity purchased across non-cancelled purchases of
  // this project so we can measure real uncovered quantities.
  const purchasedByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of project.purchases || []) {
      if (p.status === 'cancelled') continue
      for (const it of p.items) {
        map.set(it.productId, (map.get(it.productId) || 0) + it.quantity)
      }
    }
    return map
  }, [project.purchases])

  // Recepción items pending placement that match this project's planned products
  // exactly (same productId). These should count toward "in stock" for the
  // dispatch/order decision — a material sitting in recepción IS available, just
  // not on a shelf yet.
  const recepcionByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of pendingRecepcion) {
      map.set(item.product.id, (map.get(item.product.id) || 0) + Number(item.quantity))
    }
    return map
  }, [pendingRecepcion])

  // Same as recepcionByProduct but for items sitting in OTHER projects' recepción
  // (exact product match). These are NOT auto-counted as available stock — taking
  // them is always opt-in via the "Despachar de Recepción" dialog — but we use this
  // to mark a material as "available from another project" instead of "needs purchase".
  const crossProjectRecepcionByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of crossProjectRecepcion) {
      map.set(item.product.id, (map.get(item.product.id) || 0) + Number(item.quantity))
    }
    return map
  }, [crossProjectRecepcion])

  const getMaterialCoverage = (mat: ProjectMaterial) => {
    const product = products.find((p) => p.id === mat.productId)
    const shelfStock = product?._availableShelfStock ?? product?._totalShelfStock ?? product?.currentStock ?? 0
    const recepcionStock = recepcionByProduct.get(mat.productId) ?? 0
    const inStock = shelfStock + recepcionStock
    const reservedStock = product?._reservedShelfStock ?? 0
    const purchased = purchasedByProduct.get(mat.productId) || 0
    const remaining = Math.max(mat.plannedQuantity - mat.dispatchedQuantity, 0)
    const cutSources = findCuttableSourcesForTarget(
      {
        id: mat.productId,
        code: mat.product.code,
        name: mat.product.name,
        color: mat.product.color,
        unitQuantity: mat.product.unitQuantity,
      },
      products,
    )
    const cuttableStock = cutSources.reduce((sum, source) => sum + source.coveredTargetPieces, 0)
    // Also count cuttable stock available in RECEPCIÓN — items of a longer
    // source product that haven't been moved to a shelf yet. Without this,
    // the "Despachar" button doesn't appear when the only available material
    // is a longer piece sitting in recepción.
    const recepcionCuttableStock = recepcionCutCandidates
      .filter((c) => c.targetProduct.id === mat.productId)
      .reduce((sum, c) => {
        if (c.targetSize <= 0) return sum
        const piecesPerSource = Math.floor(c.originalSize / c.targetSize)
        return sum + Math.max(0, c.pieces) * Math.max(0, piecesPerSource)
      }, 0)
    const totalCuttable = cuttableStock + recepcionCuttableStock
    const uncovered = Math.max(remaining - purchased - inStock - totalCuttable, 0)
    const bestCutSource = cutSources[0] || null
    // Exact-match stock available in OTHER projects' recepción (opt-in only).
    const crossProjectStock = crossProjectRecepcionByProduct.get(mat.productId) ?? 0
    const availableFromOtherProject = crossProjectStock > 0 && remaining > 0

    return {
      product,
      inStock,
      shelfStock,
      recepcionStock,
      reservedStock,
      purchased,
      remaining,
      cutSources,
      cuttableStock: totalCuttable,
      recepcionCuttableStock,
      bestCutSource,
      uncovered,
      crossProjectStock,
      availableFromOtherProject,
    }
  }

  const suppliersUsedByProduct = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const p of project.purchases || []) {
      if (p.status === 'cancelled') continue
      for (const it of p.items) {
        if (!map.has(it.productId)) map.set(it.productId, new Set())
        map.get(it.productId)!.add(p.supplierId)
      }
    }
    return map
  }, [project.purchases])

  // ── Per-material quick actions (dispatch from stock OR request from supplier)
  const [quickMat, setQuickMat] = useState<ProjectMaterial | null>(null)
  const [quickMode, setQuickMode] = useState<'dispatch' | 'request'>('dispatch')
  const [quickSupplierId, setQuickSupplierId] = useState('')
  const [quickPickEdits, setQuickPickEdits] = useState<Record<string, number>>({})
  const [quickUseReserve, setQuickUseReserve] = useState(false)
  // Cross-product cut: when the planned product (B = 6') has no stock but a longer
  // source product (A = 24') is available, the user can opt to cut from A. The
  // remainder (e.g. 18') is stored as a new short-piece product, reserved, or scrap.
  const [cutFromProductId, setCutFromProductId] = useState<string | null>(null)
  const [cutFromShelfId, setCutFromShelfId] = useState<string | null>(null)
  // For recepción cuts: holds the recepcionItem.id of the selected source
  const [cutFromRecepcionItemId, setCutFromRecepcionItemId] = useState<string | null>(null)
  const [cutRemainderHandling, setCutRemainderHandling] = useState<'short-piece' | 'reserved' | 'scrap'>('short-piece')

  // Reset cut state when the dialog opens with a new material
  useEffect(() => {
    setCutRemainderHandling('short-piece')
    setCutFromRecepcionItemId(null)
    if (!quickMat || quickMode !== 'dispatch') {
      setCutFromProductId(null)
      setCutFromShelfId(null)
      return
    }
    const coverage = getMaterialCoverage(quickMat)
    const bestSource = coverage.inStock <= 0 ? coverage.bestCutSource : null
    setCutFromProductId(bestSource?.productId ?? null)
    setCutFromShelfId(bestSource?.bestShelfId ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickMat?.id, quickMode, products])

  const quickReceptionSignature = useMemo(
    () => pendingRecepcion
      .filter((item) => item.product?.id === quickMat?.productId && item.quantity > 0)
      .map((item) => `${item.id}:${item.quantity}`)
      .join('|'),
    [pendingRecepcion, quickMat?.productId]
  )

  useEffect(() => {
    if (!quickMat) { setQuickPickEdits({}); setQuickUseReserve(false); return }
    const alloc = computeQuickAllocation(quickMat, quickUseReserve)
    const edits: Record<string, number> = {}
    let remaining = alloc.gap
    for (const item of pendingRecepcion) {
      if (remaining <= 0) break
      if (item.product?.id !== quickMat.productId || item.quantity <= 0) continue

      const qty = Math.min(Number(item.quantity), remaining)
      edits[`recepcion:${item.id}`] = qty
      remaining -= qty
    }
    for (const pick of alloc.picks) {
      if (remaining <= 0) break

      const qty = Math.min(pick.qty, remaining)
      edits[`shelf:${pick.shelfId}`] = qty
      remaining -= qty
    }
    setQuickPickEdits((current) => {
      const currentKeys = Object.keys(current)
      const nextKeys = Object.keys(edits)
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === edits[key])
      ) {
        return current
      }
      return edits
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickMat, quickUseReserve, quickReceptionSignature])

  const computeQuickAllocation = (mat: ProjectMaterial, useReserve = false) => {
    const gap = mat.plannedQuantity - mat.dispatchedQuantity
    const product = products.find((p) => p.id === mat.productId)
    const stocks = (product?.shelfStocks || [])
      .map((s) => ({
        ...s,
        _available: useReserve ? Number(s.quantity) : Number(s.availableQuantity ?? Math.max(Number(s.quantity) - Number(s.reserveQuantity || 0), 0)),
      }))
      .filter((s) => s._available > 0)
      .slice()
      .sort((a, b) => b._available - a._available)

    const single = stocks.find((s) => s._available >= gap)
    const picks: { shelfId: string; qty: number; label: string; allowReserve: boolean }[] = []
    if (single) {
      picks.push({
        shelfId: single.shelfId,
        qty: gap,
        label: `${single.shelf.rack.warehouse.name} / ${single.shelf.rack.name} / ${single.shelf.name}`,
        allowReserve: useReserve && (single.isReserveShelf || single.reserveQuantity > 0),
      })
    } else {
      let remaining = gap
      for (const s of stocks) {
        if (remaining <= 0) break
        const take = Math.min(s._available, remaining)
        picks.push({
          shelfId: s.shelfId,
          qty: take,
          label: `${s.shelf.rack.warehouse.name} / ${s.shelf.rack.name} / ${s.shelf.name}`,
          allowReserve: useReserve && (s.isReserveShelf || s.reserveQuantity > 0),
        })
        remaining -= take
      }
    }
    const totalAvailable = stocks.reduce((s, x) => s + x._available, 0)
    return { gap, picks, totalStock: totalAvailable, shortage: Math.max(gap - totalAvailable, 0) }
  }

  const quickDispatchMutation = useMutation({
    mutationFn: async (vars: {
      picks: {
        shelfId: string
        qty: number
        allowReserve?: boolean
        cutFromProductId?: string
        cutFromShelfId?: string
        cutFromRecepcionItemId?: string
        remainderHandling?: 'short-piece' | 'reserved' | 'scrap'
      }[]
      productId: string
    }) => {
      const res = await fetch(`/api/projects/${project.id}/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispatchDate: new Date().toISOString().split('T')[0],
          notes: 'Despacho rápido desde lista de materiales',
          items: vars.picks.map((p) => ({
            productId: vars.productId,
            shelfId: p.shelfId,
            quantity: p.qty,
            allowReserve: p.allowReserve ?? false,
            cutFromProductId: p.cutFromProductId,
            cutFromShelfId: p.cutFromShelfId,
            cutFromRecepcionItemId: p.cutFromRecepcionItemId,
            remainderHandling: p.remainderHandling,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('projects.toast.quickDispatchError'))
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      queryClient.invalidateQueries({ queryKey: ['project-recepcion', project.id] })
      toast.success(t('projects.toast.quickDispatch'))
      setQuickMat(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const quickReceptionDispatchMutation = useMutation({
    mutationFn: async (vars: { items: { id: string; qty: number }[] }) => {
      for (const item of vars.items) {
        const res = await fetch(`/api/recepcion/${item.id}/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            quantity: item.qty,
            notes: 'Despacho rapido desde recepcion',
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || t('projects.toast.quickDispatchError'))
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      queryClient.invalidateQueries({ queryKey: ['project-recepcion', project.id] })
      toast.success(t('projects.toast.quickDispatch'))
      setQuickMat(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const quickRequestMutation = useMutation({
    mutationFn: async (vars: { productId: string; quantity: number; supplierId: string }) => {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: vars.supplierId,
          projectId: project.id,
          poNumber: project.poNumber || '',
          purchaseDate: new Date().toISOString().split('T')[0],
          purchaseCode: `PED-${Date.now()}`,
          notes: 'Pedido rápido desde lista de materiales',
          status: 'pedido',
          items: [{ productId: vars.productId, quantity: vars.quantity, unitPrice: 0 }],
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('projects.toast.quickRequestError'))
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success(t('projects.toast.quickRequest'))
      if (data.automation?.pdfSaved) {
        toast.success('PO PDF saved to the purchase and project documents')
      }
      if (data.automation?.emailSent) {
        toast.success('PO email sent to supplier')
      } else if (data.automation?.skippedEmailReason) {
        toast.info(`PO email not sent: ${data.automation.skippedEmailReason}`)
      }
      setQuickMat(null)
      setQuickSupplierId('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Complementary purchase (gap coverage with another supplier) ──────────
  const [complementMat, setComplementMat] = useState<ProjectMaterial | null>(null)
  const [complementQty, setComplementQty] = useState(0)
  const [complementSupplierId, setComplementSupplierId] = useState('')
  const [complementUnitPrice, setComplementUnitPrice] = useState('')

  const openComplementDialog = (mat: ProjectMaterial, gap: number) => {
    setComplementMat(mat)
    setComplementQty(gap)
    setComplementSupplierId('')
    setComplementUnitPrice('')
  }

  const complementMutation = useMutation({
    mutationFn: async (vars: { productId: string; quantity: number; supplierId: string; unitPrice: number }) => {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: vars.supplierId,
          projectId: project.id,
          poNumber: project.poNumber || '',
          purchaseDate: new Date().toISOString().split('T')[0],
          purchaseCode: `OC-COMP-${Date.now()}`,
          notes: 'Compra complementaria para cubrir faltante',
          status: 'pedido',
          items: [{ productId: vars.productId, quantity: vars.quantity, unitPrice: vars.unitPrice }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('projects.toast.complementaryPurchaseError'))
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      toast.success(t('projects.toast.complementaryPurchaseCreated'))
      if (data.automation?.pdfSaved) {
        toast.success('PO PDF saved to the purchase and project documents')
      }
      if (data.automation?.emailSent) {
        toast.success('PO email sent to supplier')
      } else if (data.automation?.skippedEmailReason) {
        toast.info(`PO email not sent: ${data.automation.skippedEmailReason}`)
      }
      setComplementMat(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const availableProducts = products.filter(
    (p) =>
      !project.materials.some((m) => m.productId === p.id) &&
      isProductCompatibleWithProjectColor(project.color, p.color)
  )
  const switchProductOptions = useMemo(() => {
    if (!switchingMaterial) return []

    const currentProduct = products.find((p) => p.id === switchingMaterial.productId)
    if (!currentProduct) return []

    const currentSection =
      switchingMaterial.engineeringSection ||
      switchingMaterial.product.engineeringSection ||
      currentProduct.engineeringSection ||
      ''

    return products
      .filter((p) => p.id !== switchingMaterial.productId)
      .filter(
        (p) =>
          !project.materials.some(
            (m) => m.productId === p.id && m.id !== switchingMaterial.id
          )
      )
      .filter((p) => isProductCompatibleWithProjectColor(project.color, p.color))
      .sort((a, b) => compareSwitchProductOptions(currentProduct, currentSection, a, b))
  }, [products, project.materials, project.color, switchingMaterial])

  const isPostDispatch = project.status === 'finished' || project.status === 'cancelled'
  const compactMaterials = sortMaterialsForDisplay(project.materials).map<CompactMaterial>((mat) => {
    const coverage = getMaterialCoverage(mat)
    const gap = coverage.remaining
    return {
      id: mat.id,
      productId: mat.productId,
      productName: mat.product.name,
      productCode: mat.product.code,
      section: mat.engineeringSection || mat.product?.engineeringSection || 'Sin seccion',
      plannedQuantity: mat.plannedQuantity,
      dispatchedQuantity: mat.dispatchedQuantity,
      returnedQuantity: returnedByProduct.get(mat.productId) || 0,
      notes: mat.notes ?? '',
      canDispatch: gap > 0 && (coverage.inStock > 0 || coverage.cuttableStock > 0) && !isPostDispatch,
      needsPurchase: coverage.uncovered > 0 && !isPostDispatch,
      availableFromOtherProject: coverage.availableFromOtherProject && !isPostDispatch,
      inStock: coverage.inStock,
      uncovered: coverage.uncovered,
      gap,
      cuttableStock: coverage.cuttableStock,
      cutSourceLabel: coverage.bestCutSource?.code,
      cutSourceLength: coverage.bestCutSource?.sourceLength,
    }
  })
  const materialsActionMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700">
          <Settings2 className="h-4 w-4" />
          Acciones materiales
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Materiales</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => splitView.setEnabled(true)}>
          <Columns2 className="mr-2 h-4 w-4" />
          Modo Plano + Lista
        </DropdownMenuItem>
        {!isPostDispatch && (
          <>
            <DropdownMenuItem
              onSelect={() => {
                setBomDialogOpen(true)
                setBomStep(1)
                setBomResult(null)
                setBomForm({ widthFt: '', depthFt: '', wallHeightFt: '', roofType: 'hip', bayCount: '', roofPitchFt: '' })
              }}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Generar BOM
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setEngineeringDialogMode('apply')
                setEngineeringDialogOpen(true)
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('projects.actions.applyTemplate')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setEngineeringDialogMode('template')
                setEngineeringDialogOpen(true)
              }}
            >
              <Layers className="mr-2 h-4 w-4" />
              {t('projects.actions.createTemplate')}
            </DropdownMenuItem>
            {project.materials.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDeleteAllMaterialsOpen(true)} className="text-rose-700 focus:text-rose-700">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('projects.actions.deleteMaterialList')}
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className={splitView.enabled ? 'space-y-0' : 'space-y-4'}>
      {/* Actions — flujo lógico: Subir lista → Pedir → Agregar → Despachar desde Recepción */}
      {/* Cuando el proyecto ya está despachado/finalizado solo mostramos Agregar Material */}
      {!splitView.enabled && (
      <div className="flex flex-wrap items-center gap-2">
        {materialsActionMenu}
        {!isPostDispatch && project.materials.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleOpenRequestDialog} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
            <ShoppingBag className="h-4 w-4" />
            {t('projects.actions.requestMissingMaterials')}
          </Button>
        )}
        {pendingRecepcion.length > 0 ? (
          <Button
            size="sm"
            onClick={() => setDispatchRecepcionOpen(true)}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-300 ring-offset-2"
          >
            <Inbox className="h-4 w-4" />
            {t('projects.actions.dispatchFromReception')}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700 animate-pulse">
              {pendingRecepcion.length}
            </span>
          </Button>
        ) : crossProjectRecepcion.length > 0 ? (
          <Button
            size="sm"
            onClick={() => setDispatchRecepcionOpen(true)}
            className="gap-2 bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-300 ring-offset-2"
          >
            <Inbox className="h-4 w-4" />
            {t('projects.actions.reviewOtherProjectsReception')}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-amber-700">
              {crossProjectRecepcion.length}
            </span>
          </Button>
        ) : null}
      </div>
      )}

      {/* Materials Table — opcionalmente envuelto en split view con plano embebido */}
      <div
        ref={workspaceRef}
        className={splitView.enabled ? 'grid min-h-0 overflow-hidden rounded-lg border bg-card' : ''}
        style={
          splitView.enabled
            ? {
                gridTemplateColumns: splitView.listCollapsed
                  ? '52px minmax(0, 1fr)'
                  : `${splitView.ratio * 100}% 6px ${(1 - splitView.ratio) * 100}%`,
                height: workspaceHeight ? `${workspaceHeight}px` : 'calc(100dvh - 230px)',
                minHeight: '360px',
              }
            : undefined
        }
      >
        <div className={splitView.enabled ? 'min-h-0 min-w-0 overflow-hidden' : ''}>
      {splitView.enabled ? (
        splitView.listCollapsed ? (
          <CollapsedListStrip
            materials={compactMaterials}
            onExpand={() => splitView.setListCollapsed(false)}
          />
        ) : project.materials.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('projects.materials.emptyTitle')}
            description={t('projects.materials.emptyDescription')}
          />
        ) : (
          <MaterialsCompactView
            materials={sortMaterialsForDisplay(project.materials).map<CompactMaterial>((mat) => {
              const coverage = getMaterialCoverage(mat)
              const gap = coverage.remaining
              return {
                id: mat.id,
                productId: mat.productId,
                productName: mat.product.name,
                productCode: mat.product.code,
                section: mat.engineeringSection || mat.product?.engineeringSection || 'Sin sección',
                plannedQuantity: mat.plannedQuantity,
                dispatchedQuantity: mat.dispatchedQuantity,
                returnedQuantity: returnedByProduct.get(mat.productId) || 0,
                notes: mat.notes ?? '',
                canDispatch: gap > 0 && (coverage.inStock > 0 || coverage.cuttableStock > 0) && !isPostDispatch,
                needsPurchase: coverage.uncovered > 0 && !isPostDispatch,
                availableFromOtherProject: coverage.availableFromOtherProject && !isPostDispatch,
                inStock: coverage.inStock,
                uncovered: coverage.uncovered,
                gap,
                cuttableStock: coverage.cuttableStock,
                cutSourceLabel: coverage.bestCutSource?.code,
                cutSourceLength: coverage.bestCutSource?.sourceLength,
              }
            })}
            scrollStorageKey={`mat-split-list-scroll-${project.id}`}
            isPostDispatch={isPostDispatch}
            search={matSearch}
            onSearchChange={setMatSearch}
            actionFilter={materialActionFilter}
            onActionFilterChange={setMaterialActionFilter}
            editingMaterialId={editingMaterialId}
            editingQty={editingQty}
            onEditingQtyChange={setEditingQty}
            onStartEdit={(mat) => {
              setEditingMaterialId(mat.id)
              setEditingQty(String(mat.plannedQuantity))
            }}
            onCancelEdit={() => {
              setEditingMaterialId(null)
              setEditingQty('')
            }}
            onSaveEdit={(matId, dispatched) => saveEdit(matId, dispatched)}
            isEditPending={editMaterialMutation.isPending}
            editingNoteMaterialId={editingNoteMaterialId}
            editingNote={editingNote}
            onEditingNoteChange={setEditingNote}
            onStartEditNote={(mat) => {
              setEditingNoteMaterialId(mat.id)
              setEditingNote(mat.notes)
            }}
            onCancelEditNote={() => {
              setEditingNoteMaterialId(null)
              setEditingNote('')
            }}
            onSaveEditNote={(matId) => saveNoteEdit(matId)}
            isEditNotePending={editMaterialNotesMutation.isPending}
            onDelete={(matId) => setDeleteMaterialId(matId)}
            onDispatch={(mat) => {
              const fullMat = project.materials.find((m) => m.id === mat.id)
              if (!fullMat) return
              setQuickMat(fullMat)
              setQuickMode('dispatch')
            }}
            onRequest={(mat) => {
              const fullMat = project.materials.find((m) => m.id === mat.id)
              if (!fullMat) return
              setQuickMat(fullMat)
              setQuickMode('request')
              setQuickSupplierId('')
            }}
            onSwitch={(mat) => {
              const fullMat = project.materials.find((m) => m.id === mat.id)
              if (fullMat) openSwitchMaterial(fullMat)
            }}
            onOpenReception={() => setDispatchRecepcionOpen(true)}
          />
        )
      ) : project.materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('projects.materials.emptyTitle')}
          description={t('projects.materials.emptyDescription')}
        />
      ) : (() => {
        const q = matSearch.trim().toLowerCase()

        const sortedMaterials = sortMaterialsForDisplay(project.materials)
        const materialRows = sortedMaterials.map((mat) => {
          const returned = returnedByProduct.get(mat.productId) || 0
          const coverage = getMaterialCoverage(mat)
          const gap = coverage.remaining
          const canDispatch = gap > 0 && (coverage.inStock > 0 || coverage.cuttableStock > 0) && !isPostDispatch
          const needsPurchase = coverage.uncovered > 0 && !isPostDispatch
          const availableFromOtherProject = coverage.availableFromOtherProject && !isPostDispatch

          return {
            mat,
            returned,
            inStock: coverage.inStock,
            cuttableStock: coverage.cuttableStock,
            bestCutSource: coverage.bestCutSource,
            gap,
            uncovered: coverage.uncovered,
            canDispatch,
            needsPurchase,
            availableFromOtherProject,
          }
        })
        const dispatchRows = materialRows.filter((row) => row.canDispatch)
        const orderRows = materialRows.filter((row) => row.needsPurchase)
        const visibleRows = materialRows
          .filter((row) => {
            if (!q) return true
            return (
              row.mat.product.name.toLowerCase().includes(q) ||
              row.mat.product.code.toLowerCase().includes(q) ||
              (row.mat.engineeringSection || row.mat.product?.engineeringSection)?.toLowerCase().includes(q)
            )
          })
          .filter((row) => {
            if (materialActionFilter === 'dispatch') return row.canDispatch
            if (materialActionFilter === 'order') return row.needsPurchase
            return true
          })
        const matAccent = getProjectStatusAccent(project.status)

        const handlePrintMaterials = () => {
          const totalPlanned    = project.materials.reduce((s, m) => s + m.plannedQuantity,    0)
          const totalDispatched = project.materials.reduce((s, m) => s + m.dispatchedQuantity, 0)
          const totalReturned   = project.materials.reduce((s, m) => s + (returnedByProduct.get(m.productId) || 0), 0)
          const totalPending    = Math.max(0, totalPlanned - totalDispatched)
          const pendingLabel    = locale === 'es' ? 'Pendiente' : 'Pending'
          const printDate       = new Date().toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })

          // Agrupar materiales por sección, conservando el orden del compact view
          const sectionGroups: { section: string; items: typeof materialRows }[] = []
          for (const row of materialRows) {
            const section = row.mat.engineeringSection || row.mat.product?.engineeringSection || 'Sin sección'
            const last = sectionGroups[sectionGroups.length - 1]
            if (last && last.section === section) {
              last.items.push(row)
            } else {
              sectionGroups.push({ section, items: [row] })
            }
          }

          let runningIndex = 0
          const body = sectionGroups.map((group) => {
            const sectionRow = `<tr class="sec"><td colspan="6">${group.section} <span class="sec-count">· ${group.items.length}</span></td></tr>`
            const itemRows = group.items.map((row) => {
              runningIndex++
              const mat = row.mat
              const returned = row.returned
              const pending = Math.max(0, mat.plannedQuantity - mat.dispatchedQuantity)
              return `<tr>
                <td class="num">${runningIndex}</td>
                <td><strong>${mat.product.name}</strong> <span class="code">${mat.product.code}</span></td>
                <td class="num">${mat.plannedQuantity}</td>
                <td class="num">${mat.dispatchedQuantity}</td>
                <td class="num">${returned > 0 ? returned : '<span class="zero">0</span>'}</td>
                <td class="num">${pending}</td>
              </tr>`
            }).join('')
            return sectionRow + itemRows
          }).join('')

          const html = `<!DOCTYPE html>
<html lang="${locale}"><head>
<meta charset="UTF-8">
<title>${project.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11.3px;line-height:1.22;color:#111;padding:12px}
  .hdr{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px;margin-bottom:9px;padding-bottom:7px;border-bottom:1px solid #d4d4d8}
  h1{font-size:16px;line-height:1.12;font-weight:700;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .client{font-size:11.3px;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .meta{font-size:10px;color:#71717a;text-align:right;white-space:nowrap}
  table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:0}
  thead{display:table-header-group}
  tfoot{display:table-row-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  thead th{background:#f4f4f5;padding:4px 5px;font-size:9.4px;line-height:1.05;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#52525b;border-bottom:1px solid #d4d4d8}
  tbody td{padding:3.5px 5px;border-bottom:.5px solid #ececef;vertical-align:middle}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:nth-child(even):not(.sec) td{background:#fafbfc}
  tfoot td{padding:4px 5px;font-weight:700;border-top:1px solid #d4d4d8;background:#fafafa}
  .num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}
  td strong{font-size:11.3px;line-height:1.1;font-weight:650}
  .code{font-family:ui-monospace,monospace;font-size:8.7px;color:#94a3b8;margin-left:5px;letter-spacing:.01em}
  .zero{color:#cbd5e1}
  tr.sec td{background:#e2e8f0;padding:4px 5px;font-size:9.4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#334155;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}
  tr.sec .sec-count{font-weight:600;color:#64748b}
  .col-index{width:26px}
  .col-product{width:auto;text-align:left}
  .col-qty{width:72px}
  @media print{@page{margin:6mm 7mm;size:A4}body{padding:0}thead th,tfoot td,tr.sec td,tbody tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body>
  <div class="hdr">
    <div>
      <h1>${project.name}</h1>
      <div class="client">${project.client.name}${project.poNumber ? ` · PO ${project.poNumber}` : ''}</div>
    </div>
    <div class="meta">${printDate}<br>${project.materials.length} ${locale === 'es' ? 'materiales' : 'materials'}</div>
  </div>
  <table>
    <thead><tr>
      <th class="num col-index">#</th>
      <th class="col-product">${t('reports.tables.product')}</th>
      <th class="num col-qty">${t('projects.materials.table.planned')}</th>
      <th class="num col-qty">${t('projects.materials.table.dispatched')}</th>
      <th class="num col-qty">${t('projects.materials.table.returned')}</th>
      <th class="num col-qty">${pendingLabel}</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td></td>
      <td>Total · ${project.materials.length} ${locale === 'es' ? 'materiales' : 'materials'}</td>
      <td class="num">${totalPlanned}</td>
      <td class="num">${totalDispatched}</td>
      <td class="num">${totalReturned}</td>
      <td class="num">${totalPending}</td>
    </tr></tfoot>
  </table>
  <script>window.onload=function(){window.print()}</script>
</body></html>`

          const win = window.open('', '_blank', 'width=900,height=700')
          if (win) { win.document.write(html); win.document.close() }
        }

        const handlePrintFilteredMaterials = () => {
          const totalPlanned    = visibleRows.reduce((s, r) => s + r.mat.plannedQuantity, 0)
          const totalDispatched = visibleRows.reduce((s, r) => s + r.mat.dispatchedQuantity, 0)
          const totalReturned   = visibleRows.reduce((s, r) => s + r.returned, 0)
          const totalPending    = Math.max(0, totalPlanned - totalDispatched)
          const pendingLabel    = locale === 'es' ? 'Pendiente' : 'Pending'
          const printDate       = new Date().toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          const filteredLabel   = `Filtrado: ${visibleRows.length} / ${project.materials.length}`

          // Agrupar materiales filtrados por sección, conservando el orden
          const sectionGroups: { section: string; items: typeof visibleRows }[] = []
          for (const row of visibleRows) {
            const section = row.mat.engineeringSection || row.mat.product?.engineeringSection || 'Sin sección'
            const last = sectionGroups[sectionGroups.length - 1]
            if (last && last.section === section) {
              last.items.push(row)
            } else {
              sectionGroups.push({ section, items: [row] })
            }
          }

          let runningIndex = 0
          const body = sectionGroups.map((group) => {
            const sectionRow = `<tr class="sec"><td colspan="6">${group.section} <span class="sec-count">· ${group.items.length}</span></td></tr>`
            const itemRows = group.items.map((row) => {
              runningIndex++
              const mat = row.mat
              const returned = row.returned
              const pending = Math.max(0, mat.plannedQuantity - mat.dispatchedQuantity)
              return `<tr>
                <td class="num">${runningIndex}</td>
                <td><strong>${mat.product.name}</strong> <span class="code">${mat.product.code}</span></td>
                <td class="num">${mat.plannedQuantity}</td>
                <td class="num">${mat.dispatchedQuantity}</td>
                <td class="num">${returned > 0 ? returned : '<span class="zero">0</span>'}</td>
                <td class="num">${pending}</td>
              </tr>`
            }).join('')
            return sectionRow + itemRows
          }).join('')

          const html = `<!DOCTYPE html>
<html lang="${locale}"><head>
<meta charset="UTF-8">
<title>${project.name} — ${filteredLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11.3px;line-height:1.22;color:#111;padding:12px}
  .hdr{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px;margin-bottom:9px;padding-bottom:7px;border-bottom:1px solid #d4d4d8}
  h1{font-size:16px;line-height:1.12;font-weight:700;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .client{font-size:11.3px;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .meta{font-size:10px;color:#71717a;text-align:right;white-space:nowrap}
  .filter-tag{font-size:9px;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:3px;margin-top:3px;display:inline-block}
  table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:0}
  thead{display:table-header-group}
  tfoot{display:table-row-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  thead th{background:#f4f4f5;padding:4px 5px;font-size:9.4px;line-height:1.05;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#52525b;border-bottom:1px solid #d4d4d8}
  tbody td{padding:3.5px 5px;border-bottom:.5px solid #ececef;vertical-align:middle}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:nth-child(even):not(.sec) td{background:#fafbfc}
  tfoot td{padding:4px 5px;font-weight:700;border-top:1px solid #d4d4d8;background:#fafafa}
  .num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}
  td strong{font-size:11.3px;line-height:1.1;font-weight:650}
  .code{font-family:ui-monospace,monospace;font-size:8.7px;color:#94a3b8;margin-left:5px;letter-spacing:.01em}
  .zero{color:#cbd5e1}
  tr.sec td{background:#e2e8f0;padding:4px 5px;font-size:9.4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#334155;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}
  tr.sec .sec-count{font-weight:600;color:#64748b}
  .col-index{width:26px}
  .col-product{width:auto;text-align:left}
  .col-qty{width:72px}
  @media print{@page{margin:6mm 7mm;size:A4}body{padding:0}thead th,tfoot td,tr.sec td,tbody tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body>
  <div class="hdr">
    <div>
      <h1>${project.name}</h1>
      <div class="client">${project.client.name}${project.poNumber ? ` · PO ${project.poNumber}` : ''}</div>
      <div class="filter-tag">${filteredLabel}</div>
    </div>
    <div class="meta">${printDate}<br>${visibleRows.length} ${locale === 'es' ? 'materiales' : 'materials'}</div>
  </div>
  <table>
    <thead><tr>
      <th class="num col-index">#</th>
      <th class="col-product">${t('reports.tables.product')}</th>
      <th class="num col-qty">${t('projects.materials.table.planned')}</th>
      <th class="num col-qty">${t('projects.materials.table.dispatched')}</th>
      <th class="num col-qty">${t('projects.materials.table.returned')}</th>
      <th class="num col-qty">${pendingLabel}</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td></td>
      <td>Total · ${visibleRows.length} ${locale === 'es' ? 'materiales' : 'materials'}</td>
      <td class="num">${totalPlanned}</td>
      <td class="num">${totalDispatched}</td>
      <td class="num">${totalReturned}</td>
      <td class="num">${totalPending}</td>
    </tr></tfoot>
  </table>
  <script>window.onload=function(){window.print()}</script>
</body></html>`

          const win = window.open('', '_blank', 'width=900,height=700')
          if (win) { win.document.write(html); win.document.close() }
        }

        const handleExportMaterialsExcel = async () => {
          if (visibleRows.length === 0) {
            toast.info(locale === 'es' ? 'No hay materiales para exportar' : 'No materials to export')
            return
          }

          const XLSX = await import('xlsx')
          const totalPlanned = visibleRows.reduce((sum, row) => sum + row.mat.plannedQuantity, 0)
          const totalDispatched = visibleRows.reduce((sum, row) => sum + row.mat.dispatchedQuantity, 0)
          const totalReturned = visibleRows.reduce((sum, row) => sum + row.returned, 0)
          const totalPending = visibleRows.reduce(
            (sum, row) => sum + Math.max(row.mat.plannedQuantity - row.mat.dispatchedQuantity, 0),
            0
          )
          const summaryRows = [
            ['RMC Project Materials'],
            ['Project', project.name],
            ['PO', project.poNumber || ''],
            ['Client', project.client.name],
            ['Status', project.status],
            ['Search', matSearch.trim() || ''],
            ['Action filter', materialActionFilter],
            ['Materials exported', visibleRows.length],
            ['Generated', new Date().toLocaleString()],
            [],
            ['Totals', '', '', totalPlanned, totalDispatched, totalReturned, totalPending],
            [],
          ]
          const dataRows = visibleRows.map((row, index) => {
            const pending = Math.max(row.mat.plannedQuantity - row.mat.dispatchedQuantity, 0)
            return {
              '#': index + 1,
              Code: row.mat.product.code,
              Product: row.mat.product.name,
              Section: row.mat.engineeringSection || row.mat.product?.engineeringSection || '',
              Planned: row.mat.plannedQuantity,
              Dispatched: row.mat.dispatchedQuantity,
              Returned: row.returned,
              Pending: pending,
              'Stock Available': row.inStock,
              'To Dispatch': row.canDispatch ? Math.min(row.gap, row.inStock + row.cuttableStock) : 0,
              'To Order': row.needsPurchase ? row.uncovered : 0,
            }
          })

          const worksheet = XLSX.utils.aoa_to_sheet(summaryRows)
          XLSX.utils.sheet_add_json(worksheet, dataRows, {
            origin: `A${summaryRows.length + 1}`,
            skipHeader: false,
          })
          const headerRow = summaryRows.length + 1
          worksheet['!freeze'] = { xSplit: 0, ySplit: headerRow }
          worksheet['!autofilter'] = {
            ref: XLSX.utils.encode_range({
              s: { r: headerRow - 1, c: 0 },
              e: { r: headerRow - 1 + dataRows.length, c: Object.keys(dataRows[0]).length - 1 },
            }),
          }
          worksheet['!cols'] = [
            { wch: 6 },
            { wch: 18 },
            { wch: 38 },
            { wch: 22 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
            { wch: 12 },
          ]

          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials')
          const safeName = (project.poNumber || project.name || 'Project')
            .replace(/[\\/:*?"<>|]+/g, '-')
            .replace(/\s+/g, '-')
            .slice(0, 80)
          XLSX.writeFile(workbook, `RMC-${safeName}-Materials.xlsx`, { compression: true })
        }

        const handlePrintPendingActions = () => {
          const pendingRows =
            materialActionFilter === 'dispatch'
              ? dispatchRows
              : materialActionFilter === 'order'
                ? orderRows
                : materialRows.filter((row) => row.canDispatch || row.needsPurchase)

          if (pendingRows.length === 0) {
            toast.info('No pending actions to print')
            return
          }

          const title =
            materialActionFilter === 'dispatch'
              ? 'Dispatch pending'
              : materialActionFilter === 'order'
                ? 'Order pending'
                : 'Pending actions'
          const printDate = new Date().toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
          // Agrupar por sección, conservando orden del compact view
          const sectionGroups: { section: string; items: typeof pendingRows }[] = []
          for (const row of pendingRows) {
            const section = row.mat.engineeringSection || row.mat.product?.engineeringSection || 'Sin sección'
            const last = sectionGroups[sectionGroups.length - 1]
            if (last && last.section === section) {
              last.items.push(row)
            } else {
              sectionGroups.push({ section, items: [row] })
            }
          }

          let runningIndex = 0
          const body = sectionGroups.map((group) => {
            const sectionRow = `<tr class="sec"><td colspan="7">${group.section} <span class="sec-count">· ${group.items.length}</span></td></tr>`
            const itemRows = group.items.map((row) => {
              runningIndex++
              const dispatchQty = row.canDispatch ? Math.min(row.gap, row.inStock + row.cuttableStock) : 0
              const orderQty = row.needsPurchase ? row.uncovered : 0
              return `<tr>
                <td class="num">${runningIndex}</td>
                <td><strong>${row.mat.product.name}</strong> <span class="code">${row.mat.product.code}</span></td>
                <td class="num">${row.mat.plannedQuantity}</td>
                <td class="num">${row.mat.dispatchedQuantity}</td>
                <td class="num">${row.inStock}</td>
                <td class="num">${dispatchQty ? `<span class="disp">${dispatchQty}</span>` : '<span class="zero">-</span>'}</td>
                <td class="num">${orderQty ? `<span class="ord">${orderQty}</span>` : '<span class="zero">-</span>'}</td>
              </tr>`
            }).join('')
            return sectionRow + itemRows
          }).join('')

          const html = `<!DOCTYPE html>
<html lang="${locale}"><head>
<meta charset="UTF-8">
<title>${project.name} - ${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11.3px;line-height:1.22;color:#111;padding:12px}
  .hdr{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px;margin-bottom:9px;padding-bottom:7px;border-bottom:1px solid #d4d4d8}
  h1{font-size:16px;line-height:1.12;font-weight:700;margin-bottom:1px}
  .sub{font-size:11.3px;font-weight:600;color:#334155;margin-bottom:1px}
  .client{font-size:11.3px;color:#52525b}
  .meta{font-size:10px;color:#71717a;text-align:right;white-space:nowrap}
  table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:0}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  thead th{background:#f4f4f5;padding:4px 5px;font-size:9.4px;line-height:1.05;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#52525b;border-bottom:1px solid #d4d4d8}
  tbody td{padding:3.5px 5px;border-bottom:.5px solid #ececef;vertical-align:middle}
  tbody tr:nth-child(even):not(.sec) td{background:#fafbfc}
  .num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}
  td strong{font-size:11.3px;line-height:1.1;font-weight:650}
  .code{font-family:ui-monospace,monospace;font-size:8.7px;color:#94a3b8;margin-left:5px;letter-spacing:.01em}
  .zero{color:#cbd5e1}
  .disp{color:#047857;font-weight:700}
  .ord{color:#1d4ed8;font-weight:700}
  tr.sec td{background:#e2e8f0;padding:4px 5px;font-size:9.4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#334155;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}
  tr.sec .sec-count{font-weight:600;color:#64748b}
  .col-index{width:26px}
  .col-qty{width:64px}
  @media print{@page{margin:6mm 7mm;size:A4}body{padding:0}thead th,tr.sec td,.disp,.ord,tbody tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body>
  <div class="hdr">
    <div>
      <h1>${project.name}</h1>
      <div class="sub">${title}</div>
      <div class="client">${project.client.name}${project.poNumber ? ` · PO ${project.poNumber}` : ''}</div>
    </div>
    <div class="meta">${printDate}<br>${pendingRows.length} items</div>
  </div>
  <table>
    <thead><tr>
      <th class="num col-index">#</th>
      <th>${t('reports.tables.product')}</th>
      <th class="num col-qty">${t('projects.materials.table.planned')}</th>
      <th class="num col-qty">${t('projects.materials.table.dispatched')}</th>
      <th class="num col-qty">Stock</th>
      <th class="num col-qty">To dispatch</th>
      <th class="num col-qty">To order</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <script>window.onload=function(){window.print()}</script>
</body></html>`

          const win = window.open('', '_blank', 'width=900,height=700')
          if (win) { win.document.write(html); win.document.close() }
        }

        return (
        <Card className={`${matAccent.card} flex flex-col overflow-hidden`}>
          {(dispatchRows.length > 0 || orderRows.length > 0) && (
            <div className="order-2 border-b bg-white px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">⚡ Acciones pendientes</span>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setMaterialActionFilter(materialActionFilter === 'dispatch' ? 'all' : 'dispatch')}
                  className={`h-auto flex-col items-start gap-0.5 px-3 py-2 rounded-lg border-1.5 font-semibold transition ${
                    materialActionFilter === 'dispatch'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <Send className="h-3.5 w-3.5 flex-shrink-0" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold leading-none tabular-nums">{formatLocaleInteger(locale, dispatchRows.length)}</span>
                    <span className="text-[10px] uppercase tracking-wide leading-none">Despachar</span>
                  </div>
                  <span className="text-[9px] opacity-85">desde stock</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setMaterialActionFilter(materialActionFilter === 'order' ? 'all' : 'order')}
                  className={`h-auto flex-col items-start gap-0.5 px-3 py-2 rounded-lg border-1.5 font-semibold transition ${
                    materialActionFilter === 'order'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <ShoppingBag className="h-3.5 w-3.5 flex-shrink-0" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold leading-none tabular-nums">{formatLocaleInteger(locale, orderRows.length)}</span>
                    <span className="text-[10px] uppercase tracking-wide leading-none">Pedir</span>
                  </div>
                  <span className="text-[9px] opacity-85">re-ordenar</span>
                </Button>

                <div className="ml-auto flex items-center gap-1">
                  {materialActionFilter !== 'all' && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setMaterialActionFilter('all')}>
                      Limpiar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={handlePrintPendingActions}
                  >
                    <Printer className="mr-1 h-3.5 w-3.5" />
                    Imprimir pendientes
                  </Button>
                </div>
              </div>
              <div className="hidden">
                {dispatchRows.slice(0, 3).map((row) => (
                  <button
                    key={`dispatch-${row.mat.id}`}
                    type="button"
                    className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-white px-3 py-2 text-left hover:bg-emerald-50"
                    onClick={() => { setQuickMat(row.mat); setQuickMode('dispatch') }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.mat.product.name}</span>
                      <span className="text-xs text-muted-foreground">Need {formatLocaleInteger(locale, Math.min(row.gap, row.inStock + row.cuttableStock))} to dispatch</span>
                    </span>
                    <Send className="h-4 w-4 shrink-0 text-emerald-700" />
                  </button>
                ))}
                {orderRows.slice(0, 3).map((row) => (
                  <button
                    key={`order-${row.mat.id}`}
                    type="button"
                    className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-white px-3 py-2 text-left hover:bg-blue-50"
                    onClick={() => { setQuickMat(row.mat); setQuickMode('request'); setQuickSupplierId('') }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.mat.product.name}</span>
                      <span className="text-xs text-muted-foreground">Need {formatLocaleInteger(locale, row.uncovered)} to order</span>
                    </span>
                    <ShoppingBag className="h-4 w-4 shrink-0 text-blue-700" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Toolbar slim: contador + barra de cobertura global + print/export */}
          {/* Calcular cobertura global para visualización */}
          {(() => {
            let coveredCount = 0, partialCount = 0, missingCount = 0
            for (const mat of project.materials) {
              const coverage = getMaterialCoverage(mat)
              if (coverage.uncovered === 0) coveredCount++
              else if (coverage.remaining > 0) partialCount++
              else missingCount++
            }
            const total = project.materials.length
            const covPct = total > 0 ? Math.round((coveredCount / total) * 100) : 0
            const partPct = total > 0 ? Math.round((partialCount / total) * 100) : 0
            const missPct = total > 0 ? Math.round((missingCount / total) * 100) : 0

            return (
            <div className="order-1 flex items-center justify-between gap-3 border-b bg-card px-4 py-2">
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                {t('projects.tabs.materials')}
              </span>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
                {visibleRows.length}{visibleRows.length !== project.materials.length ? ` / ${project.materials.length}` : ''}
              </span>

              {/* Global coverage bar */}
              <div className="flex-1 flex items-center gap-1.5">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden flex gap-0.5">
                  {coveredCount > 0 && <div className="bg-emerald-500" style={{ width: `${covPct}%` }} />}
                  {partialCount > 0 && <div className="bg-amber-400" style={{ width: `${partPct}%` }} />}
                  {missingCount > 0 && <div className="bg-rose-400" style={{ width: `${missPct}%` }} />}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePrintMaterials}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title={locale === 'es' ? 'Imprimir lista completa' : 'Print complete list'}
                >
                  <Printer className="h-3.5 w-3.5" />
                </Button>
                {visibleRows.length !== project.materials.length && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePrintFilteredMaterials}
                    className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100"
                    title={locale === 'es' ? `Imprimir filtrado (${visibleRows.length} elementos)` : `Print filtered (${visibleRows.length} items)`}
                  >
                    <PrinterCheck className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleExportMaterialsExcel()}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title={locale === 'es' ? 'Exportar lista a Excel' : 'Export materials to Excel'}
                  disabled={visibleRows.length === 0}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            )
          })()}
          {/* Lista compacta — misma estética que en modo split */}
          <div className="order-3 h-[76vh] min-h-[560px] overflow-hidden">
            <MaterialsCompactView
              materials={materialRows.map<CompactMaterial>((row) => ({
                id: row.mat.id,
                productId: row.mat.productId,
                productName: row.mat.product.name,
                productCode: row.mat.product.code,
                section: row.mat.engineeringSection || row.mat.product?.engineeringSection || 'Sin sección',
                plannedQuantity: row.mat.plannedQuantity,
                dispatchedQuantity: row.mat.dispatchedQuantity,
                returnedQuantity: row.returned,
                notes: row.mat.notes ?? '',
                canDispatch: row.canDispatch,
                needsPurchase: row.needsPurchase,
                availableFromOtherProject: row.availableFromOtherProject,
                inStock: row.inStock,
                uncovered: row.uncovered,
                gap: row.gap,
                cuttableStock: row.cuttableStock,
                cutSourceLabel: row.bestCutSource?.code,
                cutSourceLength: row.bestCutSource?.sourceLength,
              }))}
              scrollStorageKey={`mat-materials-list-scroll-${project.id}`}
              isPostDispatch={isPostDispatch}
              search={matSearch}
              onSearchChange={setMatSearch}
              actionFilter={materialActionFilter}
              onActionFilterChange={setMaterialActionFilter}
              editingMaterialId={editingMaterialId}
              editingQty={editingQty}
              onEditingQtyChange={setEditingQty}
              onStartEdit={(mat) => {
                setEditingMaterialId(mat.id)
                setEditingQty(String(mat.plannedQuantity))
              }}
              onCancelEdit={() => {
                setEditingMaterialId(null)
                setEditingQty('')
              }}
              onSaveEdit={(matId, dispatched) => saveEdit(matId, dispatched)}
              isEditPending={editMaterialMutation.isPending}
              editingNoteMaterialId={editingNoteMaterialId}
              editingNote={editingNote}
              onEditingNoteChange={setEditingNote}
              onStartEditNote={(mat) => {
                setEditingNoteMaterialId(mat.id)
                setEditingNote(mat.notes)
              }}
              onCancelEditNote={() => {
                setEditingNoteMaterialId(null)
                setEditingNote('')
              }}
              onSaveEditNote={(matId) => saveNoteEdit(matId)}
              isEditNotePending={editMaterialNotesMutation.isPending}
              onDelete={(matId) => setDeleteMaterialId(matId)}
              onDispatch={(mat) => {
                const fullMat = project.materials.find((m) => m.id === mat.id)
                if (!fullMat) return
                setQuickMat(fullMat)
                setQuickMode('dispatch')
              }}
              onRequest={(mat) => {
                const fullMat = project.materials.find((m) => m.id === mat.id)
                if (!fullMat) return
                setQuickMat(fullMat)
                setQuickMode('request')
                setQuickSupplierId('')
              }}
              onSwitch={(mat) => {
                const fullMat = project.materials.find((m) => m.id === mat.id)
                if (fullMat) openSwitchMaterial(fullMat)
              }}
              onOpenReception={() => setDispatchRecepcionOpen(true)}
            />
          </div>
        </Card>
        )
      })()}
        </div>
        {splitView.enabled && !splitView.listCollapsed && (
          <SplitDragHandle containerRef={workspaceRef} onResize={splitView.setRatio} />
        )}
        {splitView.enabled && (
          <div className="min-h-0 min-w-0 overflow-hidden">
            <PlanPdfPane
              projectId={project.id}
              documents={(project.documents || []).map((d) => ({
                id: d.id,
                fileName: d.fileName,
                fileType: d.fileType,
                category: d.category,
              }))}
              selectedPlanId={splitView.selectedPlanId}
              onSelectPlan={splitView.setSelectedPlanId}
            />
          </div>
        )}
      </div>

      {/* Add Material Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <AddMaterialDialogContent
          availableProducts={availableProducts}
          projectColor={project.color || undefined}
          onAdd={(productId, quantity) =>
            addMaterialMutation.mutateAsync({ productId, plannedQuantity: quantity })
          }
          onClose={() => setAddDialogOpen(false)}
          isPending={addMaterialMutation.isPending}
        />
      </Dialog>

      <ProjectEngineeringDialog
        open={engineeringDialogOpen}
        onOpenChange={setEngineeringDialogOpen}
        mode={engineeringDialogMode}
        project={project}
        products={products}
        templates={templates}
        queryClient={queryClient}
      />

      {/* Request Materials Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-amber-500" />
              {t('projects.actions.requestMissingMaterials')}
            </DialogTitle>
            <DialogDescription>{t('projects.request.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Supplier selector */}
            {missingMaterials.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t('purchases.fields.supplierRequired')}</Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('purchases.fields.selectSupplier')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {suppliers && suppliers.length > 0 ? (
                        suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">{t('projects.request.noSuppliers')}</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-medium">
                    {t('projects.request.selectedCount', {
                      selected: formatLocaleInteger(locale, selectedMissingMaterials.length),
                      total: formatLocaleInteger(locale, missingMaterials.length),
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => setSelectedRequestProductIds(missingMaterials.map((item) => item.productId))}
                    >
                      {t('projects.request.selectAll')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => setSelectedRequestProductIds([])}
                    >
                      {t('projects.request.clearSelection')}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t('projects.request.selectionHelp')}
                </p>
              </div>
            )}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {missingMaterials.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p>{t('projects.request.noMissingMaterials')}</p>
                </div>
              ) : (
                missingMaterials.map((m) => (
                  <label
                    key={m.productId}
                    className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${
                      selectedRequestProductIds.includes(m.productId)
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-border bg-muted/40'
                    }`}
                  >
                    <Checkbox
                      checked={selectedRequestProductIds.includes(m.productId)}
                      onCheckedChange={(checked) => toggleRequestMaterialSelection(m.productId, checked === true)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.productName}</p>
                      <p className="text-xs text-muted-foreground">{m.productCode}</p>
                    </div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium tabular-nums">
                      {t('projects.request.missingCount', { count: formatLocaleInteger(locale, m.needed) })}
                    </Badge>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => requestMaterialsMutation.mutate()}
              disabled={missingMaterials.length === 0 || !selectedSupplierId || selectedMissingMaterials.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {t('projects.request.createSelectedOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Material Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteMaterialId}
        onOpenChange={() => setDeleteMaterialId(null)}
        onConfirm={() => deleteMaterialId && deleteMaterialMutation.mutate(deleteMaterialId)}
        title={t('projects.confirm.deleteMaterialTitle')}
        description={t('projects.confirm.deleteMaterialDescription')}
      >
        {(() => {
          const mat = project.materials.find((m) => m.id === deleteMaterialId)
          if (!mat) return null
          return (
            <div className="rounded-md border bg-muted/40 px-3 py-2.5 -mt-1">
              <p className="text-sm font-semibold text-foreground truncate">{mat.product.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{mat.product.code}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('projects.materials.table.planned')}: <span className="tabular-nums font-medium text-foreground">{mat.plannedQuantity}</span>
              </p>
            </div>
          )
        })()}
      </ConfirmDeleteDialog>

      <ConfirmDeleteDialog
        open={deleteAllMaterialsOpen}
        onOpenChange={setDeleteAllMaterialsOpen}
        onConfirm={() => deleteAllMaterialsMutation.mutate()}
        title={t('projects.confirm.deleteMaterialListTitle')}
        description={t('projects.confirm.deleteMaterialListDescription', {
          count: formatLocaleInteger(locale, project.materials.length),
        })}
      >
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <p className="font-semibold">{project.name}</p>
          <p className="mt-1 text-xs">
            {t('projects.confirm.deleteMaterialListWarning')}
          </p>
        </div>
      </ConfirmDeleteDialog>

      <Dialog
        open={!!switchingMaterial}
        onOpenChange={(open) => { if (!open) setSwitchingMaterial(null) }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChevronsUpDown className="h-4 w-4 text-blue-700" />
              {t('projects.actions.switchMaterial')}
            </DialogTitle>
            <DialogDescription>
              {switchingMaterial
                ? t('projects.switchMaterial.description', { product: switchingMaterial.product.name })
                : ''}
            </DialogDescription>
          </DialogHeader>

          {switchingMaterial ? (
            <div className="space-y-3">
              {/* Current material — referencia visual de qué se está reemplazando */}
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('projects.switchMaterial.current')}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">{switchingMaterial.product.name}</p>
                  <p className="text-xs text-muted-foreground">{switchingMaterial.product.code}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  ×{switchingMaterial.plannedQuantity}
                </span>
              </div>

              {/* Lista de reemplazos — un click = confirma directamente */}
              <Command className="rounded-md border">
                <CommandInput placeholder={t('projects.switchMaterial.searchPlaceholder')} />
                <CommandList className="max-h-64">
                  <CommandEmpty>{t('purchases.empty.noResults')}</CommandEmpty>
                  <CommandGroup>
                    {switchProductOptions.map((product) => {
                      const isSubmitting = switchMaterialMutation.isPending &&
                        switchMaterialMutation.variables?.productId === product.id
                      const stock = product._availableShelfStock ?? product._totalShelfStock ?? product.currentStock ?? 0
                      const planned = switchingMaterial.plannedQuantity
                      const stockClass = stock === 0
                        ? 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40 dark:text-rose-400'
                        : stock < planned
                          ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-400'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-400'
                      return (
                        <CommandItem
                          key={product.id}
                          value={`${product.name} ${product.code} ${product.family ?? ''} ${product.color ?? ''}`}
                          onSelect={() => {
                            if (switchMaterialMutation.isPending) return
                            switchMaterialMutation.mutate({
                              materialId: switchingMaterial.id,
                              productId: product.id,
                            })
                          }}
                          disabled={switchMaterialMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.code}
                              {product.family ? ` · ${product.family}` : ''}
                              {product.color ? ` · ${product.color}` : ''}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums ${stockClass}`}>
                            {stock}
                          </span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSwitchingMaterial(null)}
              disabled={switchMaterialMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog: Dispatch from stock OR Request from supplier */}
      <Dialog open={!!quickMat} onOpenChange={(open) => { if (!open) setQuickMat(null) }}>
        <DialogContent className="sm:max-w-lg">
          {quickMat && (() => {
            const alloc = computeQuickAllocation(quickMat, quickUseReserve)
            const { inStock, reservedStock, uncovered } = getMaterialCoverage(quickMat)
            const qProduct = products.find((p) => p.id === quickMat.productId)
            const qReceptionItems = pendingRecepcion.filter((item) => item.product?.id === quickMat.productId && item.quantity > 0)
            const qReceptionSources = qReceptionItems.map((item) => {
              const origin = item.purchase
                ? item.purchase.poNumber
                  ? `${item.purchase.poNumber} · ${item.purchase.purchaseCode}`
                  : item.purchase.purchaseCode
                : item.return?.project
                  ? `Return from ${item.return.project.poNumber || item.return.project.name}`
                  : 'Reception'

              return {
                sourceKey: `recepcion:${item.id}`,
                type: 'recepcion' as const,
                recepcionId: item.id,
                label: `Reception / ${origin}`,
                available: Number(item.quantity),
              }
            })
            // In reserve mode, show all stocks; otherwise only those with available qty
            const qWarehouseSources = (qProduct?.shelfStocks || [])
              .filter((s) => quickUseReserve ? Number(s.quantity) > 0 : Number(s.availableQuantity ?? s.quantity) > 0)
              .map((s) => ({
                sourceKey: `shelf:${s.shelfId}`,
                type: 'shelf' as const,
                shelfStock: s,
                shelfId: s.shelfId,
                label: `${s.shelf.rack.warehouse.name} / ${s.shelf.rack.name} / ${s.shelf.name}`,
                available: quickUseReserve ? Number(s.quantity) : Number(s.availableQuantity ?? s.quantity),
              }))
            const qAllSources = [...qReceptionSources, ...qWarehouseSources]
            const qMultiple = qAllSources.length > 1
            const qTotalSelected = Object.values(quickPickEdits).reduce((s, n) => s + (n || 0), 0)
            const qIsOver = qTotalSelected > alloc.gap
            const qSelectedSources = qMultiple
              ? Object.entries(quickPickEdits)
                  .filter(([, qty]) => qty > 0)
                  .map(([sourceKey, qty]) => ({ sourceKey, qty }))
              : qAllSources.slice(0, 1).map((source) => ({ sourceKey: source.sourceKey, qty: Math.min(source.available, alloc.gap) }))
            const qShelfPicks = qSelectedSources
              .map(({ sourceKey, qty }) => {
                const source = qWarehouseSources.find((s) => s.sourceKey === sourceKey)
                if (!source) return null
                const ss = source.shelfStock
                return { shelfId: source.shelfId, qty, allowReserve: quickUseReserve && (ss.isReserveShelf || (ss.reserveQuantity ?? 0) > 0) }
              })
              .filter((pick): pick is { shelfId: string; qty: number; allowReserve: boolean } => Boolean(pick))
            const qReceptionPicks = qSelectedSources
              .map(({ sourceKey, qty }) => {
                const source = qReceptionSources.find((s) => s.sourceKey === sourceKey)
                return source ? { id: source.recepcionId, qty } : null
              })
              .filter((pick): pick is { id: string; qty: number } => Boolean(pick))
            const qCanDispatch =
              qSelectedSources.length > 0 &&
              !qIsOver &&
              !quickDispatchMutation.isPending &&
              !quickReceptionDispatchMutation.isPending
            const toBuy = Math.min(uncovered, alloc.gap)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {quickMode === 'dispatch' ? (
                      <><Send className="h-5 w-5 text-emerald-600" /> {t('projects.actions.dispatchFromWarehouse')}</>
                    ) : (
                      <><ShoppingBag className="h-5 w-5 text-blue-600" /> {t('projects.actions.requestFromSupplier')}</>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    {quickMat.product.name} <span className="text-muted-foreground">({quickMat.product.code})</span>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-muted-foreground">{t('projects.quick.gap')}</p>
                      <p className="text-lg font-semibold">{alloc.gap}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-muted-foreground">{t('projects.quick.inWarehouse')}</p>
                      <p className="text-lg font-semibold text-emerald-700">{inStock}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-muted-foreground">{t('projects.quick.toBuy')}</p>
                      <p className="text-lg font-semibold text-blue-700">{toBuy}</p>
                    </div>
                  </div>

                  {/* Cut from longer source product — appears when there's no stock
                      of the planned product but a same-family/longer product exists.
                      Looks for sources in BOTH shelf stocks AND recepción items. */}
                  {quickMode === 'dispatch' && (() => {
                    const shelfSources = findCutSources(quickMat, products)
                    const recepcionSources = findRecepcionCutSources(quickMat, recepcionCutCandidates)
                    const cutSources = [...shelfSources, ...recepcionSources]
                    if (cutSources.length === 0) return null

                    const selectedSourceKey = cutFromRecepcionItemId
                      ? `recep:${cutFromRecepcionItemId}`
                      : cutFromProductId
                        ? `shelf:${cutFromProductId}`
                        : null
                    const selectedSource = cutSources.find((s) => s.sourceKey === selectedSourceKey)
                    const cutNeeded = alloc.gap
                    // For the cut plan, build a virtual source product from the selected source
                    const virtualSourceProduct = selectedSource
                      ? {
                          code: selectedSource.code,
                          name: selectedSource.name,
                          unitQuantity: selectedSource.unitSize,
                        }
                      : null
                    const cutPlan = virtualSourceProduct ? computeCutPlan(cutNeeded, quickMat.product, virtualSourceProduct) : null
                    const targetSize = cutPlan?.targetLength ?? detectCutLength(quickMat.product) ?? 0
                    const sourceSize = cutPlan?.sourceLength ?? selectedSource?.unitSize ?? 0
                    const piecesNeeded = cutPlan?.sourcePiecesNeeded ?? 0
                    const totalConsumed = piecesNeeded * sourceSize
                    const usedLength = cutNeeded * targetSize
                    const remainderLength = Math.max(0, totalConsumed - usedLength)

                    const selectSource = (src: CutSourceCandidate) => {
                      const isSelected = src.sourceKey === selectedSourceKey
                      if (isSelected) {
                        setCutFromProductId(null)
                        setCutFromShelfId(null)
                        setCutFromRecepcionItemId(null)
                      } else if (src.kind === 'recepcion') {
                        setCutFromProductId(null)
                        setCutFromShelfId(null)
                        setCutFromRecepcionItemId(src.recepcionItemId)
                      } else {
                        setCutFromRecepcionItemId(null)
                        setCutFromProductId(src.productId)
                        setCutFromShelfId(src.bestShelfId)
                      }
                    }

                    return (
                      <div className="rounded-lg border-2 border-dashed border-sky-300 bg-sky-50/60 p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Scissors className="h-4 w-4 text-sky-700" />
                          <span className="text-[11px] font-bold uppercase tracking-wide text-sky-900">
                            Cortar desde pieza más larga
                          </span>
                        </div>

                        {/* Sub-group: shelf candidates */}
                        {shelfSources.length > 0 && (
                          <>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 flex items-center gap-1.5 border-b border-emerald-200 pb-1">
                              <Layers className="h-3 w-3" /> En inventario (estantería)
                              <span className="ml-auto rounded bg-emerald-700 text-white px-1.5 py-0.5 text-[9px] font-bold">{shelfSources.length}</span>
                            </div>
                            <div className="space-y-1.5">
                              {shelfSources.map((src) => {
                                const isSelected = src.sourceKey === selectedSourceKey
                                return (
                                  <button
                                    key={src.sourceKey}
                                    type="button"
                                    onClick={() => selectSource(src)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md border-2 text-left transition ${
                                      isSelected
                                        ? 'border-sky-500 bg-white ring-2 ring-sky-200'
                                        : 'border-border bg-background hover:border-sky-300 hover:bg-sky-50'
                                    }`}
                                  >
                                    <span className="inline-flex h-8 w-10 items-center justify-center rounded bg-emerald-600 text-white text-[10px] font-bold font-mono">
                                      {src.unitSize}{src.unitSize > 0 ? "'" : ''}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                                        {src.code}
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">ESTANTE</span>
                                      </span>
                                      <span className="block text-[11px] text-muted-foreground font-mono truncate">
                                        {src.shelfLabel}
                                      </span>
                                    </span>
                                    <span className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white tabular-nums shrink-0">
                                      {src.totalPieces} pza{src.totalPieces !== 1 ? 's' : ''}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}

                        {/* Sub-group: recepción candidates */}
                        {recepcionSources.length > 0 && (
                          <>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-blue-800 flex items-center gap-1.5 border-b border-blue-200 pb-1">
                              <Inbox className="h-3 w-3" /> En recepción (recién recibido)
                              <span className="ml-auto rounded bg-blue-700 text-white px-1.5 py-0.5 text-[9px] font-bold">{recepcionSources.length}</span>
                            </div>
                            <div className="space-y-1.5">
                              {recepcionSources.map((src) => {
                                const isSelected = src.sourceKey === selectedSourceKey
                                return (
                                  <button
                                    key={src.sourceKey}
                                    type="button"
                                    onClick={() => selectSource(src)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md border-2 text-left transition ${
                                      isSelected
                                        ? 'border-sky-500 bg-white ring-2 ring-sky-200'
                                        : 'border-border bg-background hover:border-blue-300 hover:bg-blue-50'
                                    }`}
                                  >
                                    <span className="inline-flex h-8 w-10 items-center justify-center rounded bg-blue-600 text-white text-[10px] font-bold font-mono">
                                      {src.unitSize}{src.unitSize > 0 ? "'" : ''}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                                        {src.code}
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">📦 RECEPCIÓN</span>
                                      </span>
                                      <span className="block text-[11px] text-muted-foreground font-mono truncate">
                                        {src.shelfLabel}
                                      </span>
                                    </span>
                                    <span className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white tabular-nums shrink-0">
                                      {src.totalPieces} pza{src.totalPieces !== 1 ? 's' : ''}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}

                        {/* Visualization + remainder options when a source is selected */}
                        {selectedSource && cutNeeded > 0 && sourceSize > 0 && (
                          <div className="space-y-2.5 pt-1">
                            {/* Cut bar */}
                            <div className="rounded-md border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-2.5">
                              <div className="text-[10px] font-bold uppercase text-amber-800 mb-1.5">Resumen del corte</div>
                              <div className="relative h-7 rounded bg-slate-200 overflow-hidden flex">
                                <div
                                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-[11px] font-bold tabular-nums"
                                  style={{ width: `${totalConsumed > 0 ? (usedLength / totalConsumed) * 100 : 0}%` }}
                                >
                                  {cutNeeded} pza Ã— {targetSize}'
                                </div>
                                {remainderLength > 0 && (
                                  <div className="flex-1 bg-white/85 flex items-center justify-center text-slate-600 text-[11px] font-bold tabular-nums">
                                    {remainderLength}' sobrante
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-500 tabular-nums font-semibold mt-1">
                                <span>0'</span>
                                <span>{piecesNeeded} pza × {sourceSize}' = {totalConsumed}'</span>
                              </div>
                            </div>

                            {/* Remainder handling */}
                            {remainderLength > 0 && (
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold">¿Qué hacer con el sobrante de {remainderLength}'?</Label>
                                <div className="space-y-1">
                                  {([
                                    {
                                      value: 'short-piece',
                                      label: 'Guardar como pieza corta nueva',
                                      desc: 'Se crea/actualiza un producto con el sobrante en el mismo estante',
                                    },
                                    {
                                      value: 'reserved',
                                      label: 'Reservar para este proyecto',
                                      desc: 'Pieza completa asignada al proyecto, sobrante usable solo aquí',
                                    },
                                    {
                                      value: 'scrap',
                                      label: 'Desechar (scrap)',
                                      desc: 'Sobrante perdido',
                                    },
                                  ] as const).map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => setCutRemainderHandling(opt.value)}
                                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md border text-left text-xs transition ${
                                        cutRemainderHandling === opt.value
                                          ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200'
                                          : 'border-border bg-background hover:bg-muted/40'
                                      }`}
                                    >
                                      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${cutRemainderHandling === opt.value ? 'border-cyan-500' : 'border-muted-foreground/40'}`}>
                                        {cutRemainderHandling === opt.value && <span className="h-2 w-2 rounded-full bg-cyan-500" />}
                                      </span>
                                      <span className="flex-1">
                                        <span className="block font-semibold text-foreground">{opt.label}</span>
                                        <span className="block text-[10px] text-muted-foreground">{opt.desc}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Reserve stock toggle — only show when there is reserved stock */}
                  {quickMode === 'dispatch' && reservedStock > 0 && (
                    <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${quickUseReserve ? 'border-amber-300 bg-amber-50' : 'border-amber-200 bg-amber-50/40'}`}>
                      <div>
                        <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                          <Lock className="h-3 w-3" /> {reservedStock} en reserva protegida
                        </p>
                        <p className="text-[11px] text-amber-700/70">
                          {quickUseReserve ? 'Usando stock de reserva — úsalo con criterio' : 'No se asigna automáticamente a proyectos'}
                        </p>
                      </div>
                      <button
                        onClick={() => setQuickUseReserve((v) => !v)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${quickUseReserve ? 'bg-amber-500' : 'bg-input'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${quickUseReserve ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )}

                  {quickMode === 'dispatch' ? (
                    qAllSources.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{t('projects.quick.noShelfStock')}</p>
                        {!quickUseReserve && reservedStock > 0 && (
                          <p className="text-xs text-amber-700">Hay {reservedStock} unidades en reserva. Activa el toggle para usarlos.</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{t('projects.quick.takeFrom')}</Label>
                          {qMultiple && (
                            <span className={`text-xs tabular-nums font-medium ${
                              qIsOver ? 'text-rose-600' : qTotalSelected === alloc.gap ? 'text-emerald-700' : 'text-muted-foreground'
                            }`}>
                              {formatLocaleInteger(locale, qTotalSelected)} / {formatLocaleInteger(locale, alloc.gap)}
                            </span>
                          )}
                        </div>
                        <div className="rounded-md border divide-y">
                          {qAllSources.map((source) => {
                            const editQty = quickPickEdits[source.sourceKey] ?? 0
                            const displayAvailable = source.available
                            const isReservedEntry =
                              source.type === 'shelf' &&
                              (source.shelfStock.isReserveShelf || (source.shelfStock.reserveQuantity ?? 0) > 0)
                            return (
                              <div key={source.sourceKey} className={`flex items-center gap-3 px-3 py-2 ${source.type === 'recepcion' ? 'bg-emerald-50/60' : isReservedEntry && quickUseReserve ? 'bg-amber-50/50' : ''}`}>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm truncate flex items-center gap-1">
                                    {isReservedEntry && quickUseReserve && <Lock className="h-3 w-3 text-amber-500 shrink-0" />}
                                    {source.label}
                                  </p>
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {t('projects.quick.available')}: {formatLocaleInteger(locale, displayAvailable)}
                                    {source.type === 'recepcion' && (
                                      <span className="text-emerald-700 ml-1">(reception)</span>
                                    )}
                                    {source.type === 'shelf' && (source.shelfStock.reserveQuantity ?? 0) > 0 && !source.shelfStock.isReserveShelf && (
                                      <span className="text-amber-600 ml-1">({source.shelfStock.reserveQuantity} reservado)</span>
                                    )}
                                  </p>
                                </div>
                                {qMultiple ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    max={displayAvailable}
                                    value={editQty === 0 ? '' : editQty}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const v = Math.min(parseInt(e.target.value) || 0, displayAvailable)
                                      setQuickPickEdits((prev) => ({ ...prev, [source.sourceKey]: v }))
                                    }}
                                    className="h-8 w-20 text-right tabular-nums"
                                  />
                                ) : (
                                  <span className="font-semibold tabular-nums text-sm shrink-0">{Math.min(source.available, alloc.gap)}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {qIsOver && (
                          <p className="text-xs text-rose-600">
                            {t('projects.quick.overDispatch', { count: formatLocaleInteger(locale, qTotalSelected - alloc.gap) })}
                          </p>
                        )}
                        {alloc.shortage > 0 && qTotalSelected < alloc.gap && (
                          <p className="text-xs text-amber-700">
                            {t('projects.quick.shortage', { count: formatLocaleInteger(locale, alloc.shortage) })}
                          </p>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs">{t('purchases.fields.supplier')}</Label>
                      <Select value={quickSupplierId} onValueChange={setQuickSupplierId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('purchases.fields.selectSupplier')} />
                        </SelectTrigger>
                        <SelectContent>
                          {(suppliers || []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {toBuy === 1
                          ? t('projects.quick.requestOne', { count: formatLocaleInteger(locale, toBuy) })
                          : t('projects.quick.requestOther', { count: formatLocaleInteger(locale, toBuy) })}
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setQuickMat(null)}>{t('common.cancel')}</Button>
                  {quickMode === 'dispatch' ? (
                    <Button
                      onClick={async () => {
                        // Cross-cut from RECEPCIÓN path
                        if (cutFromRecepcionItemId && alloc.gap > 0) {
                          quickDispatchMutation.mutate({
                            productId: quickMat.productId,
                            picks: [{
                              shelfId: '', // not used for recepción cut
                              qty: alloc.gap,
                              cutFromRecepcionItemId,
                              remainderHandling: cutRemainderHandling,
                            }],
                          })
                          return
                        }
                        // Cross-cut from SHELF path: when user picked a longer source product to cut from
                        if (cutFromProductId && cutFromShelfId && alloc.gap > 0) {
                          quickDispatchMutation.mutate({
                            productId: quickMat.productId,
                            picks: [{
                              shelfId: cutFromShelfId,
                              qty: alloc.gap,
                              cutFromProductId,
                              cutFromShelfId,
                              remainderHandling: cutRemainderHandling,
                            }],
                          })
                          return
                        }
                        if (qReceptionPicks.length > 0) {
                          await quickReceptionDispatchMutation.mutateAsync({ items: qReceptionPicks })
                        }
                        if (qShelfPicks.length > 0) {
                          quickDispatchMutation.mutate({
                            productId: quickMat.productId,
                            picks: qShelfPicks,
                          })
                        } else if (qReceptionPicks.length > 0) {
                          setQuickMat(null)
                        }
                      }}
                      disabled={!qCanDispatch && !cutFromProductId && !cutFromRecepcionItemId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {(quickDispatchMutation.isPending || quickReceptionDispatchMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {(quickDispatchMutation.isPending || quickReceptionDispatchMutation.isPending) ? t('projects.actions.dispatching') : t('projects.actions.confirmDispatch')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        quickRequestMutation.mutate({
                          productId: quickMat.productId,
                          quantity: toBuy,
                          supplierId: quickSupplierId,
                        })
                      }
                      disabled={!quickSupplierId || toBuy <= 0 || quickRequestMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {quickRequestMutation.isPending ? t('projects.actions.creatingOrder') : t('projects.actions.createOrder')}
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Complementary purchase (another supplier) Dialog */}
      <Dialog open={!!complementMat} onOpenChange={(open) => { if (!open) setComplementMat(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-amber-600" />
              {t('projects.actions.complementaryPurchase')}
            </DialogTitle>
            <DialogDescription>
              {complementMat && (
                t('projects.complement.description', {
                  count: formatLocaleInteger(locale, complementQty),
                  product: complementMat.product.name,
                })
              )}
            </DialogDescription>
          </DialogHeader>
          {complementMat && (() => {
            const usedSupplierIds = suppliersUsedByProduct.get(complementMat.productId) || new Set<string>()
            const allSuppliers = suppliers || []
            const otherSuppliers = allSuppliers.filter((s) => !usedSupplierIds.has(s.id))
            const options = otherSuppliers.length > 0 ? otherSuppliers : allSuppliers
            return (
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('reports.common.quantity')}</label>
                  <Input
                    type="number"
                    min={1}
                    max={complementQty}
                    value={complementQty}
                    onChange={(e) => setComplementQty(Math.max(1, Math.min(complementQty || 1, parseInt(e.target.value) || 0)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {otherSuppliers.length === 0
                      ? t('projects.complement.supplierLabelNoOthers')
                      : t('purchases.fields.supplier')}
                  </label>
                  <select
                    className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    value={complementSupplierId}
                    onChange={(e) => setComplementSupplierId(e.target.value)}
                  >
                    <option value="">{t('purchases.fields.selectSupplier')}</option>
                    {options.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {usedSupplierIds.size > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {t('projects.complement.usedSuppliers', {
                        suppliers: allSuppliers.filter((s) => usedSupplierIds.has(s.id)).map((s) => s.name).join(', '),
                      })}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('projects.complement.unitPrice')}</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={complementUnitPrice}
                    onChange={(e) => setComplementUnitPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplementMat(null)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => {
                if (!complementMat) return
                if (!complementSupplierId) { toast.error(t('purchases.validation.selectSupplier')); return }
                if (complementQty <= 0) { toast.error(t('projects.validation.invalidQuantity')); return }
                complementMutation.mutate({
                  productId: complementMat.productId,
                  quantity: complementQty,
                  supplierId: complementSupplierId,
                  unitPrice: parseFloat(complementUnitPrice) || 0,
                })
              }}
              disabled={!complementSupplierId || complementQty <= 0 || complementMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {complementMutation.isPending ? t('projects.actions.creating') : t('projects.actions.createPurchase')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch from Recepción Dialog */}
      <Dialog
        open={dispatchRecepcionOpen}
        onOpenChange={(open) => {
          setDispatchRecepcionOpen(open)
          if (!open) setSelectedCrossProjectIds(new Set())
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-emerald-600" />
              {t('projects.actions.dispatchFromReception')}
            </DialogTitle>
            <DialogDescription>
              {t('projects.receptionDispatch.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* ─── Section A: Items belonging to this project ─── */}
            {pendingRecepcion.length === 0 && crossProjectRecepcion.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('projects.receptionDispatch.empty')}
              </p>
            ) : (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      Tu proyecto · {pendingRecepcion.length} {pendingRecepcion.length === 1 ? 'item' : 'items'}
                    </h4>
                  </div>
                  {pendingRecepcion.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                      Sin recepciones propias para este proyecto
                    </div>
                  ) : (
                    <div className="max-h-[30vh] overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>{t('reports.tables.product')}</TableHead>
                            <TableHead className="w-24 text-right">{t('reports.common.quantity')}</TableHead>
                            <TableHead className="w-40">{t('projects.receptionDispatch.origin')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingRecepcion.map((it) => (
                            <TableRow key={it.id}>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium">{it.product.name}</span>
                                  <span className="text-xs text-muted-foreground">{it.product.code}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {it.quantity} {it.product.unitOfMeasure}
                              </TableCell>
                              <TableCell>
                                {it.purchase ? (
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {it.purchase.poNumber
                                      ? `${it.purchase.poNumber} · ${it.purchase.purchaseCode}`
                                      : it.purchase.purchaseCode}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* ─── Section B: Cross-project suggestions ─── */}
                {crossProjectRecepcion.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <div className="mb-2 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          ¿Tomar de otros proyectos?
                        </h4>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                          Tu proyecto no cubre todos los materiales. Encontramos {crossProjectRecepcion.length} {crossProjectRecepcion.length === 1 ? 'item' : 'items'} en recepción de otros proyectos que podrían completarlo. Marca los que quieras consumir.
                        </p>
                      </div>
                    </div>
                    <div className="max-h-[24vh] overflow-y-auto rounded-md border bg-background">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>{t('reports.tables.product')}</TableHead>
                            <TableHead className="w-20 text-right">{t('reports.common.quantity')}</TableHead>
                            <TableHead className="w-40">Proyecto origen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {crossProjectRecepcion.map((it) => {
                            const checked = selectedCrossProjectIds.has(it.id)
                            return (
                              <TableRow
                                key={it.id}
                                className={`cursor-pointer ${checked ? 'bg-amber-50/60 dark:bg-amber-950/40' : ''}`}
                                onClick={() => {
                                  setSelectedCrossProjectIds((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(it.id)) next.delete(it.id)
                                    else next.add(it.id)
                                    return next
                                  })
                                }}
                              >
                                <TableCell className="py-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {}}
                                    className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-400 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium">{it.product.name}</span>
                                    <span className="text-xs text-muted-foreground">{it.product.code}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm">
                                  {it.quantity} {it.product.unitOfMeasure}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                    {it.sourceProjectName ?? 'Otro proyecto'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {t('projects.receptionDispatch.helper')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchRecepcionOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => dispatchRecepcionMutation.mutate()}
              disabled={(pendingRecepcion.length === 0 && selectedCrossProjectIds.size === 0) || dispatchRecepcionMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Send className="h-4 w-4" />
              {dispatchRecepcionMutation.isPending
                ? t('projects.actions.dispatching')
                : t('projects.receptionDispatch.confirm', { count: formatLocaleInteger(locale, pendingRecepcion.length + selectedCrossProjectIds.size) })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate BOM Dialog ───────────────────────────────────────────── */}
      <Dialog open={bomDialogOpen} onOpenChange={(open) => { if (!open) setBomDialogOpen(false) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-teal-600" />
              Generar lista de materiales automática
            </DialogTitle>
            <DialogDescription>
              {bomStep === 1 && 'Selecciona la fuente de los datos de ingeniería'}
              {bomStep === 2 && 'Confirma o edita las dimensiones de la estructura'}
              {bomStep === 3 && 'Revisa el BOM generado y ajusta cantidades antes de aplicar'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {(['1. Fuente', '2. Dimensiones', '3. Revisión'] as const).map((label, i) => (
              <span key={label} className={`flex items-center gap-1 ${bomStep === i + 1 ? 'text-teal-700 font-semibold' : ''}`}>
                {i > 0 && <span className="mx-1 text-border">›</span>}
                {label}
              </span>
            ))}
          </div>

          {/* ── Step 1: Source ─────────────────────────────────────────────── */}
          {bomStep === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Extraer de un plano PDF del proyecto</Label>
                <div className="flex gap-2">
                  <Select value={bomSelectedDoc} onValueChange={setBomSelectedDoc}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona un documento PDF…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(projectDocs ?? [])
                        .filter((d) => d.fileType === 'application/pdf' || d.fileName.endsWith('.pdf'))
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.fileName}</SelectItem>
                        ))}
                      {(projectDocs ?? []).filter((d) => d.fileType === 'application/pdf' || d.fileName.endsWith('.pdf')).length === 0 && (
                        <SelectItem value="_none" disabled>No hay PDFs subidos al proyecto</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleBomExtract}
                    disabled={!bomSelectedDoc || bomExtracting}
                    className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                  >
                    {bomExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {bomExtracting ? 'Extrayendo…' : 'Extraer con IA'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Claude leerá el plano y completará las dimensiones automáticamente</p>
              </div>

              <div className="relative flex items-center gap-3 py-1">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">o</span>
                <div className="flex-1 border-t" />
              </div>

              <Button variant="outline" className="w-full" onClick={() => setBomStep(2)}>
                Ingresar dimensiones manualmente
              </Button>
            </div>
          )}

          {/* ── Step 2: Dimensions form ────────────────────────────────────── */}
          {bomStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Ancho (ft) <span className="text-rose-500">*</span></Label>
                  <Input type="number" min={1} placeholder="ej. 20" value={bomForm.widthFt} onChange={(e) => setBomForm((f) => ({ ...f, widthFt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Profundidad (ft) <span className="text-rose-500">*</span></Label>
                  <Input type="number" min={1} placeholder="ej. 30" value={bomForm.depthFt} onChange={(e) => setBomForm((f) => ({ ...f, depthFt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Altura de pared (ft) <span className="text-rose-500">*</span></Label>
                  <Input type="number" min={1} placeholder="ej. 8" value={bomForm.wallHeightFt} onChange={(e) => setBomForm((f) => ({ ...f, wallHeightFt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Número de bahías <span className="text-rose-500">*</span></Label>
                  <Input type="number" min={1} placeholder="ej. 4" value={bomForm.bayCount} onChange={(e) => setBomForm((f) => ({ ...f, bayCount: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de techo <span className="text-rose-500">*</span></Label>
                  <Select value={bomForm.roofType} onValueChange={(v) => setBomForm((f) => ({ ...f, roofType: v as BomRoofType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hip">Hip</SelectItem>
                      <SelectItem value="gable">Gable</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Altura del pico (ft) <span className="text-muted-foreground text-xs">opcional</span></Label>
                  <Input type="number" min={0} placeholder="ej. 4" value={bomForm.roofPitchFt} onChange={(e) => setBomForm((f) => ({ ...f, roofPitchFt: e.target.value }))} />
                </div>
              </div>
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                Las fórmulas son estimaciones provisionales. Proporciona tus reglas exactas para calibrarlas.
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ────────────────────────────────────────────── */}
          {bomStep === 3 && bomResult && (
            <div className="space-y-3 py-1">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { label: 'Perímetro', value: `${bomResult.summary.perimeter} ft` },
                  { label: 'Área muros', value: `${bomResult.summary.wallArea.toFixed(0)} ft²` },
                  { label: 'Postes', value: String(bomResult.summary.totalPosts) },
                  { label: 'Bahías', value: String(bomResult.summary.totalBays) },
                ].map((s) => (
                  <span key={s.label} className="rounded-full border px-2 py-0.5 bg-muted text-muted-foreground">
                    {s.label}: <strong className="text-foreground">{s.value}</strong>
                  </span>
                ))}
              </div>

              {/* Warnings */}
              {bomResult.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}
                </div>
              ))}

              {/* Items table — editable quantities */}
              <div className="max-h-[40vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="w-20 text-right">Cant.</TableHead>
                      <TableHead className="w-14 text-right">Unid.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const sections = [...new Set(bomEditItems.map((i) => i.engineeringSection))]
                      return sections.flatMap((section) => {
                        const sectionItems = bomEditItems.filter((i) => i.engineeringSection === section)
                        return [
                          <TableRow key={`hdr-${section}`} className="bg-muted/40 hover:bg-muted/40">
                            <TableCell colSpan={3} className="py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {section || 'Otros'}
                            </TableCell>
                          </TableRow>,
                          ...sectionItems.map((item) => {
                            const globalIdx = bomEditItems.indexOf(item)
                            return (
                              <TableRow key={item.productId} className="group">
                                <TableCell>
                                  <p className="text-sm font-medium leading-none">{item.productName}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.productCode}</p>
                                  <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{item.calculationNote}</p>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1
                                      setBomEditItems((prev) => prev.map((it, i) => i === globalIdx ? { ...it, quantity: val } : it))
                                    }}
                                    className="h-7 w-16 text-right tabular-nums text-sm px-1"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">{item.unit}</TableCell>
                              </TableRow>
                            )
                          }),
                        ]
                      })
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Unmatched */}
              {bomResult.unmatched.length > 0 && (
                <div className="rounded-md border border-dashed border-rose-300 bg-rose-50 p-3 space-y-1">
                  <p className="text-xs font-semibold text-rose-700">Sin producto en catálogo:</p>
                  {bomResult.unmatched.map((u, i) => (
                    <p key={i} className="text-xs text-rose-600">• {u.description}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {bomStep === 1 && (
              <Button variant="outline" onClick={() => setBomDialogOpen(false)}>Cancelar</Button>
            )}
            {bomStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setBomStep(1)}>Atrás</Button>
                <Button onClick={handleBomCalculate} disabled={bomCalculating} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
                  {bomCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {bomCalculating ? 'Calculando…' : 'Calcular BOM'}
                </Button>
              </>
            )}
            {bomStep === 3 && (
              <>
                <Button variant="outline" onClick={() => setBomStep(2)}>Editar dimensiones</Button>
                <Button onClick={handleBomApply} disabled={bomApplying || !bomEditItems.length} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
                  {bomApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {bomApplying ? 'Aplicando…' : `Aplicar al proyecto (${bomEditItems.length} materiales)`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Dispatches Tab ───────────────────────────────────────────────────────────

function DispatchesTab({
  project,
  products,
  warehouses,
  queryClient,
}: {
  project: Project
  products: Product[]
  warehouses: WarehouseData[]
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const { locale, t } = useI18n()
  const [newDispatchOpen, setNewDispatchOpen] = useState(false)
  const [dispatchProductPickerOpen, setDispatchProductPickerOpen] = useState<number | null>(null)
  const [expandedDispatch, setExpandedDispatch] = useState<string | null>(null)
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0])
  const [dispatchNotes, setDispatchNotes] = useState('')
  const [dispatchItems, setDispatchItems] = useState<{ productId: string; shelfId: string; quantity: number }[]>([])

  const getPendingQuantityForProduct = (productId: string): number => {
    const material = project.materials.find((item) => item.productId === productId)
    if (!material) return 0
    return Math.max(material.plannedQuantity - material.dispatchedQuantity, 0)
  }

  const getSelectedQuantityForProduct = (
    items: { productId: string; shelfId: string; quantity: number }[],
    productId: string,
    excludeIdx?: number
  ): number =>
    items.reduce((sum, item, index) => {
      if (index === excludeIdx || item.productId !== productId) return sum
      return sum + Math.max(Number(item.quantity) || 0, 0)
    }, 0)

  const getSelectedQuantityForShelf = (
    items: { productId: string; shelfId: string; quantity: number }[],
    productId: string,
    shelfId: string,
    excludeIdx?: number
  ): number =>
    items.reduce((sum, item, index) => {
      if (index === excludeIdx || item.productId !== productId || item.shelfId !== shelfId) return sum
      return sum + Math.max(Number(item.quantity) || 0, 0)
    }, 0)

  const getRemainingPlannedForItem = (
    items: { productId: string; shelfId: string; quantity: number }[],
    idx: number
  ): number => {
    const item = items[idx]
    if (!item?.productId) return 0
    const pending = getPendingQuantityForProduct(item.productId)
    const alreadySelected = getSelectedQuantityForProduct(items, item.productId, idx)
    return Math.max(pending - alreadySelected, 0)
  }

  const createDispatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchDate, notes: dispatchNotes, items: dispatchItems }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || t('projects.toast.dispatchCreateError'))
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(t('projects.toast.dispatchCreated'))
      setNewDispatchOpen(false)
      resetDispatchForm()
    },
    onError: (err: Error) => toast.error(err.message || t('projects.toast.dispatchCreateError')),
  })

  const resetDispatchForm = () => {
    setDispatchDate(new Date().toISOString().split('T')[0])
    setDispatchNotes('')
    setDispatchItems([])
    setDispatchProductPickerOpen(null)
  }

  const getShelfOptions = (productId: string): ShelfOption[] => {
    const product = products.find((p) => p.id === productId)
    if (!product?.shelfStocks) return []
    return product.shelfStocks
      .filter((s) => s.quantity > 0)
      .map((s) => ({
        id: s.shelfId,
        name: s.shelf.name,
        warehouseName: s.shelf.rack.warehouse.name,
        rackName: s.shelf.rack.name,
        available: s.quantity,
      }))
  }

  const getShelfStock = (productId: string, shelfId: string): number => {
    const product = products.find((p) => p.id === productId)
    if (!product?.shelfStocks) return 0
    const stock = product.shelfStocks.find((s) => s.shelfId === shelfId)
    return stock?.quantity || 0
  }

  const getMaxDispatchQuantity = (
    items: { productId: string; shelfId: string; quantity: number }[],
    idx: number
  ): number => {
    const item = items[idx]
    if (!item?.productId || !item?.shelfId) return 0
    const shelfAvailable = getShelfStock(item.productId, item.shelfId)
    const shelfReserved = getSelectedQuantityForShelf(items, item.productId, item.shelfId, idx)
    const shelfRemaining = Math.max(shelfAvailable - shelfReserved, 0)
    const plannedRemaining = getRemainingPlannedForItem(items, idx)
    return Math.min(shelfRemaining, plannedRemaining)
  }

  const clampDispatchItem = (
    items: { productId: string; shelfId: string; quantity: number }[],
    idx: number
  ) => {
    const item = items[idx]
    if (!item) return items

    if (!item.shelfId) {
      if (item.quantity === 0) return items
      return items.map((entry, index) => (index === idx ? { ...entry, quantity: 0 } : entry))
    }

    const max = getMaxDispatchQuantity(items, idx)
    const quantity = Math.max(Number(item.quantity) || 0, 0)
    if (quantity === item.quantity && quantity <= max) return items

    return items.map((entry, index) =>
      index === idx ? { ...entry, quantity: Math.min(quantity, max) } : entry
    )
  }

  const addDispatchItem = () => {
    setDispatchItems((items) => [...items, { productId: '', shelfId: '', quantity: 0 }])
  }

  const removeDispatchItem = (idx: number) => {
    setDispatchItems((items) => items.filter((_, i) => i !== idx))
  }

  const updateDispatchItem = (idx: number, field: string, value: string | number) => {
    setDispatchItems((items) => {
      const next = items.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, [field]: value }
        // Reset shelfId when product changes
        if (field === 'productId') {
          updated.shelfId = ''
          updated.quantity = 0
        }
        return updated
      })
      return clampDispatchItem(next, idx)
    })
  }

  const setMaxQuantity = (idx: number) => {
    const max = getMaxDispatchQuantity(dispatchItems, idx)
    updateDispatchItem(idx, 'quantity', max)
  }

  const availableMaterialsForDispatch = project.materials.filter(
    (m) => getPendingQuantityForProduct(m.productId) > 0
  )

  const materialsWithShelfStock = availableMaterialsForDispatch.filter(
    (material) => getShelfOptions(material.productId).length > 0
  )

  const buildDispatchItemsFromWarehouse = () => {
    const items: { productId: string; shelfId: string; quantity: number }[] = []

    for (const material of materialsWithShelfStock) {
      let remaining = getPendingQuantityForProduct(material.productId)
      const shelfOptions = getShelfOptions(material.productId)
        .slice()
        .sort((a, b) => b.available - a.available)

      for (const shelf of shelfOptions) {
        if (remaining <= 0) break
        const quantity = Math.min(remaining, shelf.available)
        if (quantity <= 0) continue

        items.push({
          productId: material.productId,
          shelfId: shelf.id,
          quantity,
        })
        remaining -= quantity
      }
    }

    return items
  }

  const openNewDispatchDialog = () => {
    resetDispatchForm()
    setDispatchItems([{ productId: '', shelfId: '', quantity: 0 }])
    setNewDispatchOpen(true)
  }

  const loadAllDispatchableFromWarehouse = () => {
    resetDispatchForm()
    setDispatchItems(buildDispatchItemsFromWarehouse())
    setNewDispatchOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {project.dispatches.length === 1
            ? t('projects.dispatches.countOne', { count: formatLocaleInteger(locale, project.dispatches.length) })
            : t('projects.dispatches.countOther', { count: formatLocaleInteger(locale, project.dispatches.length) })}
        </h3>
        {materialsWithShelfStock.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadAllDispatchableFromWarehouse}
              disabled={materialsWithShelfStock.length === 0}
              className="gap-2"
            >
              <Check className="h-4 w-4" /> {t('projects.dispatches.loadAllStock')}
            </Button>
            <Button size="sm" onClick={openNewDispatchDialog} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Truck className="h-4 w-4" /> {t('projects.actions.newDispatch')}
            </Button>
          </div>
        )}
      </div>

      {project.dispatches.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={t('projects.dispatches.emptyTitle')}
          description={t('projects.dispatches.emptyDescription')}
          action={
            materialsWithShelfStock.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadAllDispatchableFromWarehouse}
                  disabled={materialsWithShelfStock.length === 0}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" /> {t('projects.dispatches.loadAllStock')}
                </Button>
                <Button size="sm" onClick={openNewDispatchDialog} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  <Truck className="h-4 w-4" /> {t('projects.actions.newDispatch')}
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {project.dispatches.map((dispatch) => (
            <Card key={dispatch.id} className="overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpandedDispatch(expandedDispatch === dispatch.id ? null : dispatch.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedDispatch === dispatch.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Truck className="h-4 w-4 text-amber-500" />
                          {t('projects.dispatches.itemTitle', { date: formatDate(locale, dispatch.dispatchDate) })}
                        </p>
                        {dispatch.notes && <p className="text-xs text-muted-foreground mt-0.5">{dispatch.notes}</p>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {dispatch.items.length === 1
                        ? t('projects.dispatches.productsOne', { count: formatLocaleInteger(locale, dispatch.items.length) })
                        : t('projects.dispatches.productsOther', { count: formatLocaleInteger(locale, dispatch.items.length) })}
                    </Badge>
                  </div>
                </CardContent>
              </button>

              {expandedDispatch === dispatch.id && (
                <div className="border-t bg-muted/30">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('reports.tables.product')}</TableHead>
                        <TableHead>{t('common.location')}</TableHead>
                        <TableHead className="text-right">{t('reports.common.quantity')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dispatch.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="text-sm font-medium">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{item.product.code}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.shelf ? (
                              <>
                                <span className="text-muted-foreground">{item.shelf.rack.warehouse.name}</span>
                                <span className="mx-1 text-muted-foreground">/</span>
                                <span className="text-muted-foreground">{item.shelf.rack.name}</span>
                                <span className="mx-1 text-muted-foreground">/</span>
                                <span className="font-medium">{item.shelf.name}</span>
                              </>
                            ) : (
                              <span className="italic text-muted-foreground">{t('projects.dispatches.directFromReception')}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New Dispatch Dialog */}
      <Dialog
        open={newDispatchOpen}
        onOpenChange={(open) => {
          setNewDispatchOpen(open)
          if (!open) setDispatchProductPickerOpen(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-amber-500" />
              {t('projects.actions.newDispatch')}
            </DialogTitle>
            <DialogDescription>{t('projects.dispatches.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('projects.dispatches.date')}</Label>
                <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('purchases.fields.notes')}</Label>
                <Input value={dispatchNotes} onChange={(e) => setDispatchNotes(e.target.value)} placeholder={t('purchases.fields.optionalNotes')} />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('projects.dispatches.itemsTitle')}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadAllDispatchableFromWarehouse}
                    disabled={materialsWithShelfStock.length === 0}
                    className="gap-1 h-7 text-xs"
                  >
                    <Check className="h-3 w-3" /> {t('projects.dispatches.loadAllStock')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={addDispatchItem} className="gap-1 h-7 text-xs">
                    <Plus className="h-3 w-3" /> {t('projects.dispatches.addItem')}
                  </Button>
                </div>
              </div>

              {dispatchItems.map((item, idx) => {
                const shelfOptions = item.productId ? getShelfOptions(item.productId) : []
                const maxQty = getMaxDispatchQuantity(dispatchItems, idx)
                const selectedMaterial = materialsWithShelfStock.find((material) => material.productId === item.productId)

                return (
                  <div key={idx} className="p-3 bg-muted/50 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('projects.dispatches.itemNumber', { count: formatLocaleInteger(locale, idx + 1) })}
                      </span>
                      {dispatchItems.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600" onClick={() => removeDispatchItem(idx)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('reports.tables.product')}</Label>
                        <Popover
                          open={dispatchProductPickerOpen === idx}
                          onOpenChange={(open) => setDispatchProductPickerOpen(open ? idx : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="h-9 w-full justify-between font-normal text-left"
                            >
                              {selectedMaterial ? (
                                <span className="min-w-0 flex-1 truncate">
                                  <span className="font-medium">{selectedMaterial.product.name}</span>
                                  <span className="ml-1.5 text-xs text-muted-foreground">
                                    ({selectedMaterial.product.code}) · {t('projects.dispatches.pendingLabel', {
                                      count: formatLocaleInteger(locale, getPendingQuantityForProduct(selectedMaterial.productId)),
                                    })}
                                  </span>
                                </span>
                              ) : (
                                <span className="flex-1 text-muted-foreground">
                                  {t('projects.dispatches.searchPlaceholder')}
                                </span>
                              )}
                              <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder={t('projects.dispatches.searchInputPlaceholder')}
                                className="h-9"
                                autoFocus
                              />
                              <CommandList className="max-h-[320px]">
                                <CommandEmpty>{t('purchases.empty.noResults')}</CommandEmpty>
                                <CommandGroup>
                                  {materialsWithShelfStock.map((material) => (
                                    <CommandItem
                                      key={material.productId}
                                      value={`${material.product.name} ${material.product.code}`}
                                      onSelect={() => {
                                        updateDispatchItem(idx, 'productId', material.productId)
                                        setDispatchProductPickerOpen(null)
                                      }}
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{material.product.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {material.product.code} · {t('projects.dispatches.pendingLabel', {
                                            count: formatLocaleInteger(locale, getPendingQuantityForProduct(material.productId)),
                                          })}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('warehouses.addShelf')}</Label>
                        <Select value={item.shelfId} onValueChange={(v) => updateDispatchItem(idx, 'shelfId', v)} disabled={!item.productId}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('common.selectExisting')} /></SelectTrigger>
                          <SelectContent className="max-h-60">
                            {shelfOptions.length === 0 ? (
                              <div className="p-2 text-xs text-muted-foreground text-center">{t('projects.dispatches.noStock')}</div>
                            ) : (
                              shelfOptions.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.warehouseName}/{s.rackName}/{s.name} ({s.available})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('reports.common.quantity')}</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={maxQty || undefined}
                            value={item.quantity || ''}
                            onChange={(e) => updateDispatchItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="h-9 text-sm"
                            disabled={!item.shelfId}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setMaxQuantity(idx)}
                            disabled={!item.shelfId}
                            title={t('projects.dispatches.maxAvailable')}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {item.shelfId && maxQty > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('projects.dispatches.maxLabel', { count: formatLocaleInteger(locale, maxQty) })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewDispatchOpen(false); resetDispatchForm() }}>{t('common.cancel')}</Button>
            <Button
              onClick={() => createDispatchMutation.mutate()}
              disabled={
                dispatchItems.length === 0 ||
                dispatchItems.some(
                  (item, idx) =>
                    !item.productId ||
                    !item.shelfId ||
                    item.quantity <= 0 ||
                    item.quantity > getMaxDispatchQuantity(dispatchItems, idx)
                )
              }
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {t('projects.actions.createDispatch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Returns Tab ──────────────────────────────────────────────────────────────

const CHANGE_TYPES = ['full_return', 'partial_exchange', 'damaged_replacement', 'upgrade_downgrade'] as const
const PARTIAL_REMNANT_CHANGE_TYPE = 'partial_remnant'

interface ExchangeForm {
  isExchange: boolean
  isPartialRemnant: boolean
  productIdReturned: string
  quantityReturned: number
  partialRemnantSize: number
  changeType: string
  specificationDelivered: string
  specificationReturned: string
  notes: string
}

function defaultExchange(): ExchangeForm {
  return { isExchange: false, isPartialRemnant: false, productIdReturned: '', quantityReturned: 0, partialRemnantSize: 0, changeType: 'full_return', specificationDelivered: '', specificationReturned: '', notes: '' }
}

function getFirstNumber(value: unknown) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const numberValue = Number(match[0])
  return Number.isFinite(numberValue) ? numberValue : null
}

function getLastNumber(value: unknown) {
  const matches = String(value ?? '').match(/\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) return null
  const numberValue = Number(matches[matches.length - 1])
  return Number.isFinite(numberValue) ? numberValue : null
}

function detectReturnOriginalSize(candidate: { unitQuantity?: string | number; name: string; code: string }) {
  const unitSize = getFirstNumber(candidate.unitQuantity)
  if (unitSize && unitSize > 0) return unitSize
  return getLastNumber(candidate.name) ?? getLastNumber(candidate.code)
}

// "INS-3X11-24'" → "INS-3X11"
// Strips the trailing "-<size>'?" or " <size>'?" pattern.
function stripTrailingSizeToken(value: string, size: number): string {
  const sizeStr = formatReturnSize(size)
  const escaped = sizeStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // matches "-24" or " 24" or "x24" at the end (optionally with quote/feet/inches sign)
  const pattern = new RegExp(`[\\s\\-xX]*${escaped}\\s*['"]?\\s*$`)
  return value.replace(pattern, '').trim()
}

// Find candidate "source" products to cut from for the given target material.
// A source candidate must:
//   - share the same "root" (code/name prefix without the trailing size token)
//   - have a unitSize STRICTLY larger than the target's unitSize
//   - have at least 1 piece of available stock somewhere
// Returns the best shelf (most stock) per candidate.
type CutSourceCandidate = {
  // Stable identifier per source — productId for shelf, recepcionItemId for recepción
  sourceKey: string
  kind: 'shelf' | 'recepcion'
  productId: string
  code: string
  name: string
  unitSize: number
  totalPieces: number
  // shelf-specific (empty for recepción)
  bestShelfId: string
  shelfLabel: string
  // recepción-specific (null for shelf)
  recepcionItemId: string | null
  recepcionOrigin: string | null // e.g. "PO-2026-014" / "Return from Project X"
}

function findCutSources(
  target: ProjectMaterial,
  products: Array<{
    id: string
    code: string
    name: string
    unitQuantity?: string | number
    shelfStocks?: Array<{
      shelfId: string
      quantity: string | number
      shelf: { name: string; rack: { name: string; warehouse: { name: string } } }
    }>
  }>,
): CutSourceCandidate[] {
  return findCuttableSourcesForTarget(
    {
      id: target.productId,
      code: target.product.code,
      name: target.product.name,
      color: target.product.color,
      unitQuantity: target.product.unitQuantity,
    },
    products as Product[],
  ).map<CutSourceCandidate>((source) => ({
    sourceKey: `shelf:${source.productId}`,
    kind: 'shelf',
    productId: source.productId,
    code: source.code,
    name: source.name,
    unitSize: source.sourceLength,
    totalPieces: source.totalSourcePieces,
    bestShelfId: source.bestShelfId,
    shelfLabel: source.shelfLabel,
    recepcionItemId: null,
    recepcionOrigin: null,
  }))
}

// Converts recepción cut candidates (from the dispatch-recepcion endpoint) into
// the same CutSourceCandidate shape used by the picker UI. Filtered to candidates
// whose targetProduct.id matches the dispatch dialog's planned product.
function findRecepcionCutSources(
  target: ProjectMaterial,
  candidates: ProjectRecepcionCutCandidate[],
): CutSourceCandidate[] {
  return candidates
    .filter((c) => c.targetProduct.id === target.productId)
    .map<CutSourceCandidate>((c) => ({
      sourceKey: `recep:${c.recepcionItemId}`,
      kind: 'recepcion',
      productId: c.sourceProduct.id,
      code: c.sourceProduct.code,
      name: c.sourceProduct.name,
      unitSize: c.originalSize,
      totalPieces: c.pieces,
      bestShelfId: '',
      shelfLabel: c.poNumber
        ? `PO ${c.poNumber}`
        : c.purchaseCode
          ? c.purchaseCode
          : c.sourceProjectName
            ? `Recepción · ${c.sourceProjectName}`
            : 'Recepción',
      recepcionItemId: c.recepcionItemId,
      recepcionOrigin: c.poNumber ?? c.purchaseCode ?? c.sourceProjectName ?? null,
    }))
    .sort((a, b) => a.unitSize - b.unitSize)
}

function formatReturnSize(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, '')
}

function previewRemnantName(value: string, originalSize: number | null, remnantSize: number) {
  if (!originalSize || !remnantSize) return ''
  const original = formatReturnSize(originalSize)
  const remnant = formatReturnSize(remnantSize)
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const dimensionPattern = new RegExp(`([xX])\\s*${escaped}(?=(?:['"]|\\b|\\s|$))`, 'g')
  let lastMatch: RegExpExecArray | null = null
  let match: RegExpExecArray | null
  while ((match = dimensionPattern.exec(value))) lastMatch = match
  if (lastMatch) {
    return `${value.slice(0, lastMatch.index)}${lastMatch[1]}${remnant}${value.slice(lastMatch.index + lastMatch[0].length)}`
  }
  return `${value} ${remnant}'`
}

function ReturnsTab({
  project,
  queryClient,
  warehouses,
}: {
  project: Project
  queryClient: ReturnType<typeof useQueryClient>
  warehouses: WarehouseData[]
}) {
  const { locale, t } = useI18n()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmReturnId, setConfirmReturnId] = useState<string | null>(null)
  // Placement por item: 'reception' (default), 'shelf:<shelfId>', o 'scrap'
  const [placements, setPlacements] = useState<Record<string, string>>({})
  // Para items en scrap: si se aplica el costo al proyecto (default true)
  const [scrapApplyCost, setScrapApplyCost] = useState<Record<string, boolean>>({})
  const [newReturnOpen, setNewReturnOpen] = useState(false)
  const [newReturnQty, setNewReturnQty] = useState<Record<string, number>>({})
  const [newReturnSearch, setNewReturnSearch] = useState('')
  const [newReturnNotes, setNewReturnNotes] = useState('')
  const [exchangeForms, setExchangeForms] = useState<Record<string, ExchangeForm>>({})
  const [adjustReturnTarget, setAdjustReturnTarget] = useState<{ returnId: string; status: string; item: ReturnItem } | null>(null)
  const [adjustReturnQty, setAdjustReturnQty] = useState('')

  // Fetch returns independently so this tab doesn't depend on a stale project include
  const { data: returnsData, isLoading: returnsLoading } = useQuery<Return[]>({
    queryKey: ['project-returns', project.id],
    queryFn: () => fetch(`/api/projects/${project.id}/returns`).then((r) => r.json()).then((d) => Array.isArray(d) ? d : []),
  })
  const returns: Return[] = Array.isArray(returnsData) ? returnsData : []

  // All products for the exchange product picker
  const { data: allProducts = [] } = useQuery<{ id: string; name: string; code: string }[]>({
    queryKey: ['products-list'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
    staleTime: 60_000,
  })

  const allShelves = useMemo(
    () =>
      warehouses.flatMap((w) =>
        w.racks.flatMap((r) =>
          r.shelves.map((s) => ({
            id: s.id,
            name: s.name,
            rackName: r.name,
            warehouseName: w.name,
          }))
        )
      ),
    [warehouses]
  )

  const pendingReturns = returns.filter((r) => r.status === 'pending')
  const completedReturns = returns.filter((r) => r.status === 'completed')

  // Total dispatched per product aggregated across dispatches
  const dispatchedByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const material of project.materials) {
      map.set(material.productId, toFiniteNumber(material.dispatchedQuantity))
    }
    return map
  }, [project.materials])

  // Pending returns reserve material that is still counted as dispatched.
  // Completed returns already decrement project.materials.dispatchedQuantity on confirm,
  // so subtracting them here would double-count the return.
  const pendingReturnByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of returns) {
      if (r.status !== 'pending') continue
      for (const it of r.items) {
        map.set(it.productIdDelivered, (map.get(it.productIdDelivered) || 0) + it.quantityDelivered)
      }
    }
    return map
  }, [returns])

  // Candidates for a new return: products dispatched but not yet returned in full
  const returnCandidates = useMemo(() => {
    const seen = new Set<string>()
    const out: {
      productId: string
      name: string
      code: string
      unitQuantity?: string | number
      dispatched: number
      alreadyReturned: number
      available: number
    }[] = []
    for (const material of project.materials) {
      if (seen.has(material.productId)) continue
      seen.add(material.productId)
      const dispatched = dispatchedByProduct.get(material.productId) || 0
      const alreadyReturned = pendingReturnByProduct.get(material.productId) || 0
      const available = Math.max(dispatched - alreadyReturned, 0)
      if (available > 0) {
        out.push({
          productId: material.productId,
          name: material.product.name,
          code: material.product.code,
          unitQuantity: material.product.unitQuantity,
          dispatched,
          alreadyReturned,
          available,
        })
      }
    }
    return out
  }, [project.materials, dispatchedByProduct, pendingReturnByProduct])

  const filteredReturnCandidates = useMemo(() => {
    const query = newReturnSearch.trim().toLowerCase()
    if (!query) return returnCandidates

    return returnCandidates.filter((candidate) =>
      candidate.name.toLowerCase().includes(query) ||
      candidate.code.toLowerCase().includes(query)
    )
  }, [newReturnSearch, returnCandidates])

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      const items = returnCandidates
        .filter((c) => (newReturnQty[c.productId] || 0) > 0)
        .map((c) => {
          const qtyDel = Math.min(newReturnQty[c.productId] || 0, c.available)
          const ex = exchangeForms[c.productId] || defaultExchange()
          const originalSize = detectReturnOriginalSize(c)
          const isPartialRemnant = ex.isPartialRemnant
          const remnantSize = Number(ex.partialRemnantSize || 0)
          return {
            productIdDelivered: c.productId,
            productIdReturned: ex.isExchange && !isPartialRemnant && ex.productIdReturned ? ex.productIdReturned : null,
            quantityDelivered: qtyDel,
            quantityReturned: (ex.isExchange || isPartialRemnant) && ex.quantityReturned > 0 ? ex.quantityReturned : qtyDel,
            changeType: isPartialRemnant ? PARTIAL_REMNANT_CHANGE_TYPE : (ex.isExchange ? ex.changeType : 'full_return'),
            isPartialRemnant,
            partialRemnantSize: isPartialRemnant ? remnantSize : undefined,
            specificationDelivered: ex.specificationDelivered || (isPartialRemnant && originalSize ? `${formatReturnSize(originalSize)} pies` : ''),
            specificationReturned: ex.specificationReturned || (isPartialRemnant && remnantSize > 0 ? `${formatReturnSize(remnantSize)} pies` : ''),
            notes: ex.notes,
          }
        })
      if (items.length === 0) throw new Error(t('projects.validation.selectMaterial'))
      const invalidRemnant = returnCandidates.find((c) => {
        const ex = exchangeForms[c.productId] || defaultExchange()
        if (!ex.isPartialRemnant || (newReturnQty[c.productId] || 0) <= 0) return false
        const originalSize = detectReturnOriginalSize(c)
        const remnantSize = Number(ex.partialRemnantSize || 0)
        return !originalSize || remnantSize <= 0 || remnantSize >= originalSize || (ex.quantityReturned || 0) <= 0
      })
      if (invalidRemnant) throw new Error(t('projects.returns.partialRemnantValidation'))
      const res = await fetch(`/api/projects/${project.id}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', notes: newReturnNotes, items }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('projects.toast.returnCreateError'))
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-returns', project.id] })
      toast.success(t('projects.toast.returnCreated'))
      setNewReturnOpen(false)
      setNewReturnQty({})
      setNewReturnNotes('')
      setExchangeForms({})
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openNewReturn = () => {
    const qty: Record<string, number> = {}
    const exForms: Record<string, ExchangeForm> = {}
    for (const c of returnCandidates) { qty[c.productId] = 0; exForms[c.productId] = defaultExchange() }
    setNewReturnQty(qty)
    setExchangeForms(exForms)
    setNewReturnSearch('')
    setNewReturnNotes('')
    setNewReturnOpen(true)
  }

  const confirmReturnMutation = useMutation({
    mutationFn: async ({
      returnId,
      placements,
    }: {
      returnId: string
      placements: {
        itemId: string
        destination: 'shelf' | 'reception' | 'scrap'
        shelfId: string | null
        applyCost?: boolean
      }[]
    }) => {
      const res = await fetch(`/api/projects/${project.id}/returns`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnId, placements }),
      })
      if (!res.ok) throw new Error('Failed to confirm return')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-returns', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      toast.success(t('projects.toast.returnConfirmed'))
      setConfirmOpen(false)
      setConfirmReturnId(null)
      setPlacements({})
      setScrapApplyCost({})
    },
    onError: () => toast.error(t('projects.toast.returnConfirmError')),
  })

  const adjustReturnMutation = useMutation({
    mutationFn: async () => {
      if (!adjustReturnTarget) return null
      const nextQty = Number(adjustReturnQty)
      if (!Number.isFinite(nextQty) || nextQty <= 0) throw new Error('La cantidad debe ser mayor que 0')
      const res = await fetch(`/api/projects/${project.id}/returns`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_item_quantity',
          returnId: adjustReturnTarget.returnId,
          itemId: adjustReturnTarget.item.id,
          quantityDelivered: nextQty,
          quantityReturned: nextQty,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo corregir la devolucion')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-returns', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      toast.success('Devolucion corregida')
      setAdjustReturnTarget(null)
      setAdjustReturnQty('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openConfirmDialog = (returnId: string) => {
    setConfirmReturnId(returnId)
    setPlacements({})
    setScrapApplyCost({})
    setConfirmOpen(true)
  }

  const canAdjustReturnItem = (item: ReturnItem) => item.returnDestination !== 'scrap'

  const getAdjustReturnDescription = () => {
    if (!adjustReturnTarget) return ''
    if (adjustReturnTarget.item.changeType === PARTIAL_REMNANT_CHANGE_TYPE) {
      return adjustReturnTarget.status === 'completed'
        ? 'Esta devolucion ya fue confirmada como sobrante/corte. Puedes aumentar la cantidad recibida y el sistema ajustara solo la diferencia en recepcion/inventario.'
        : 'Esta devolucion de sobrante/corte aun no esta confirmada. Puedes cambiar la cantidad antes de confirmarla.'
    }
    if (
      adjustReturnTarget.item.productReturned &&
      adjustReturnTarget.item.productReturned.id !== adjustReturnTarget.item.productIdDelivered
    ) {
      return adjustReturnTarget.status === 'completed'
        ? 'Esta devolucion ya fue confirmada como cambio de material. Puedes aumentar la cantidad y el sistema ajustara solo la diferencia.'
        : 'Este cambio de material aun no esta confirmado. Puedes cambiar la cantidad antes de confirmarlo.'
    }
    return adjustReturnTarget.status === 'completed'
      ? 'Esta devolucion ya fue confirmada. Puedes aumentar la cantidad y el sistema ajustara la diferencia en recepcion/inventario.'
      : 'Esta devolucion aun no esta confirmada. Puedes cambiar la cantidad antes de confirmarla.'
  }

  const openAdjustReturn = (ret: Return, item: ReturnItem) => {
    setAdjustReturnTarget({ returnId: ret.id, status: ret.status, item })
    setAdjustReturnQty(String(item.quantityReturned))
  }

  const returnToConfirm = returns.find((r) => r.id === confirmReturnId)

  const handleConfirmReturn = () => {
    if (!confirmReturnId || !returnToConfirm) return
    const payload = returnToConfirm.items.map((item) => {
      const value = placements[item.id] || '__recepcion__'
      if (value === '__scrap__') {
        return {
          itemId: item.id,
          destination: 'scrap' as const,
          shelfId: null,
          applyCost: scrapApplyCost[item.id] !== false,
        }
      }
      if (value === '__recepcion__') {
        return { itemId: item.id, destination: 'reception' as const, shelfId: null }
      }
      return { itemId: item.id, destination: 'shelf' as const, shelfId: value }
    })
    confirmReturnMutation.mutate({ returnId: confirmReturnId, placements: payload })
  }

  const setItemPlacement = (itemId: string, value: string) => {
    setPlacements((prev) => ({ ...prev, [itemId]: value }))
    if (value === '__scrap__') {
      setScrapApplyCost((prev) => (prev[itemId] === undefined ? { ...prev, [itemId]: true } : prev))
    }
  }

  const setItemApplyCost = (itemId: string, value: boolean) => {
    setScrapApplyCost((prev) => ({ ...prev, [itemId]: value }))
  }

  const hasUnresolvedShelfChoice = returnToConfirm?.items.some((i) => {
    const value = placements[i.id]
    if (!value || value === '__recepcion__' || value === '__scrap__') return false
    return !allShelves.find((s) => s.id === value)
  })

  const getEstimatedScrapCost = (item: {
    productIdDelivered: string
    productReturned?: { id: string } | null
    quantityReturned: number
  }) => {
    const returnedId = item.productReturned?.id ?? item.productIdDelivered
    // Los remanentes auto-creados no están en materials: usar el material del producto original.
    const mat = project.materials.find((m) => m.productId === returnedId)
      ?? project.materials.find((m) => m.productId === item.productIdDelivered)
    const price = mat?.product.referencePrice ?? 0
    return { amount: price * item.quantityReturned, unitPrice: price }
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {returns.length === 1
            ? t('projects.returns.countOne', { count: formatLocaleInteger(locale, returns.length) })
            : t('projects.returns.countOther', { count: formatLocaleInteger(locale, returns.length) })}
        </h3>
        <Button
          size="sm"
          onClick={openNewReturn}
          disabled={returnCandidates.length === 0 || returnsLoading}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('projects.actions.newReturn')}
        </Button>
      </div>

      {returnsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : returns.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title={t('projects.returns.emptyTitle')}
          description={
            returnCandidates.length > 0
              ? t('projects.returns.emptyWithCandidates')
              : t('projects.returns.emptyWithoutCandidates')
          }
        />
      ) : (
        <>
          {/* Pending Returns */}
          {pendingReturns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                {t('projects.returns.pendingTitle', { count: formatLocaleInteger(locale, pendingReturns.length) })}
              </h3>
              {pendingReturns.map((ret) => (
                <Card key={ret.id} className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                            <Clock className="h-3 w-3 mr-1" /> {t('status.purchase.pending')}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{formatDate(locale, ret.returnDate)}</span>
                        </div>
                        {ret.notes && <p className="text-xs text-muted-foreground mt-1">{ret.notes}</p>}
                      </div>
                      <Button size="sm" onClick={() => openConfirmDialog(ret.id)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Check className="h-3.5 w-3.5" /> {t('projects.actions.confirmReturn')}
                      </Button>
                    </div>

                    <div className="space-y-1">
                      {ret.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{item.productDelivered.name}</span>
                            {item.productReturned && item.productReturned.id !== item.productIdDelivered && (
                              <>
                                <Send className="h-3 w-3 text-violet-500 shrink-0" />
                                <span className="text-violet-700 font-medium truncate">{item.productReturned.name}</span>
                              </>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge variant="secondary" className="tabular-nums">
                              x{item.quantityReturned}
                            </Badge>
                            {canAdjustReturnItem(item) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => openAdjustReturn(ret, item)}
                              >
                                <Edit3 className="h-3 w-3" />
                                Corregir
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Completed Returns */}
          {completedReturns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                {t('projects.returns.completedTitle', { count: formatLocaleInteger(locale, completedReturns.length) })}
              </h3>
              {completedReturns.map((ret) => (
                <Card key={ret.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                        <Check className="h-3 w-3 mr-1" /> {t('projects.returns.completedBadge')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{formatDate(locale, ret.returnDate)}</span>
                      {ret.notes && <span className="text-xs text-muted-foreground">— {ret.notes}</span>}
                    </div>
                    <div className="space-y-1">
                      {ret.items.map((item) => {
                        const returned = item.productReturned ?? item.productDelivered
                        const isExchange = item.productReturned && item.productReturned.id !== item.productIdDelivered
                        const isScrap = item.returnDestination === 'scrap'
                        const dest = isScrap
                          ? 'Desechado / Merma'
                          : item.shelfTo
                            ? `${item.shelfTo.rack.warehouse.name} / ${item.shelfTo.name}`
                            : t('projects.returns.toReception')
                        const scrapPriceInfo = isScrap && item.scrapCharged ? getEstimatedScrapCost(item) : null
                        return (
                          <div key={item.id} className={`flex items-center justify-between text-sm py-1 border-b last:border-0 ${isScrap ? 'bg-rose-50/40 -mx-1 px-1 rounded' : ''}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {isExchange ? (
                                <>
                                  <span className="text-muted-foreground line-through truncate">{item.productDelivered.name}</span>
                                  <Send className="h-3 w-3 text-violet-500 shrink-0" />
                                  <span className="font-medium text-violet-700 truncate">{returned.name}</span>
                                </>
                              ) : (
                                <span className="font-medium truncate">{returned.name}</span>
                              )}
                              {isScrap ? (
                                <Badge className="ml-1 gap-1 bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50 shrink-0">
                                  <Trash2 className="h-3 w-3" /> Merma
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground shrink-0">→ {dest}</span>
                              )}
                              {scrapPriceInfo && scrapPriceInfo.amount > 0 && (
                                <span className="text-xs text-rose-700 shrink-0">
                                  · Cargado al proyecto {formatLocaleCurrency(locale, scrapPriceInfo.amount)}
                                </span>
                              )}
                              {isScrap && !item.scrapCharged && (
                                <span className="text-xs text-rose-700/70 shrink-0">· Sin cargar al proyecto</span>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Badge variant="secondary" className="tabular-nums">x{item.quantityReturned}</Badge>
                              {canAdjustReturnItem(item) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-xs"
                                  onClick={() => openAdjustReturn(ret, item)}
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Corregir
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Adjust Return Quantity Dialog */}
      <Dialog
        open={Boolean(adjustReturnTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustReturnTarget(null)
            setAdjustReturnQty('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-amber-500" />
              Corregir cantidad devuelta
            </DialogTitle>
            <DialogDescription>{getAdjustReturnDescription()}</DialogDescription>
          </DialogHeader>
          {adjustReturnTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-semibold">{adjustReturnTarget.item.productDelivered.name}</p>
                <p className="text-xs text-muted-foreground">{adjustReturnTarget.item.productDelivered.code}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cantidad actual: <span className="font-semibold text-foreground tabular-nums">{adjustReturnTarget.item.quantityReturned}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Cantidad correcta</Label>
                <Input
                  type="number"
                  min={adjustReturnTarget.status === 'completed' ? adjustReturnTarget.item.quantityReturned : 1}
                  step="1"
                  value={adjustReturnQty}
                  onChange={(event) => setAdjustReturnQty(event.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdjustReturnTarget(null)
                setAdjustReturnQty('')
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => adjustReturnMutation.mutate()}
              disabled={adjustReturnMutation.isPending || !adjustReturnQty}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {adjustReturnMutation.isPending ? 'Corrigiendo...' : 'Guardar correccion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Return Dialog */}
      <Dialog
        open={newReturnOpen}
        onOpenChange={(open) => {
          setNewReturnOpen(open)
          if (!open) setNewReturnSearch('')
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              {t('projects.actions.newReturn')}
            </DialogTitle>
            <DialogDescription>
              {t('projects.returns.newDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {returnCandidates.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={newReturnSearch}
                  onChange={(e) => setNewReturnSearch(e.target.value)}
                  placeholder={t('projects.returns.searchPlaceholder')}
                  className="pl-9"
                  autoFocus
                />
              </div>
            )}

            <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
            {returnCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('projects.returns.noneAvailable')}</p>
            ) : filteredReturnCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('projects.returns.noSearchResults')}</p>
            ) : (
              filteredReturnCandidates.map((c) => {
                const current = newReturnQty[c.productId] || 0
                const ex = exchangeForms[c.productId] || defaultExchange()
                const setEx = (patch: Partial<ExchangeForm>) =>
                  setExchangeForms((prev) => ({ ...prev, [c.productId]: { ...(prev[c.productId] || defaultExchange()), ...patch } }))
                return (
                  <div key={c.productId} className={`rounded-md border p-3 space-y-3 ${current > 0 && ex.isExchange ? 'border-violet-200 bg-violet-50/30' : ''}`}>
                    {/* Row header */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="text-muted-foreground shrink-0">({c.code})</span>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {t('projects.materials.table.dispatched')}: <span className="font-medium text-foreground tabular-nums">{c.dispatched}</span>
                        {c.alreadyReturned > 0 && (
                          <> · pendiente de confirmar: <span className="tabular-nums">{c.alreadyReturned}</span></>
                        )}
                        · {t('projects.returns.available')}: <span className="font-medium text-foreground tabular-nums">{c.available}</span>
                      </div>
                    </div>

                    {/* Quantity row */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={c.available}
                        value={current === 0 ? '' : current}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : Number(e.target.value)
                          setNewReturnQty((prev) => ({ ...prev, [c.productId]: Math.max(0, Math.min(v, c.available)) }))
                        }}
                        placeholder={t('projects.returns.zero')}
                        className="w-28"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewReturnQty((prev) => ({ ...prev, [c.productId]: c.available }))}
                      >
                        {t('projects.actions.all', { count: formatLocaleInteger(locale, c.available) })}
                      </Button>
                      {current > 0 && (
                        <div className="ml-auto flex items-center gap-2">
                          <Button
                            type="button"
                            variant={ex.isExchange ? 'default' : 'outline'}
                            size="sm"
                            className={`gap-1.5 ${ex.isExchange ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'text-violet-700 border-violet-300'}`}
                            onClick={() => setEx({ isExchange: !ex.isExchange, isPartialRemnant: false })}
                          >
                            <ChevronsUpDown className="h-3.5 w-3.5" />
                            {t('projects.returns.exchange')}
                          </Button>
                          <Button
                            type="button"
                            variant={ex.isPartialRemnant ? 'default' : 'outline'}
                            size="sm"
                            className={`gap-1.5 ${ex.isPartialRemnant ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'text-teal-700 border-teal-300'}`}
                            onClick={() => setEx({ isPartialRemnant: !ex.isPartialRemnant, isExchange: false, changeType: PARTIAL_REMNANT_CHANGE_TYPE, quantityReturned: ex.quantityReturned || 1 })}
                          >
                            <Package className="h-3.5 w-3.5" />
                            {t('projects.returns.partialRemnant')}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Exchange section */}
                    {current > 0 && ex.isPartialRemnant && (
                      <div className="space-y-2 rounded-md border border-teal-200 bg-teal-50/50 p-3">
                        <p className="text-xs font-medium text-teal-700">{t('projects.returns.partialRemnantTitle')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.originalSize')}</Label>
                            <div className="flex h-8 items-center rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground">
                              {detectReturnOriginalSize(c) ? `${formatReturnSize(detectReturnOriginalSize(c) || 0)} pies` : t('projects.returns.sizeNotDetected')}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.returnedSize')}</Label>
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              min={0}
                              value={ex.partialRemnantSize || ''}
                              onChange={(e) => setEx({ partialRemnantSize: Number(e.target.value), specificationReturned: e.target.value ? `${e.target.value} pies` : '' })}
                              placeholder="11"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.qtyReturned')}</Label>
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              min={1}
                              value={ex.quantityReturned || ''}
                              onChange={(e) => setEx({ quantityReturned: Number(e.target.value) })}
                              placeholder="1"
                            />
                          </div>
                        </div>
                        {ex.partialRemnantSize > 0 && (
                          <p className="text-xs text-teal-800">
                            {t('projects.returns.remnantPreview')}:{' '}
                            <span className="font-medium">
                              {previewRemnantName(c.name, detectReturnOriginalSize(c), ex.partialRemnantSize)}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    {current > 0 && ex.isExchange && (
                      <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/50 p-3">
                        <p className="text-xs font-medium text-violet-700">{t('projects.returns.exchangeTitle')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.changeType')}</Label>
                            <Select value={ex.changeType} onValueChange={(v) => setEx({ changeType: v })}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CHANGE_TYPES.map((ct) => (
                                  <SelectItem key={ct} value={ct} className="text-xs">
                                    {t(`projects.returns.changeTypes.${ct}` as Parameters<typeof t>[0])}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.productReturned')}</Label>
                            <Select value={ex.productIdReturned || '__none__'} onValueChange={(v) => setEx({ productIdReturned: v === '__none__' ? '' : v })}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={t('projects.returns.sameProduct')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs">{t('projects.returns.sameProduct')}</SelectItem>
                                {allProducts.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name} ({p.code})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.specDelivered')}</Label>
                            <Input className="h-8 text-xs" value={ex.specificationDelivered} onChange={(e) => setEx({ specificationDelivered: e.target.value })} placeholder="ej. 24 pies" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.specReturned')}</Label>
                            <Input className="h-8 text-xs" value={ex.specificationReturned} onChange={(e) => setEx({ specificationReturned: e.target.value })} placeholder="ej. 11 pies" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{t('projects.returns.qtyReturned')}</Label>
                            <Input className="h-8 text-xs" type="number" min={0} value={ex.quantityReturned || ''} onChange={(e) => setEx({ quantityReturned: Number(e.target.value) })} placeholder={String(current)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
            </div>
            <div className="space-y-1">
              <Label>{t('purchases.fields.notes')}</Label>
              <Textarea
                value={newReturnNotes}
                onChange={(e) => setNewReturnNotes(e.target.value)}
                placeholder={t('purchases.fields.optionalNotes')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewReturnOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => createReturnMutation.mutate()}
              disabled={
                createReturnMutation.isPending ||
                Object.values(newReturnQty).every((v) => !v || v <= 0)
              }
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {createReturnMutation.isPending ? t('projects.actions.creating') : t('projects.actions.createReturn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Return Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              {t('projects.actions.confirmReturn')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="pt-1 text-sm text-muted-foreground">
                {t('projects.returns.confirmDescription')}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {returnToConfirm?.items.map((item) => {
              const current = placements[item.id] || '__recepcion__'
              const returnedProduct = item.productReturned ?? item.productDelivered
              const isExchange = item.productReturned && item.productReturned.id !== item.productIdDelivered
              return (
                <div key={item.id} className={`rounded-md border p-3 space-y-2 ${isExchange ? 'border-violet-200' : ''}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {isExchange ? (
                        <>
                          <span className="text-muted-foreground line-through truncate">{item.productDelivered.name}</span>
                          <Send className="h-3 w-3 text-violet-500 shrink-0" />
                          <span className="font-medium text-violet-700 truncate">{returnedProduct.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium truncate">{returnedProduct.name}</span>
                          <span className="text-muted-foreground shrink-0">({returnedProduct.code})</span>
                        </>
                      )}
                    </div>
                    <Badge variant="secondary" className="tabular-nums shrink-0">x{item.quantityReturned}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={current === '__recepcion__' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setItemPlacement(item.id, '__recepcion__')}
                      className="gap-2 justify-start"
                    >
                      <Inbox className="h-3.5 w-3.5" />
                      {t('projects.returns.sendToReception')}
                    </Button>
                    <Select
                      value={current === '__recepcion__' || current === '__scrap__' ? '' : current}
                      onValueChange={(v) => setItemPlacement(item.id, v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={t('projects.returns.placeOnShelf')} />
                      </SelectTrigger>
                      <SelectContent>
                        {allShelves.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('projects.returns.noShelves')}</div>
                        ) : (
                          allShelves.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.warehouseName} / {s.rackName} / {s.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setItemPlacement(item.id, '__scrap__')}
                      className={`gap-2 justify-start ${
                        current === '__scrap__'
                          ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-100 hover:bg-rose-50'
                          : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Merma
                    </Button>
                  </div>
                  {current === '__scrap__' && (() => {
                    const { amount, unitPrice } = getEstimatedScrapCost(item)
                    const applyCost = scrapApplyCost[item.id] !== false
                    return (
                      <div className="mt-2 flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setItemApplyCost(item.id, !applyCost)}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            applyCost
                              ? 'border-rose-600 bg-rose-600 text-white'
                              : 'border-rose-300 bg-white'
                          }`}
                          aria-label="Aplicar costo al proyecto"
                        >
                          {applyCost && <Check className="h-3 w-3" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-rose-800">
                            Aplicar costo al proyecto
                          </div>
                          <div className="text-[11.5px] text-rose-700">
                            {unitPrice > 0 ? (
                              <>Se creará un gasto en categoría "Merma" por{' '}
                              <span className="font-bold tabular-nums">{formatLocaleCurrency(locale, amount)}</span>
                              <span className="text-rose-500"> ({item.quantityReturned} × {formatLocaleCurrency(locale, unitPrice)})</span></>
                            ) : (
                              <>Producto sin precio de referencia — se registrará como Merma sin monto.</>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleConfirmReturn}
              disabled={confirmReturnMutation.isPending || hasUnresolvedShelfChoice}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {confirmReturnMutation.isPending ? t('projects.actions.confirming') : t('projects.actions.confirmReturn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Document Category Config ─────────────────────────────────────────────────

const DOC_CATEGORY_CONFIG = [
  { id: 'invoice', icon: Receipt, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'sales_order', icon: ClipboardList, colorClass: 'text-blue-600', bgClass: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'engineering', icon: Layers, colorClass: 'text-violet-600', bgClass: 'bg-violet-50 dark:bg-violet-950/30' },
  { id: 'photos', icon: Camera, colorClass: 'text-amber-600', bgClass: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'other', icon: FileText, colorClass: 'text-slate-500', bgClass: 'bg-muted/50' },
]

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({
  project,
  queryClient,
}: {
  project: Project
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const { locale, t } = useI18n()
  const openDocumentViewer = useDocumentViewerStore((state) => state.openViewer)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCategory, setUploadingCategory] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<{ doc: ProjectDocument; mode: 'cut' | 'copy' } | null>(null)
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null)
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const uploadMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', category)
      const res = await fetch(`/api/projects/${project.id}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(error?.error || t('projects.toast.documentUploadError'))
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.documentUploaded'))
      setUploading(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('projects.toast.documentUploadError'))
      setUploading(false)
    },
  })

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/projects/${project.id}/documents/${docId}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(error?.error || t('projects.toast.documentDeleteError'))
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.documentDeleted'))
      setDeleteDocId(null)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('projects.toast.documentDeleteError')),
  })

  const archiveInvoiceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}/archive-invoice`, { method: 'POST' })
      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(error?.error || t('projects.toast.invoiceArchiveError'))
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.invoiceArchived'))
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('projects.toast.invoiceArchiveError')),
  })

  const moveDocMutation = useMutation({
    mutationFn: async ({ docId, category }: { docId: string; category: string }) => {
      const res = await fetch(`/api/projects/${project.id}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al mover')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.documentMoved'))
      setClipboard(null)
      setSelectedDocId(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Error al mover'),
  })

  const copyDocMutation = useMutation({
    mutationFn: async ({ docId, category }: { docId: string; category: string }) => {
      const res = await fetch(`/api/projects/${project.id}/documents/${docId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al copiar')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.documentCopied'))
      setClipboard(null)
      setSelectedDocId(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Error al copiar'),
  })

  const renameDocMutation = useMutation({
    mutationFn: async ({ docId, fileName }: { docId: string; fileName: string }) => {
      const res = await fetch(`/api/projects/${project.id}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al renombrar')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.toast.documentRenamed'))
      setRenamingDocId(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Error al renombrar'),
  })

  const startRename = (doc: ProjectDocument) => {
    setRenamingDocId(doc.id)
    setRenameValue(doc.fileName)
    setSelectedDocId(null)
  }

  const submitRename = (docId: string) => {
    const original = docs.find((d) => d.id === docId)?.fileName ?? ''
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === original) {
      setRenamingDocId(null)
      return
    }
    renameDocMutation.mutate({ docId, fileName: trimmed })
  }

  const pasteToCategory = (targetCategory: string) => {
    if (!clipboard) return
    if (clipboard.mode === 'cut' && clipboard.doc.category === targetCategory) {
      toast.info(t('projects.toast.documentSameCategory'))
      return
    }
    if (clipboard.mode === 'cut') {
      moveDocMutation.mutate({ docId: clipboard.doc.id, category: targetCategory })
    } else {
      copyDocMutation.mutate({ docId: clipboard.doc.id, category: targetCategory })
    }
  }

  const isPasting = moveDocMutation.isPending || copyDocMutation.isPending

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedDocId) {
        const doc = (project.documents || []).find((d) => d.id === selectedDocId)
        if (doc) { setClipboard({ doc, mode: 'cut' }); e.preventDefault() }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedDocId) {
        const doc = (project.documents || []).find((d) => d.id === selectedDocId)
        if (doc) { setClipboard({ doc, mode: 'copy' }); e.preventDefault() }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard && hoveredCatId) {
        pasteToCategory(hoveredCatId)
        e.preventDefault()
      }
      if (e.key === 'Escape') {
        setClipboard(null)
        setSelectedDocId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocId, clipboard, hoveredCatId, project.documents])

  const triggerUpload = (category: string) => {
    setUploadingCategory(category)
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const category = uploadingCategory
    setUploading(true)
    try {
      await Promise.all(Array.from(files).map((file) => uploadMutation.mutateAsync({ file, category })))
    } catch {
      // handled by mutation
    }
    e.target.value = ''
  }

  const docs = project.documents || []
  const viewerDocuments = buildProjectViewerDocuments(project, locale, t)

  const openDocViewer = (docId?: string) => {
    openDocumentViewer({
      documents: viewerDocuments,
      initialDocumentId: docId,
      initialPanel: 'info',
      contextTitle: t('projects.viewer.contextTitle', { name: project.name }),
      contextPath: [t('projects.viewer.inventorySection'), t('navigation.page.projects'), project.name, t('projects.tabs.documents')],
      onDeleteDocument: async (document) => {
        const res = await fetch(`/api/projects/${project.id}/documents/${document.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const error = await res.json().catch(() => null)
          throw new Error(error?.error || t('projects.toast.documentDeleteError'))
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['project', project.id] }),
          queryClient.invalidateQueries({ queryKey: ['project'] }),
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
        ])
      },
    })
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv"
        onChange={handleFileSelect}
      />

      {/* ── Clipboard status bar ── */}
      {clipboard && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-xs">
          {clipboard.mode === 'cut' ? (
            <Scissors className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          )}
          <span className="font-medium truncate flex-1">
            {clipboard.mode === 'cut' ? t('projects.documents.clipboard.cut') : t('projects.documents.clipboard.copy')}
            {' '}
            <span className="font-mono text-muted-foreground">{clipboard.doc.fileName}</span>
          </span>
          <span className="text-muted-foreground hidden sm:inline">{t('projects.documents.clipboard.hint')}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 shrink-0"
            onClick={() => { setClipboard(null); setSelectedDocId(null) }}
            title={t('common.cancel')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {DOC_CATEGORY_CONFIG.map((cat) => {
          const catDocs = docs.filter((d) => (d.category || 'other') === cat.id)
          const isInvoice = cat.id === 'invoice'
          const isUploadingThis = uploading && uploadingCategory === cat.id
          const canPasteHere = !!clipboard && !(clipboard.mode === 'cut' && clipboard.doc.category === cat.id)

          return (
            <Card
              key={cat.id}
              className={`overflow-hidden flex flex-col transition-colors ${canPasteHere ? 'ring-1 ring-primary/40' : ''}`}
              onMouseEnter={() => setHoveredCatId(cat.id)}
              onMouseLeave={() => setHoveredCatId(null)}
            >
              {/* Section header */}
              <div className={`flex items-center justify-between px-3 py-2 border-b ${cat.bgClass}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <cat.icon className={`h-3.5 w-3.5 shrink-0 ${cat.colorClass}`} />
                  <span className="text-xs font-semibold truncate">
                    {t(`projects.documents.categories.${cat.id}` as Parameters<typeof t>[0])}
                  </span>
                  {catDocs.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4 tabular-nums shrink-0">
                      {catDocs.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {canPasteHere && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => pasteToCategory(cat.id)}
                      disabled={isPasting}
                      title={t('projects.documents.clipboard.pasteHere')}
                    >
                      {isPasting ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  {isInvoice && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100"
                      onClick={() => archiveInvoiceMutation.mutate()}
                      disabled={archiveInvoiceMutation.isPending}
                      title={t('projects.actions.archiveInvoice')}
                    >
                      {archiveInvoiceMutation.isPending ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => triggerUpload(cat.id)}
                    disabled={isUploadingThis}
                    title={t('projects.actions.uploadDocument')}
                  >
                    {isUploadingThis ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Document list or empty state */}
              {catDocs.length === 0 ? (
                <button
                  type="button"
                  className={`w-full flex items-center justify-center px-3 py-5 transition-colors ${canPasteHere ? 'hover:bg-primary/5 cursor-copy' : 'hover:bg-muted/30'}`}
                  onClick={() => canPasteHere ? pasteToCategory(cat.id) : triggerUpload(cat.id)}
                >
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    {canPasteHere
                      ? t('projects.documents.clipboard.pasteHere')
                      : isInvoice
                        ? t('projects.documents.invoiceEmptyHint')
                        : t('projects.documents.categoryEmpty')}
                  </p>
                </button>
              ) : (
                <div className="divide-y overflow-y-auto max-h-52">
                  {catDocs.map((doc) => {
                    const documentUrl = `/api/projects/${project.id}/documents/${doc.id}`
                    const isSelected = selectedDocId === doc.id
                    const isCut = clipboard?.mode === 'cut' && clipboard.doc.id === doc.id
                    const isRenaming = renamingDocId === doc.id

                    return (
                      <div
                        key={doc.id}
                        className={`group flex items-center gap-2 px-3 py-2 transition-colors
                          ${isCut ? 'opacity-40' : ''}
                          ${isRenaming ? 'bg-muted/60' : isSelected ? 'bg-primary/[0.07] ring-inset ring-1 ring-primary/30 cursor-pointer' : 'hover:bg-muted/40 cursor-pointer'}
                        `}
                        onClick={() => !isRenaming && setSelectedDocId(isSelected ? null : doc.id)}
                      >
                        <span className="text-sm shrink-0 leading-none">{getFileIcon(doc.fileType)}</span>
                        <div className="flex-1 min-w-0" onClick={(e) => isRenaming && e.stopPropagation()}>
                          {isRenaming ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); submitRename(doc.id) }}
                              className="flex items-center gap-1"
                            >
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') setRenamingDocId(null) }}
                                onBlur={() => submitRename(doc.id)}
                                className="flex-1 min-w-0 text-xs font-medium bg-transparent border-b border-primary outline-none py-0.5"
                              />
                              <button type="submit" className="hidden" />
                            </form>
                          ) : (
                            <p className="text-xs font-medium truncate leading-tight">{doc.fileName}</p>
                          )}
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatFileSize(doc.fileSize)} · {formatDate(locale, doc.uploadedAt)}
                          </p>
                        </div>
                        <div
                          className="flex shrink-0 items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isSelected && !clipboard && !isRenaming && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => setClipboard({ doc, mode: 'cut' })}
                                title="Cortar (Ctrl+X)"
                              >
                                <Scissors className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => setClipboard({ doc, mode: 'copy' })}
                                title="Copiar (Ctrl+C)"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {!isRenaming && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => startRename(doc)}
                              title={t('projects.actions.renameDocument')}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openDocViewer(doc.id)}
                            title={t('reports.common.open')}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <a href={`${documentUrl}?download=1`} title={t('purchases.actions.download')}>
                              <Download className="h-3 w-3" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-rose-600"
                            onClick={() => setDeleteDocId(doc.id)}
                            title={t('projects.actions.deleteDocument')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteDocId}
        onOpenChange={() => setDeleteDocId(null)}
        onConfirm={() => deleteDocId && deleteDocMutation.mutate(deleteDocId)}
        title={t('projects.confirm.deleteDocumentTitle')}
        description={t('projects.confirm.deleteDocumentDescription')}
      />
    </div>
  )
}

// ─── Add Material Dialog (with search + Enter-to-add-next) ────────────────────

function AddMaterialDialogContent({
  availableProducts,
  projectColor,
  onAdd,
  onClose,
  isPending,
}: {
  availableProducts: Product[]
  projectColor?: string
  onAdd: (productId: string, quantity: number) => Promise<unknown>
  onClose: () => void
  isPending: boolean
}) {
  const { locale, t } = useI18n()
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [addedCount, setAddedCount] = useState(0)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [bufferedMaterials, setBufferedMaterials] = useState<{ productId: string; quantity: string }[]>([])
  const [isBufferSubmitting, setIsBufferSubmitting] = useState(false)
  const qtyRef = useRef<HTMLInputElement | null>(null)

  const selected = availableProducts.find((p) => p.id === productId)
  const bufferedProducts = bufferedMaterials
    .map((item) => ({
      ...item,
      product: availableProducts.find((product) => product.id === item.productId),
    }))
    .filter((item): item is { productId: string; quantity: string; product: Product } => Boolean(item.product))

  const reset = () => {
    setProductId('')
    setQuantity('')
  }

  const toggleSelection = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const stageSelectedMaterials = () => {
    if (selectedProductIds.size === 0) return

    setBufferedMaterials((current) => {
      const existingIds = new Set(current.map((item) => item.productId))
      const next = [...current]

      for (const id of Array.from(selectedProductIds)) {
        if (existingIds.has(id)) continue
        next.push({ productId: id, quantity: '' })
      }

      return next
    })

    setSelectedProductIds(new Set())
    reset()
    setPopoverOpen(false)
  }

  const updateBufferedQuantity = (productId: string, nextQuantity: string) => {
    setBufferedMaterials((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: nextQuantity }
          : item
      )
    )
  }

  const removeBufferedMaterial = (productId: string) => {
    setBufferedMaterials((current) => current.filter((item) => item.productId !== productId))
  }

  const submitBuffered = async (close: boolean) => {
    if (bufferedProducts.length === 0 || isBufferSubmitting) return

    const hasInvalidQuantity = bufferedProducts.some((item) => {
      const qty = parseInt(item.quantity, 10)
      return !qty || qty <= 0
    })

    if (hasInvalidQuantity) {
      toast.error(t('projects.validation.invalidQuantity'))
      return
    }

    setIsBufferSubmitting(true)
    let added = 0
    let failed = 0

    for (const item of bufferedProducts) {
      const qty = parseInt(item.quantity, 10)
      try {
        await onAdd(item.productId, qty)
        added++
      } catch {
        failed++
      }
    }

    setAddedCount((n) => n + added)
    setBufferedMaterials([])
    setSelectedProductIds(new Set())

    if (failed > 0) {
      toast.error(t('projects.addMaterial.bulkAddError', { count: formatLocaleInteger(locale, failed) }))
    }

    if (close) {
      onClose()
    } else {
      setPopoverOpen(true)
    }

    setIsBufferSubmitting(false)
  }

  const submit = async (close: boolean) => {
    const qty = parseInt(quantity)
    if (!productId || !qty || qty <= 0) return
    try {
      await onAdd(productId, qty)
      setAddedCount((n) => n + 1)
      if (close) {
        onClose()
      } else {
        reset()
        setPopoverOpen(true)
      }
    } catch {
      // toast handled upstream
    }
  }

  const handleQtyKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit(false)
    }
  }

  const hasBufferedMaterials = bufferedProducts.length > 0
  const hasInvalidBufferedQuantity = bufferedProducts.some((item) => {
    const qty = parseInt(item.quantity, 10)
    return !qty || qty <= 0
  })
  const isSubmitting = isPending || isBufferSubmitting

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-amber-500" />
          {t('projects.actions.addMaterial')}
        </DialogTitle>
        <DialogDescription>
          {t('projects.addMaterial.description')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-1">
        {addedCount > 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {addedCount === 1
              ? t('projects.addMaterial.addedOne', { count: formatLocaleInteger(locale, addedCount) })
              : t('projects.addMaterial.addedOther', { count: formatLocaleInteger(locale, addedCount) })}
          </div>
        )}

        <div className="space-y-2">
          <Label>{t('reports.tables.product')}</Label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between font-normal text-left"
              >
                {selected ? (
                  <span className="truncate flex-1">
                    <span className="font-medium">{selected.name}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      ({selected.code})
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground flex-1">
                    {t('projects.addMaterial.searchPlaceholder')}
                  </span>
                )}
                <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder={t('projects.addMaterial.searchInputPlaceholder')} className="h-9" autoFocus />
                <CommandList className="max-h-[220px]">
                  <CommandEmpty>
                    {availableProducts.length === 0
                      ? t('projects.addMaterial.allAdded')
                      : t('purchases.empty.noResults')}
                  </CommandEmpty>
                  {(() => {
                    const suggested = projectColor
                      ? availableProducts.filter((p) => p.color?.toLowerCase() === projectColor.toLowerCase())
                      : []
                    const others = projectColor
                      ? availableProducts.filter((p) => p.color?.toLowerCase() !== projectColor.toLowerCase())
                      : availableProducts

                    const renderItem = (p: Product, highlight: boolean) => {
                      const isChecked = selectedProductIds.has(p.id)
                      return (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.code} ${p.family ?? ''} ${p.engineeringSection ?? ''} ${p.color ?? ''}`}
                          onSelect={() => {
                            // Original single-select behavior: close popover, focus qty
                            setBufferedMaterials([])
                            setSelectedProductIds(new Set())
                            setProductId(p.id)
                            setPopoverOpen(false)
                            setTimeout(() => qtyRef.current?.focus(), 0)
                          }}
                          className="flex items-center gap-2"
                        >
                          {/* Checkbox zone — stopPropagation prevents CommandItem onSelect */}
                          <div
                            className="shrink-0 flex items-center justify-center h-4 w-4 rounded-sm border transition-colors"
                            style={{
                              backgroundColor: isChecked ? 'hsl(var(--primary))' : 'hsl(var(--background))',
                              borderColor: isChecked ? 'hsl(var(--primary))' : 'hsl(var(--input))',
                              color: isChecked ? 'hsl(var(--primary-foreground))' : 'transparent',
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelection(p.id)
                            }}
                            role="checkbox"
                            aria-checked={isChecked}
                            aria-label={`Select ${p.name}`}
                            tabIndex={-1}
                          >
                            {isChecked && <Check className="h-3 w-3" />}
                          </div>

                          {/* Item info — clicking here still triggers onSelect (single-add flow) */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{p.name}</span>
                              {p.color && (
                                <span className={`text-[10px] px-1.5 py-0 rounded shrink-0 font-medium ${
                                  highlight
                                    ? p.color === 'Blanco'
                                      ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {p.color}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{p.code}</span>
                              {p.engineeringSection && <span>Â· {p.engineeringSection}</span>}
                              {p.family && <span>· {p.family}</span>}
                              <span>· {t('projects.addMaterial.stockLabel', { count: formatLocaleInteger(locale, p.currentStock) })}</span>
                            </div>
                          </div>
                        </CommandItem>
                      )
                    }

                    return (
                      <>
                        {suggested.length > 0 && (
                          <CommandGroup heading={t('projects.addMaterial.suggestedHeading', { color: getProjectColorLabel(projectColor!, t) })}>
                            {suggested.map((p) => renderItem(p, true))}
                          </CommandGroup>
                        )}
                        <CommandGroup heading={suggested.length > 0 ? t('projects.addMaterial.otherProducts') : undefined}>
                          {others.map((p) => renderItem(p, false))}
                        </CommandGroup>
                      </>
                    )
                  })()}
                </CommandList>
              </Command>

              {/* Multi-select footer — only visible when items are checked */}
              {selectedProductIds.size > 0 && (
                <div className="border-t bg-background px-3 py-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    {formatLocaleInteger(locale, selectedProductIds.size)} {t('projects.addMaterial.selectedMaterialsTitle')}
                  </div>
                  <Button
                    className="h-9 w-full bg-amber-600 text-white hover:bg-amber-700"
                    onClick={stageSelectedMaterials}
                  >
                    {t('projects.addMaterial.multiContinue')}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {hasBufferedMaterials ? (
          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('projects.addMaterial.selectedMaterialsTitle')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('projects.addMaterial.multiQuantityHint')}
                </p>
              </div>
              <Badge variant="secondary" className="tabular-nums shrink-0">
                {formatLocaleInteger(locale, bufferedProducts.length)}
              </Badge>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {bufferedProducts.map((item) => (
                <div key={item.productId} className="rounded-md border bg-background p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-tight">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.product.code}
                        {item.product.engineeringSection ? ` - ${item.product.engineeringSection}` : ''}
                        {item.product.family ? ` - ${item.product.family}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={item.product.currentStock > 0 ? 'secondary' : 'outline'}
                        className="tabular-nums"
                      >
                        {t('projects.addMaterial.totalStock', {
                          count: formatLocaleInteger(locale, item.product.currentStock),
                        })}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeBufferedMaterial(item.productId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`buffered-qty-${item.productId}`}>
                      {t('projects.materials.table.planned')}
                    </Label>
                    <Input
                      id={`buffered-qty-${item.productId}`}
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => updateBufferedQuantity(item.productId, event.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : selected ? (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('projects.addMaterial.warehouseAvailability')}
              </span>
              <Badge variant={selected.currentStock > 0 ? 'secondary' : 'outline'} className="tabular-nums">
                {t('projects.addMaterial.totalStock', { count: formatLocaleInteger(locale, selected.currentStock) })}
              </Badge>
            </div>
            {selected.shelfStocks && selected.shelfStocks.filter((s) => s.quantity > 0).length > 0 ? (
              <div className="space-y-1">
                {selected.shelfStocks
                  .filter((s) => s.quantity > 0)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-sm bg-background px-2 py-1 text-xs"
                    >
                      <span className="text-muted-foreground truncate">
                        {s.shelf.rack.warehouse.name} / {s.shelf.rack.name} / {s.shelf.name}
                      </span>
                      <Badge variant="secondary" className="tabular-nums shrink-0">
                        {s.quantity}
                      </Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t('projects.addMaterial.noWarehouseStock')}
              </p>
            )}
          </div>
        ) : null}

        {!hasBufferedMaterials && (
          <div className="space-y-2">
            <Label>{t('projects.materials.table.planned')}</Label>
            <Input
              ref={qtyRef}
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={handleQtyKeyDown}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              {t('projects.addMaterial.enterHintPrefix')} <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">Enter</kbd> {t('projects.addMaterial.enterHintSuffix')}
            </p>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void (hasBufferedMaterials ? submitBuffered(false) : submit(false))}
          disabled={
            hasBufferedMaterials
              ? bufferedProducts.length === 0 || hasInvalidBufferedQuantity || isSubmitting
              : !productId || !quantity || isSubmitting
          }
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {isSubmitting ? t('projects.actions.adding') : t('projects.actions.addAndContinue')}
        </Button>
        <Button
          onClick={() => void (hasBufferedMaterials ? submitBuffered(true) : submit(true))}
          disabled={
            hasBufferedMaterials
              ? bufferedProducts.length === 0 || hasInvalidBufferedQuantity || isSubmitting
              : !productId || !quantity || isSubmitting
          }
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {isSubmitting ? t('projects.actions.adding') : t('projects.actions.addAndClose')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
