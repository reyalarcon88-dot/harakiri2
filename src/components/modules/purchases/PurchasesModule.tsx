'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ShoppingCart, Plus, Search, Trash2, FileDown,
  ArrowLeft, Upload, X, FileText, CheckCircle2, AlertTriangle,
  ChevronDown, Info, ChevronsUpDown, Check, PackagePlus,
  FileSearch, Loader2, RefreshCcw, FolderKanban,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'

import { matchInvoiceLines } from '@/lib/invoice-match'
import type { ExtractedLine, InvoiceMatchResult } from '@/lib/invoice-match'

import { useI18n } from '@/components/layout/I18nProvider'
import { EmptyState } from '@/components/shared/EmptyState'
import { PurchaseStatusBadge } from '@/components/shared/PurchaseStatusBadge'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { useDocumentViewerStore } from '@/stores/document-viewer'
import { useNavigationStore } from '@/stores/navigation'
import type { InventoryDocumentRecord } from '@/types/documents'
import { formatLocaleCurrency, formatLocaleDate, formatLocaleInteger } from '@/lib/i18n/format'
import type { MessageKey } from '@/lib/i18n/messages'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseItem {
  id: string
  productId: string
  shelfId: string | null
  quantity: number
  unitPrice: number
  priceSource: string
  notes: string
  product: { id: string; name: string; code: string; referencePrice?: number }
  shelf: { id: string; name: string; rack: { name: string; warehouse: { name: string } } } | null
}

interface PurchaseDocument {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
  uploadedAt: string
}

interface SupplierReturnRecord {
  id: string
  quantity: number
  reason: string
  notes: string
  createdAt: string
  product: { id: string; name: string; code: string }
}

interface Purchase {
  id: string
  purchaseCode: string
  poNumber: string
  supplierId: string
  purchaseDate: string
  notes: string
  status: string
  createdAt: string
  supplier: { id: string; name: string }
  items: PurchaseItem[]
  projectId: string | null
  project: { id: string; name: string } | null
  supplierReturns?: SupplierReturnRecord[]
  documents?: PurchaseDocument[]
  automation?: PurchaseAutomationResult | null
}

interface PurchaseAutomationResult {
  pdfSaved: boolean
  emailSent: boolean
  documentId?: string
  projectDocumentId?: string
  skippedEmailReason?: string
  error?: string
}

interface Supplier { id: string; name: string }
interface Product { id: string; name: string; code: string; currentStock: number; referencePrice?: number; color?: string; family?: string }
interface Warehouse {
  id: string; name: string
  racks: { id: string; name: string; shelves: { id: string; name: string }[] }[]
}
interface ShelfOption { id: string; name: string; rackName: string; warehouseName: string; label: string }
interface DraftItem { tempId: string; productId: string; quantity: number; unitPrice: number; shelfId: string | null; priceSource?: string; notes?: string }

interface InvoiceExtractionResult {
  vendor: string
  invoiceNumber: string
  invoiceDate: string
  currency: string
  lines: ExtractedLine[]
  _mock: boolean
}

interface MatchedInvoiceItem {
  result: InvoiceMatchResult
  purchaseItem: PurchaseItem | null
  selected: boolean
}

interface ProcessedExtraction {
  meta: Omit<InvoiceExtractionResult, 'lines'>
  matched: MatchedInvoiceItem[]
  unmatched: ExtractedLine[]
}

type RefPriceConfirmState =
  | { mode: 'single'; items: PurchaseItem[] }
  | { mode: 'bulk'; items: PurchaseItem[] }
  | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(locale: 'en' | 'es', value: number) {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: 'MXN',
    currencyDisplay: 'narrowSymbol',
  }).format(value)
}

function formatShortDate(locale: 'en' | 'es', value: string) {
  return formatLocaleDate(locale, value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function parseNonNegativeInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function getPurchaseStatusLabelKey(status: string): MessageKey {
  switch (status) {
    case 'pedido':
      return 'status.purchase.pedido'
    case 'pending':
      return 'status.purchase.pending'
    case 'received':
      return 'status.purchase.received'
    case 'cancelled':
      return 'status.purchase.cancelled'
    default:
      return 'status.purchase.pending'
  }
}

function getSupplierReturnReasonLabelKey(reason: string): MessageKey {
  switch (reason) {
    case 'wrong_item':
      return 'receiving.return.reason.wrongItem'
    case 'supplier_issue':
      return 'receiving.return.reason.supplierIssue'
    case 'other':
      return 'receiving.return.reason.other'
    case 'damaged':
    default:
      return 'receiving.return.reason.damaged'
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
function generateTempId() { return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

function PriceSourceBadge({ source }: { source: string }) {
  if (source === 'invoice') {
    return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Fact.</span>
  }
  if (source === 'manual') {
    return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">Man.</span>
  }
  return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">Ref.</span>
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.85) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (confidence >= 0.70) return 'bg-teal-50 text-teal-700 border-teal-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

function getPurchaseStatusAccent(status: string) {
  switch (status) {
    case 'pedido':    return { card: 'border-l-4 border-l-blue-400',    header: 'bg-blue-50/70',    bg: 'bg-blue-50/60' }
    case 'pending':   return { card: 'border-l-4 border-l-amber-400',   header: 'bg-amber-50/70',   bg: 'bg-amber-50/60' }
    case 'received':  return { card: 'border-l-4 border-l-emerald-400', header: 'bg-emerald-50/70', bg: 'bg-emerald-50/60' }
    case 'cancelled': return { card: 'border-l-4 border-l-rose-400',    header: 'bg-rose-50/70',    bg: 'bg-rose-50/60' }
    default:          return { card: '',                                 header: 'bg-muted/30',      bg: 'bg-card/95' }
  }
}

// ─── ProductCombobox ──────────────────────────────────────────────────────────

function ProductCombobox({
  value, onChange, products, placeholder,
}: {
  value: string
  onChange: (id: string, product?: Product) => void
  products?: Product[]
  placeholder?: string
}) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = products?.find((p) => p.id === value)
  const placeholderText = placeholder ?? t('purchases.fields.productPlaceholder')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal h-8 text-left px-2 text-sm"
        >
          {selected ? (
            <span className="truncate flex-1">
              <span>{selected.name}</span>
              <span className="text-muted-foreground ml-1.5 text-xs">({selected.code})</span>
            </span>
          ) : (
            <span className="text-muted-foreground flex-1">{placeholderText}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[460px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('purchases.fields.productSearchPlaceholder')} className="h-9" />
          <CommandList className="max-h-[360px]">
            <CommandEmpty>{t('purchases.empty.noResults')}</CommandEmpty>
            <CommandGroup>
              {products?.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.code} ${p.family ?? ''}`}
                  onSelect={() => { onChange(p.id, p); setOpen(false) }}
                  className="flex items-center gap-2"
                >
                  <Check className={`h-3.5 w-3.5 shrink-0 ${value === p.id ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{p.name}</span>
                      {p.color && (
                        <span className="text-[10px] px-1 py-0 rounded bg-muted text-muted-foreground shrink-0">{p.color}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{p.code}</span>
                      {p.family && <span>· {p.family}</span>}
                    </div>
                  </div>
                  {p.referencePrice ? (
                    <span className="text-xs font-medium shrink-0 tabular-nums">
                      {formatCurrency(locale, p.referencePrice)}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── InlineCell ───────────────────────────────────────────────────────────────

function InlineCell({
  value, onSave, fmt, min = 0, step = 1,
}: {
  value: number
  onSave: (v: number) => void
  fmt?: (v: number) => string
  min?: number
  step?: number
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.select(), 10) }, [editing])

  const commit = () => {
    const num = parseFloat(local)
    if (!isNaN(num) && num >= min && num !== value) onSave(num)
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={min}
        step={step}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-7 w-24 text-right text-sm ml-auto"
      />
    )
  }

  return (
    <button
      onClick={() => { setLocal(String(value)); setEditing(true) }}
      className="group flex items-center justify-end gap-1 w-full text-right hover:text-primary transition-colors cursor-pointer"
      title={t('purchases.inline.editHint')}
    >
      <span className={value === 0 && min === 0 ? 'text-muted-foreground' : ''}>
        {fmt ? fmt(value) : value || '-'}
      </span>
      <span className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity text-xs">✎</span>
    </button>
  )
}

// ─── ItemsTable (create / edit draft) ────────────────────────────────────────

function DraftItemsTable({
  items, products, shelfOptions, showPrice,
  onChange, onRemove, onAdd,
}: {
  items: DraftItem[]
  products?: Product[]
  shelfOptions: ShelfOption[]
  showPrice: boolean
  onChange: (tempId: string, field: keyof DraftItem, value: string | number | null) => void
  onRemove: (tempId: string) => void
  onAdd: () => void
}) {
  const { locale, t } = useI18n()
  const total = items.reduce((s, i) => s + i.quantity * (i.unitPrice || 0), 0)

  const itemsMissingPrice = showPrice
    ? items.filter((i) => i.productId && !i.unitPrice)
    : []

  const handleFillRefPrices = () => {
    for (const item of itemsMissingPrice) {
      const prod = products?.find((p) => p.id === item.productId)
      if (prod?.referencePrice) onChange(item.tempId, 'unitPrice', prod.referencePrice)
    }
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <PackagePlus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('purchases.draft.empty')}</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="py-2 w-[310px]">{t('reports.tables.product')}</TableHead>
                <TableHead className="py-2 w-[220px]">{t('purchases.fields.notes')}</TableHead>
                <TableHead className="py-2 w-[110px] text-right">{t('reports.common.quantity')}</TableHead>
                {showPrice && <TableHead className="py-2 w-[120px] text-right">{t('purchases.table.price')}</TableHead>}
                {showPrice && <TableHead className="py-2 w-[120px] text-right">{t('purchases.table.subtotal')}</TableHead>}
                <TableHead className="py-2 w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => {
                const isLast = idx === items.length - 1
                const enterAddsRow = (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && isLast) {
                    e.preventDefault()
                    onAdd()
                  }
                }
                return (
                <TableRow key={item.tempId} className="group">
                  <TableCell className="py-1.5 pl-2">
                    <div className="min-w-[280px]">
                    <ProductCombobox
                      value={item.productId}
                      onChange={(v, prod) => {
                        onChange(item.tempId, 'productId', v)
                        if (showPrice && prod?.referencePrice) {
                          onChange(item.tempId, 'unitPrice', prod.referencePrice)
                        }
                      }}
                      products={products}
                    />
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      value={item.notes || ''}
                      placeholder={t('purchases.fields.notes')}
                      onChange={(e) => onChange(item.tempId, 'notes', e.target.value)}
                      onKeyDown={!showPrice ? enterAddsRow : undefined}
                      className="h-8 w-full text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => onChange(item.tempId, 'quantity', parseNonNegativeInteger(e.target.value))}
                      onKeyDown={!showPrice ? enterAddsRow : undefined}
                      className="h-8 w-20 text-right ml-auto"
                    />
                  </TableCell>
                  {showPrice && (
                    <TableCell className="py-1.5">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice || ''}
                        placeholder={t('purchases.fields.pricePlaceholder')}
                        onChange={(e) => onChange(item.tempId, 'unitPrice', parseFloat(e.target.value) || 0)}
                        onKeyDown={enterAddsRow}
                        className="h-8 w-24 text-right ml-auto"
                      />
                    </TableCell>
                  )}
                  {showPrice && (
                    <TableCell className="py-1.5 text-right text-sm font-medium text-muted-foreground">
                      {item.unitPrice > 0 ? formatCurrency(locale, item.quantity * item.unitPrice) : '-'}
                    </TableCell>
                  )}
                  <TableCell className="py-1.5 pr-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onRemove(item.tempId)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t('purchases.actions.addProduct')}
          </Button>
          {itemsMissingPrice.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleFillRefPrices}
              className="gap-1.5 text-teal-700 hover:text-teal-800 hover:bg-teal-50 border border-teal-200">
              <RefreshCcw className="h-3 w-3" />
              Completar precios del catálogo
              <span className="ml-0.5 rounded-full bg-teal-100 px-1.5 text-[10px] font-semibold">{itemsMissingPrice.length}</span>
            </Button>
          )}
          {items.length > 0 && itemsMissingPrice.length === 0 && (
            <span className="text-xs text-muted-foreground">
              {t('purchases.draft.enterHintPrefix')} <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono">Enter</kbd> {t('purchases.draft.enterHintSuffix')}
            </span>
          )}
        </div>
        {showPrice && total > 0 && (
          <div className="text-right">
            <span className="text-sm text-muted-foreground mr-2">{t('purchases.common.total')}</span>
            <span className="font-semibold">{formatCurrency(locale, total)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PurchasesModule() {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const openDocumentViewer = useDocumentViewerStore((state) => state.openViewer)
  const targetPurchaseId = useNavigationStore((state) => state.targetPurchaseId)
  const clearNavigationTargets = useNavigationStore((state) => state.clearTargets)
  const openProject = useNavigationStore((state) => state.openProject)

  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [purchaseItemSearch, setPurchaseItemSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('')

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false)
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<PurchaseItem | null>(null)
  const [deleteDocumentTarget, setDeleteDocumentTarget] = useState<PurchaseDocument | null>(null)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  // Invoice review state
  const [invoiceReviewOpen, setInvoiceReviewOpen] = useState(false)
  const [invoiceExtracting, setInvoiceExtracting] = useState(false)
  const [processedExtraction, setProcessedExtraction] = useState<ProcessedExtraction | null>(null)
  const [refPriceConfirm, setRefPriceConfirm] = useState<RefPriceConfirmState>(null)
  const invoiceReviewTotals = useMemo(() => {
    if (!processedExtraction) {
      return { matched: 0, selected: 0, unmatched: 0, grandTotal: 0 }
    }

    const lineAmount = (line: ExtractedLine) => line.lineTotal ?? line.quantity * line.unitPrice
    const matched = processedExtraction.matched.reduce((sum, item) => sum + lineAmount(item.result.invoiceLine), 0)
    const selected = processedExtraction.matched.reduce(
      (sum, item) => sum + (item.selected ? lineAmount(item.result.invoiceLine) : 0),
      0
    )
    const unmatched = processedExtraction.unmatched.reduce((sum, line) => sum + lineAmount(line), 0)

    return { matched, selected, unmatched, grandTotal: matched + unmatched }
  }, [processedExtraction])

  // Add item inline row state
  const [addingRow, setAddingRow] = useState(false)
  const [addRowDraft, setAddRowDraft] = useState<DraftItem>({
    tempId: '', productId: '', quantity: 1, unitPrice: 0, shelfId: null, notes: '',
  })

  const [createForm, setCreateForm] = useState({
    supplierId: '',
    poNumber: '',
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    status: 'pedido' as string,
  })
  const [createItems, setCreateItems] = useState<DraftItem[]>([])

  const [editForm, setEditForm] = useState({ supplierId: '', poNumber: '', purchaseDate: '', notes: '' })
  const [editItems, setEditItems] = useState<DraftItem[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPurchaseItemSearch('')
  }, [selectedPurchaseId])

  useEffect(() => {
    if (!targetPurchaseId) return
    setSelectedPurchaseId(targetPurchaseId)
    clearNavigationTargets()
  }, [clearNavigationTargets, targetPurchaseId])

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases', searchTerm, statusFilter, supplierFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter) params.set('supplierId', supplierFilter)
      const res = await fetch(`/api/purchases?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch purchases')
      return res.json() as Promise<{ purchases: Purchase[]; statusCounts: Record<string, number> }>
    },
  })

  const { data: selectedPurchase, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ['purchase', selectedPurchaseId],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${selectedPurchaseId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t('purchases.empty.loadError'))
      }
      return res.json() as Promise<Purchase>
    },
    enabled: !!selectedPurchaseId,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<Supplier[]>
    },
  })

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<Product[]>
    },
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<Warehouse[]>
    },
  })

  const shelfOptions = useMemo<ShelfOption[]>(() => {
    if (!warehouses) return []
    return warehouses.flatMap((w) =>
      w.racks.flatMap((r) =>
        r.shelves.map((s) => ({
          id: s.id, name: s.name, rackName: r.name,
          warehouseName: w.name, label: `${s.name} / ${r.name} / ${w.name}`,
        }))
      )
    )
  }, [warehouses])

  const getReferencePrice = useCallback((item: PurchaseItem) => item.product.referencePrice || 0, [])

  const canApplyReferencePrice = useCallback((item: PurchaseItem) => {
    const referencePrice = getReferencePrice(item)
    if (referencePrice <= 0) return false
    if (item.priceSource === 'invoice') return false
    return !(item.priceSource === 'reference' && item.unitPrice === referencePrice)
  }, [getReferencePrice])

  const showPurchaseAutomationToast = useCallback((automation?: PurchaseAutomationResult | null) => {
    if (!automation) return
    if (automation.pdfSaved) {
      toast.success(
        automation.projectDocumentId
          ? 'PO PDF saved to the purchase and project documents'
          : 'PO PDF saved to the purchase documents'
      )
    } else if (automation.error) {
      toast.error(`PO PDF was not saved: ${automation.error}`)
    }

    if (automation.emailSent) {
      toast.success('PO email sent to supplier')
    } else if (automation.skippedEmailReason) {
      toast.info(`PO email not sent: ${automation.skippedEmailReason}`)
    }
  }, [])

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: {
      supplierId: string; purchaseDate: string; notes: string; status: string; poNumber?: string
      items: { productId: string; quantity: number; unitPrice: number; shelfId: string | null; priceSource?: string; notes?: string }[]
    }) => {
      const res = await fetch('/api/purchases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error') }
      return res.json() as Promise<Purchase>
    },
    onSuccess: (data) => {
      toast.success(t('purchases.toast.created'))
      showPurchaseAutomationToast(data.automation)
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setCreateDialogOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: {
      id: string; data: {
        supplierId?: string; purchaseDate?: string; notes?: string; status?: string; poNumber?: string
        items?: { productId: string; quantity: number; unitPrice: number; shelfId: string | null; priceSource?: string; notes?: string }[]
      }
    }) => {
      const res = await fetch(`/api/purchases/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error') }
      return res.json() as Promise<Purchase>
    },
    onSuccess: (_data, vars) => {
      toast.success(t('purchases.toast.updated'))
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['purchase', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setEditDialogOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
    },
    onSuccess: () => {
      toast.success(t('purchases.toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      setSelectedPurchaseId(null)
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    },
    onError: () => toast.error(t('purchases.toast.deleteError')),
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/purchases/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error') }
      return res.json() as Promise<Purchase>
    },
    onSuccess: (data, vars) => {
      toast.success(t('purchases.toast.statusUpdated'))
      showPurchaseAutomationToast(data.automation)
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['purchase', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setStatusDropdownOpen(false)
    },
    onError: (err: Error) => { toast.error(err.message); setStatusDropdownOpen(false) },
  })

  const patchItemMutation = useMutation({
    mutationFn: async ({ itemId, quantity, unitPrice, priceSource, notes }: { itemId: string; quantity?: number; unitPrice?: number; priceSource?: string; notes?: string }) => {
      const item = selectedPurchase!.items.find((i) => i.id === itemId)!
      const res = await fetch(`/api/purchases/${selectedPurchase!.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          quantity: quantity ?? item.quantity,
          unitPrice: unitPrice ?? item.unitPrice,
          shelfId: item.shelfId,
          priceSource: priceSource ?? (unitPrice !== undefined ? 'manual' : undefined),
          notes: notes ?? item.notes,
        }),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
    },
    onError: () => toast.error(t('purchases.toast.updateError')),
  })

  const applyReferencePricesMutation = useMutation({
    mutationFn: async (items: { itemId: string; unitPrice: number }[]) => {
      if (!selectedPurchaseId) throw new Error(t('purchases.toast.updateError'))

      const responses = await Promise.all(
        items.map(async ({ itemId, unitPrice }) => {
          const res = await fetch(`/api/purchases/${selectedPurchaseId}/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              unitPrice,
              priceSource: 'reference',
            }),
          })

          if (!res.ok) {
            const err = await res.json().catch(() => null)
            throw new Error(err?.error || t('purchases.toast.updateError'))
          }
        })
      )

      return { updated: responses.length }
    },
    onSuccess: (data) => {
      toast.success(
        t('purchases.toast.refPricesApplied', {
          count: formatLocaleInteger(locale, data.updated),
          itemLabel:
            data.updated === 1
              ? t('purchases.common.productSingular')
              : t('purchases.common.productPlural'),
        })
      )
      queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setRefPriceConfirm(null)
    },
    onError: (err: Error) => toast.error(err.message || t('purchases.toast.updateError')),
  })

  const addItemMutation = useMutation({
    mutationFn: async (data: { productId: string; quantity: number; unitPrice: number; shelfId: string | null; notes?: string }) => {
      const res = await fetch(`/api/purchases/${selectedPurchaseId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      toast.success(t('purchases.toast.itemAdded'))
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setAddingRow(false)
      setAddRowDraft({ tempId: '', productId: '', quantity: 1, unitPrice: 0, shelfId: null, notes: '' })
    },
    onError: () => toast.error(t('purchases.toast.addError')),
  })

  const deleteItemMutation = useMutation({
    mutationFn: async ({ purchaseId, itemId }: { purchaseId: string; itemId: string }) => {
      const res = await fetch(`/api/purchases/${purchaseId}/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
    },
    onSuccess: () => {
      toast.success(t('purchases.toast.itemDeleted'))
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] })
      setDeleteItemDialogOpen(false)
      setDeleteItemTarget(null)
    },
    onError: () => toast.error(t('purchases.toast.deleteError')),
  })

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ purchaseId, file }: { purchaseId: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/purchases/${purchaseId}/documents`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
    onSuccess: () => {
      toast.success(t('purchases.toast.documentUploaded'))
      if (selectedPurchaseId) queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] })
    },
    onError: () => toast.error(t('purchases.toast.documentUploadError')),
  })

  const deleteDocumentMutation = useMutation({
    mutationFn: async ({ docId }: { docId: string }) => {
      const res = await fetch(`/api/purchases/${selectedPurchaseId}/documents/${docId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
    },
    onSuccess: () => {
      toast.success(t('purchases.toast.documentDeleted'))
      if (selectedPurchaseId) queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] })
      setDeleteDocumentDialogOpen(false)
      setDeleteDocumentTarget(null)
    },
    onError: () => toast.error(t('purchases.toast.deleteError')),
  })

  const applyInvoicePricesMutation = useMutation({
    mutationFn: async (items: { purchaseItemId: string; unitPrice: number }[]) => {
      const res = await fetch(`/api/purchases/${selectedPurchaseId}/apply-invoice-prices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error') }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} precio(s) actualizados desde factura`)
      queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      setInvoiceReviewOpen(false)
      setProcessedExtraction(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ─── PDF ──────────────────────────────────────────────────────────────────

  const downloadPdf = useCallback(async (
    purchaseId: string,
    purchaseCode: string,
    deliverTo?: 'warehouse' | 'client' | 'custom',
    customAddress?: string,
  ) => {
    try {
      const params = new URLSearchParams()
      if (deliverTo) params.set('deliverTo', deliverTo)
      if (deliverTo === 'custom' && customAddress) params.set('customAddress', customAddress)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/purchases/${purchaseId}/pdf${qs}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || t('purchases.toast.pdfError'))
      }
      const blob = await res.blob()
      if (!blob || blob.size === 0) throw new Error(t('purchases.toast.pdfError'))
      const disposition = res.headers.get('content-disposition') || ''
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const downloadName = filenameMatch?.[1]
        ? decodeURIComponent(filenameMatch[1])
        : `RMC-${purchaseCode}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = downloadName
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success(t('purchases.toast.downloadStarted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('purchases.toast.pdfError'))
    }
  }, [t])

  const [customAddressDialogOpen, setCustomAddressDialogOpen] = useState(false)
  const [customAddressText, setCustomAddressText] = useState('')

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleExtractInvoice = async () => {
    if (!selectedPurchase) return
    setInvoiceExtracting(true)
    setInvoiceReviewOpen(true)
    setProcessedExtraction(null)
    try {
      const res = await fetch(`/api/purchases/${selectedPurchase.id}/extract-invoice`, { method: 'POST' })
      if (!res.ok) throw new Error('Error al extraer factura')
      const data: InvoiceExtractionResult = await res.json()

      const itemsForMatch = selectedPurchase.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: { name: item.product.name, code: item.product.code },
      }))

      const matchResults = matchInvoiceLines(data.lines, itemsForMatch)

      const matched: MatchedInvoiceItem[] = matchResults
        .filter((r) => r.purchaseItemId !== null)
        .map((r) => ({
          result: r,
          purchaseItem: selectedPurchase.items.find((i) => i.id === r.purchaseItemId) ?? null,
          selected: r.confidence >= 0.70,
        }))

      const unmatchedIds = new Set(matched.map((m) => m.result.invoiceLine.id))
      const unmatched = data.lines.filter((l) => !unmatchedIds.has(l.id))

      setProcessedExtraction({
        meta: { vendor: data.vendor, invoiceNumber: data.invoiceNumber, invoiceDate: data.invoiceDate, currency: data.currency, _mock: data._mock },
        matched,
        unmatched,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al extraer factura')
      setInvoiceReviewOpen(false)
    } finally {
      setInvoiceExtracting(false)
    }
  }

  const handleApplyInvoicePrices = () => {
    if (!processedExtraction) return
    const toApply = processedExtraction.matched
      .filter((m) => m.selected && m.purchaseItem)
      .map((m) => ({ purchaseItemId: m.purchaseItem!.id, unitPrice: m.result.invoiceLine.unitPrice }))
    if (toApply.length === 0) { toast.error('Selecciona al menos un ítem'); return }
    applyInvoicePricesMutation.mutate(toApply)
  }

  const toggleInvoiceSelection = (invoiceLineId: string) => {
    setProcessedExtraction((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        matched: prev.matched.map((m) =>
          m.result.invoiceLine.id === invoiceLineId ? { ...m, selected: !m.selected } : m
        ),
      }
    })
  }

  const handleUseReferencePrice = (item: PurchaseItem) => {
    const referencePrice = getReferencePrice(item)
    if (referencePrice <= 0 || item.priceSource === 'invoice') return
    applyReferencePricesMutation.mutate([{ itemId: item.id, unitPrice: referencePrice }])
  }

  const handleConfirmReferencePrices = () => {
    if (!refPriceConfirm) return

    const updates = refPriceConfirm.items
      .map((item) => ({
        itemId: item.id,
        unitPrice: getReferencePrice(item),
      }))
      .filter((item) => item.unitPrice > 0)

    if (updates.length === 0) {
      setRefPriceConfirm(null)
      return
    }

    applyReferencePricesMutation.mutate(updates)
  }

  const openCreateDialog = () => {
    setCreateForm({ supplierId: '', poNumber: '', purchaseDate: format(new Date(), 'yyyy-MM-dd'), notes: '', status: 'pedido' })
    setCreateItems([])
    setCreateDialogOpen(true)
  }

  const openEditDialog = () => {
    if (!selectedPurchase) return
    setEditForm({ supplierId: selectedPurchase.supplierId, poNumber: selectedPurchase.poNumber || '', purchaseDate: selectedPurchase.purchaseDate, notes: selectedPurchase.notes })
    setEditItems(selectedPurchase.items.map((item) => ({
      tempId: item.id, productId: item.productId, quantity: item.quantity,
      unitPrice: item.unitPrice, shelfId: item.shelfId,
      priceSource: item.priceSource || 'reference',
      notes: item.notes || '',
    })))
    setEditDialogOpen(true)
  }

  const handleCreateItemAdd = () => {
    setCreateItems((prev) => [...prev, { tempId: generateTempId(), productId: '', quantity: 1, unitPrice: 0, shelfId: null, notes: '' }])
  }

  const handleCreateItemChange = (tempId: string, field: keyof DraftItem, value: string | number | null) => {
    if (field === 'productId' && value) {
      const isDuplicate = createItems.some((item) => item.tempId !== tempId && item.productId === value)
      if (isDuplicate) {
        const prod = products?.find((p) => p.id === value)
        toast.error(`${prod?.name ?? 'Producto'} ya está en la lista`)
        return
      }
    }
    setCreateItems((prev) => prev.map((item) => item.tempId === tempId ? { ...item, [field]: value } : item))
  }

  const handleEditItemChange = (tempId: string, field: keyof DraftItem, value: string | number | null) => {
    if (field === 'productId' && value) {
      const isDuplicate = editItems.some((item) => item.tempId !== tempId && item.productId === value)
      if (isDuplicate) {
        const prod = products?.find((p) => p.id === value)
        toast.error(`${prod?.name ?? 'Producto'} ya está en la lista`)
        return
      }
    }
    setEditItems((prev) => prev.map((item) => item.tempId === tempId ? { ...item, [field]: value } : item))
  }

  const handleCreateSubmit = () => {
    if (!createForm.supplierId) { toast.error(t('purchases.validation.selectSupplier')); return }
    if (!createForm.purchaseDate) { toast.error(t('purchases.validation.selectDate')); return }
    const validItems = createItems.filter((item) => item.productId && item.quantity >= 0)
    if (validItems.length === 0) { toast.error(t('purchases.validation.addAtLeastOneItem')); return }
    const seenProductIds = new Set<string>()
    for (const item of validItems) {
      if (seenProductIds.has(item.productId)) {
        const prod = products?.find((p) => p.id === item.productId)
        toast.error(`${prod?.name ?? 'Producto'} está duplicado en la lista`)
        return
      }
      seenProductIds.add(item.productId)
    }
    createMutation.mutate({
      supplierId: createForm.supplierId,
      poNumber: createForm.poNumber,
      purchaseDate: createForm.purchaseDate,
      notes: createForm.notes,
      status: createForm.status,
      items: validItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice || 0, shelfId: item.shelfId || null, priceSource: item.priceSource || 'reference', notes: item.notes || '' })),
    })
  }

  const handleEditSubmit = () => {
    if (!selectedPurchase) return
    if (!editForm.supplierId) { toast.error(t('purchases.validation.selectSupplier')); return }
    const validItems = editItems.filter((item) => item.productId && item.quantity >= 0)
    if (validItems.length === 0) { toast.error(t('purchases.validation.addAtLeastOneItem')); return }
    const seenProductIds = new Set<string>()
    for (const item of validItems) {
      if (seenProductIds.has(item.productId)) {
        const prod = products?.find((p) => p.id === item.productId)
        toast.error(`${prod?.name ?? 'Producto'} está duplicado en la lista`)
        return
      }
      seenProductIds.add(item.productId)
    }
    updateMutation.mutate({
      id: selectedPurchase.id,
      data: {
        supplierId: editForm.supplierId,
        poNumber: editForm.poNumber,
        purchaseDate: editForm.purchaseDate,
        notes: editForm.notes,
        items: validItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice || 0, shelfId: item.shelfId || null, priceSource: item.priceSource || 'reference', notes: item.notes || '' })),
      },
    })
  }

  const handleStatusChange = (newStatus: string) => {
    if (!selectedPurchase) return
    updateStatusMutation.mutate({ id: selectedPurchase.id, status: newStatus })
  }

  const openPurchaseDocuments = useCallback(
    (purchase: Purchase, initialDocumentId?: string) => {
      const documents: InventoryDocumentRecord[] = (purchase.documents ?? []).map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileUrl: `/api/purchases/${purchase.id}/documents/${doc.id}`,
        downloadUrl: `/api/purchases/${purchase.id}/documents/${doc.id}?download=1`,
        entityType: 'purchase',
        entityId: purchase.id,
        uploadedAt: formatShortDate(locale, doc.uploadedAt),
        uploadedBy: t('purchases.viewer.systemUser'),
        version: '1.0',
        fileSize: doc.fileSize,
        source: 'database',
        originalFileUrl: doc.fileUrl,
        locationPath: [t('reports.tabs.inventory'), t('reports.tabs.purchases'), purchase.purchaseCode, t('purchases.documents.title')],
        metadata: {
          purchaseCode: purchase.purchaseCode,
          poNumber: purchase.poNumber || t('purchases.common.noPo'),
          supplier: purchase.supplier.name,
          project: purchase.project?.name || t('purchases.common.noProject'),
        },
      }))

      openDocumentViewer({
        documents,
        initialDocumentId,
        initialPanel: 'info',
        contextTitle: t('purchases.viewer.contextTitle', { code: purchase.purchaseCode }),
        contextPath: [t('reports.tabs.inventory'), t('reports.tabs.purchases'), purchase.purchaseCode, t('purchases.documents.title')],
        onDeleteDocument: async (document) => {
          const res = await fetch(`/api/purchases/${purchase.id}/documents/${document.id}`, {
            method: 'DELETE',
          })

          if (!res.ok) {
            const error = await res.json().catch(() => null)
            throw new Error(error?.error || t('purchases.toast.documentDeleteViewerError'))
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['purchase', purchase.id] }),
            queryClient.invalidateQueries({ queryKey: ['purchases'] }),
          ])
        },
      })
    },
    [locale, openDocumentViewer, queryClient, t]
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPurchaseId) return
    uploadDocumentMutation.mutate({ purchaseId: selectedPurchaseId, file })
    e.target.value = ''
  }

  const handleAddRowConfirm = () => {
    if (!addRowDraft.productId) { toast.error(t('purchases.validation.selectProduct')); return }
    if (addRowDraft.quantity < 0) { toast.error(t('purchases.validation.invalidQuantity')); return }
    const isDuplicate = selectedPurchase?.items.some((item) => item.productId === addRowDraft.productId)
    if (isDuplicate) {
      const prod = products?.find((p) => p.id === addRowDraft.productId)
      toast.error(`${prod?.name ?? 'Producto'} ya está en esta compra`)
      return
    }
    addItemMutation.mutate({
      productId: addRowDraft.productId,
      quantity: addRowDraft.quantity,
      unitPrice: addRowDraft.unitPrice,
      shelfId: addRowDraft.shelfId,
      notes: addRowDraft.notes || '',
    })
  }

  const purchases = purchasesData?.purchases ?? []
  const statusCounts = purchasesData?.statusCounts ?? {}
  const isEditable = (p: Purchase) => p.status === 'pedido' || p.status === 'pending'

  const statusFilters = [
    { value: 'all', label: t('purchases.filters.all') },
    { value: 'pedido', label: t(getPurchaseStatusLabelKey('pedido')) },
    { value: 'pending', label: t(getPurchaseStatusLabelKey('pending')) },
    { value: 'received', label: t(getPurchaseStatusLabelKey('received')) },
    { value: 'cancelled', label: t(getPurchaseStatusLabelKey('cancelled')) },
  ]

  // ─── Detail View ──────────────────────────────────────────────────────────

  if (selectedPurchaseId) {
    if (detailLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )
    }

    if (detailError) {
      return (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setSelectedPurchaseId(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('purchases.actions.back')}
          </Button>
          <p className="text-muted-foreground">{detailError.message}</p>
        </div>
      )
    }

    if (!selectedPurchase) {
      return (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setSelectedPurchaseId(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('purchases.actions.back')}
          </Button>
          <p className="text-muted-foreground">{t('purchases.empty.notFound')}</p>
        </div>
      )
    }

    const total = selectedPurchase.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const canEdit = selectedPurchase.status !== 'received' && selectedPurchase.status !== 'cancelled'
    const statusAccent = getPurchaseStatusAccent(selectedPurchase.status)
    const missingPrices = selectedPurchase.items.filter((i) => i.unitPrice <= 0).length
    const unpricedRefPriceItems = selectedPurchase.items.filter(
      (item) => item.unitPrice <= 0 && getReferencePrice(item) > 0 && item.priceSource !== 'invoice'
    )
    const normalizedItemSearch = purchaseItemSearch.trim().toLowerCase()
    const filteredPurchaseItems = normalizedItemSearch
      ? selectedPurchase.items.filter((item) => {
          const haystack = [
            item.product.name,
            item.product.code,
            item.notes,
            item.priceSource,
          ].join(' ').toLowerCase()
          return haystack.includes(normalizedItemSearch)
        })
      : selectedPurchase.items
    const refPriceConfirmCount = refPriceConfirm?.items.length ?? 0

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className={`sticky top-2 z-30 rounded-lg border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90 ${statusAccent.card}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => setSelectedPurchaseId(null)} className="shrink-0">
                <ArrowLeft className="h-4 w-4 mr-1" /> {t('purchases.actions.back')}
              </Button>
              <Separator orientation="vertical" className="h-6 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-sm tracking-tight text-foreground">
                    {selectedPurchase.poNumber ? `PO ${selectedPurchase.poNumber}` : t('purchases.common.noPo')}
                  </span>
                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                    {t('purchases.viewer.purchaseCode', { code: selectedPurchase.purchaseCode })}
                  </Badge>
                  <PurchaseStatusBadge status={selectedPurchase.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedPurchase.supplier.name} · {formatShortDate(locale, selectedPurchase.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={purchaseItemSearch}
                  onChange={(e) => setPurchaseItemSearch(e.target.value)}
                  placeholder="Search materials"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <DropdownMenu open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {t('purchases.actions.changeStatus')} <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[
                    { value: 'pedido', label: t(getPurchaseStatusLabelKey('pedido')), icon: ShoppingCart },
                    { value: 'pending', label: t(getPurchaseStatusLabelKey('pending')), icon: AlertTriangle },
                    { value: 'received', label: t(getPurchaseStatusLabelKey('received')), icon: CheckCircle2 },
                  ].map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => handleStatusChange(value)}
                      disabled={selectedPurchase.status === value}
                    >
                      <Icon className="mr-2 h-4 w-4" /> {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={selectedPurchase.status === 'cancelled'}
                    className="text-destructive"
                  >
                    <X className="mr-2 h-4 w-4" /> {t(getPurchaseStatusLabelKey('cancelled'))}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedPurchase.project ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openProject(selectedPurchase.project!.id)}
                  className="gap-2 border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800"
                >
                  <FolderKanban className="h-4 w-4" />
                  Project {selectedPurchase.project.name}
                </Button>
              ) : null}
              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-r-none border-r-0"
                  onClick={() => downloadPdf(selectedPurchase.id, selectedPurchase.purchaseCode, 'warehouse')}
                >
                  <FileDown className="h-4 w-4 mr-1" /> PDF
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-l-none px-2" aria-label="Opciones de PDF">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => downloadPdf(selectedPurchase.id, selectedPurchase.purchaseCode, 'warehouse')}>
                      {t('purchases.pdf.deliverWarehouse')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => downloadPdf(selectedPurchase.id, selectedPurchase.purchaseCode, 'client')}
                      disabled={!selectedPurchase.project}
                    >
                      {t('purchases.pdf.deliverClient')} {selectedPurchase.project ? '' : `(${t('purchases.common.noProject').toLowerCase()})`}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setCustomAddressText(''); setCustomAddressDialogOpen(true) }}>
                      {t('purchases.pdf.customAddress')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {canEdit && (
                <>
                  <Button variant="outline" size="sm" onClick={openEditDialog}>
                    {t('purchases.actions.editPurchase')}
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { setDeleteTarget(selectedPurchase); setDeleteDialogOpen(true) }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: t('purchases.fields.poNumber'), value: selectedPurchase.poNumber || t('purchases.common.noPo') },
            { label: t('purchases.fields.supplier'), value: selectedPurchase.supplier.name },
            { label: t('purchases.fields.date'), value: selectedPurchase.purchaseDate },
            { label: t('purchases.fields.project'), value: selectedPurchase.project?.name ?? '-' },
            { label: t('purchases.common.total'), value: total > 0 ? formatCurrency(locale, total) : '-' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 ${label === t('purchases.fields.poNumber') ? 'border-teal-200 bg-teal-50/70' : ''}`}
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`${label === t('purchases.fields.poNumber') ? 'font-mono text-base font-bold text-teal-800' : 'font-medium text-sm'} mt-0.5 truncate`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {selectedPurchase.notes && (
          <p className="text-sm text-muted-foreground border-l-2 pl-3">{selectedPurchase.notes}</p>
        )}

        {selectedPurchase.supplierReturns && selectedPurchase.supplierReturns.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                {t('purchases.returns.title')}
                <Badge variant="secondary" className="ml-2">
                  {selectedPurchase.supplierReturns.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="pl-4 py-2 text-xs">{t('purchases.fields.date')}</TableHead>
                      <TableHead className="py-2 text-xs">{t('reports.tables.product')}</TableHead>
                      <TableHead className="py-2 text-xs text-right w-24">{t('purchases.table.qtyShort')}</TableHead>
                      <TableHead className="py-2 text-xs">{t('purchases.returns.reason')}</TableHead>
                      <TableHead className="py-2 text-xs pr-4">{t('purchases.fields.notes')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPurchase.supplierReturns.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="pl-4 py-2 text-sm text-muted-foreground">
                          {formatShortDate(locale, entry.createdAt)}
                        </TableCell>
                        <TableCell className="py-2">
                          <p className="font-medium text-sm">{entry.product.name}</p>
                          <p className="text-xs text-muted-foreground">{entry.product.code}</p>
                        </TableCell>
                        <TableCell className="py-2 text-right font-medium">
                          {formatLocaleInteger(locale, entry.quantity)}
                        </TableCell>
                        <TableCell className="py-2 text-sm">
                          {t(getSupplierReturnReasonLabelKey(entry.reason))}
                        </TableCell>
                        <TableCell className="py-2 pr-4 text-sm text-muted-foreground">
                          {entry.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price warning */}
        {missingPrices > 0 && canEdit && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {t('purchases.warning.missingPrices', {
                count: formatLocaleInteger(locale, missingPrices),
                itemLabel: missingPrices === 1 ? t('purchases.common.productSingular') : t('purchases.common.productPlural'),
              })}{' '}
              {t('purchases.warning.clickPriceToEdit')}
            </span>
          </div>
        )}

        {/* Items */}
        <Card className={statusAccent.card}>
          <CardHeader className={`sticky top-24 z-20 pb-2 pt-4 px-4 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 ${statusAccent.card}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-sm font-semibold">
                {t('purchases.items.title')}{' '}
                <span className="text-muted-foreground font-normal">
                  ({filteredPurchaseItems.length}
                  {filteredPurchaseItems.length !== selectedPurchase.items.length ? ` / ${selectedPurchase.items.length}` : ''})
                </span>
              </CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={purchaseItemSearch}
                    onChange={(e) => setPurchaseItemSearch(e.target.value)}
                    placeholder="Search by product, code, or note"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                {canEdit && unpricedRefPriceItems.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setRefPriceConfirm({ mode: 'bulk', items: unpricedRefPriceItems })}
                  >
                    {t('purchases.actions.applyRefPrices')}
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {unpricedRefPriceItems.length}
                    </Badge>
                  </Button>
                )}
                {canEdit && !addingRow && (
                  <Button
                    size="sm" variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => { setAddingRow(true); setAddRowDraft({ tempId: '', productId: '', quantity: 1, unitPrice: 0, shelfId: null, notes: '' }) }}
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('common.add')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {selectedPurchase.items.length === 0 && !addingRow ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t('purchases.items.empty')}</p>
            ) : filteredPurchaseItems.length === 0 && !addingRow ? (
              <div className="p-6 text-center">
                <p className="text-sm font-medium">No materials found</p>
                <p className="text-xs text-muted-foreground">Try another product name, code, or note.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className={statusAccent.header}>
                      <TableHead className="pl-4 py-2 w-8 text-xs">#</TableHead>
                      <TableHead className="py-2 text-xs">{t('reports.tables.product')}</TableHead>
                      <TableHead className="py-2 text-xs min-w-56">{t('purchases.fields.notes')}</TableHead>
                      <TableHead className="py-2 text-xs text-right w-24">{t('purchases.table.qtyShort')}</TableHead>
                      <TableHead className="py-2 text-xs text-right w-32">{t('purchases.table.unitPrice')}</TableHead>
                      <TableHead className="py-2 text-xs w-12" />
                      <TableHead className="py-2 text-xs text-right w-32">{t('purchases.table.subtotal')}</TableHead>
                      {canEdit && <TableHead className="py-2 w-10 pr-4" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchaseItems.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-4 py-2 text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="py-2">
                          <p className="font-medium text-sm">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">{item.product.code}</p>
                          {getReferencePrice(item) > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] text-muted-foreground">
                                {t('reports.inventory.kpis.referencePrice')}: {formatCurrency(locale, getReferencePrice(item))}
                              </span>
                              {canEdit && canApplyReferencePrice(item) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => handleUseReferencePrice(item)}
                                  disabled={applyReferencePricesMutation.isPending}
                                >
                                  {t('purchases.actions.useRefPrice')}
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {canEdit ? (
                            <Input
                              defaultValue={item.notes || ''}
                              placeholder={t('purchases.fields.notes')}
                              onBlur={(e) => {
                                const notes = e.currentTarget.value
                                if (notes !== (item.notes || '')) {
                                  patchItemMutation.mutate({ itemId: item.id, notes })
                                }
                              }}
                              className="h-8 min-w-52 text-xs"
                            />
                          ) : item.notes ? (
                            <span className="text-sm text-muted-foreground">{item.notes}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {canEdit ? (
                            <InlineCell
                              value={item.quantity}
                              onSave={(v) => patchItemMutation.mutate({ itemId: item.id, quantity: v })}
                              min={0}
                              step={1}
                            />
                          ) : item.quantity}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {canEdit ? (
                            <InlineCell
                              value={item.unitPrice}
                              onSave={(v) => patchItemMutation.mutate({ itemId: item.id, unitPrice: v })}
                              fmt={(value) => formatCurrency(locale, value)}
                              min={0}
                              step={0.01}
                            />
                          ) : item.unitPrice > 0 ? formatCurrency(locale, item.unitPrice) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <PriceSourceBadge source={item.priceSource || 'reference'} />
                        </TableCell>
                        <TableCell className="py-2 text-right font-medium text-sm">
                          {item.unitPrice > 0 ? formatCurrency(locale, item.quantity * item.unitPrice) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-2 pr-4">
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => { setDeleteItemTarget(item); setDeleteItemDialogOpen(true) }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}

                    {/* Inline add row */}
                    {addingRow && (
                      <TableRow className="bg-muted/20">
                        <TableCell className="pl-4 py-2 text-muted-foreground text-xs">
                          {selectedPurchase.items.length + 1}
                        </TableCell>
                        <TableCell className="py-2">
                          <ProductCombobox
                            value={addRowDraft.productId}
                            onChange={(v, prod) => setAddRowDraft((prev) => ({
                              ...prev,
                              productId: v,
                              unitPrice: prod?.referencePrice ?? prev.unitPrice,
                            }))}
                            products={products}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={addRowDraft.notes || ''}
                            placeholder={t('purchases.fields.notes')}
                            onChange={(e) => setAddRowDraft((prev) => ({ ...prev, notes: e.target.value }))}
                            className="h-8 min-w-52 text-xs"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number" min={0} value={addRowDraft.quantity}
                            onChange={(e) => setAddRowDraft((prev) => ({ ...prev, quantity: parseNonNegativeInteger(e.target.value) }))}
                            className="h-8 w-20 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number" min={0} step={0.01} value={addRowDraft.unitPrice || ''}
                            placeholder={t('purchases.fields.pricePlaceholder')}
                            onChange={(e) => setAddRowDraft((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                            className="h-8 w-28 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="py-2" />
                        <TableCell className="py-2" />
                        <TableCell className="py-2 pr-4">
                          <div className="flex items-center gap-1">
                            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddRowConfirm} disabled={addItemMutation.isPending}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAddingRow(false)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {total > 0 && (
              <div className="flex justify-end border-t px-4 py-3 gap-4">
                <span className="text-sm text-muted-foreground self-center">{t('purchases.common.total')}</span>
                <span className="text-xl font-bold">{formatCurrency(locale, total)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!refPriceConfirm} onOpenChange={(open) => !open && setRefPriceConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {refPriceConfirm?.mode === 'single'
                  ? t('purchases.confirm.useRefPriceTitle')
                  : t('purchases.confirm.applyRefPricesTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                {refPriceConfirm?.mode === 'single' && refPriceConfirm.items[0] ? (
                  <div className="space-y-2">
                    <p>
                      {t('purchases.confirm.useRefPriceDescription', {
                        name: refPriceConfirm.items[0].product.name,
                      })}
                    </p>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span>{t('purchases.table.unitPrice')}</span>
                        <span className="font-medium">
                          {formatCurrency(locale, refPriceConfirm.items[0].unitPrice)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-4">
                        <span>{t('reports.inventory.kpis.referencePrice')}</span>
                        <span className="font-medium">
                          {formatCurrency(locale, getReferencePrice(refPriceConfirm.items[0]))}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p>
                    {t('purchases.confirm.applyRefPricesDescription', {
                      count: formatLocaleInteger(locale, refPriceConfirmCount),
                    })}
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmReferencePrices}
                disabled={applyReferencePricesMutation.isPending}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {applyReferencePricesMutation.isPending
                  ? t('purchases.actions.applyingRefPrices')
                  : refPriceConfirm?.mode === 'single'
                    ? t('purchases.actions.useRefPrice')
                    : t('purchases.actions.applyRefPrices')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Documents */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {t('purchases.documents.title')}
                {selectedPurchase.documents && selectedPurchase.documents.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{selectedPurchase.documents.length}</Badge>
                )}
              </CardTitle>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv" />
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()} disabled={uploadDocumentMutation.isPending}>
                <Upload className="h-3.5 w-3.5" /> {t('purchases.actions.upload')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!selectedPurchase.documents || selectedPurchase.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">{t('purchases.documents.empty')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedPurchase.documents.map((doc) => {
                  const isAnalyzable = /\.(pdf|jpg|jpeg|png|webp)$/i.test(doc.fileName)
                  return (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <button
                      type="button"
                      onClick={() => openPurchaseDocuments(selectedPurchase, doc.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="min-w-0">
                        <p className="text-sm truncate hover:underline">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fileSize)} · {formatShortDate(locale, doc.uploadedAt)}
                        </p>
                      </span>
                    </button>
                    <div className="ml-3 flex shrink-0 items-center gap-1">
                      {isAnalyzable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs text-teal-700 border-teal-200 hover:bg-teal-50"
                          onClick={handleExtractInvoice}
                          disabled={invoiceExtracting}
                          title="Analizar factura"
                        >
                          {invoiceExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
                          Analizar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => openPurchaseDocuments(selectedPurchase, doc.id)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {t('reports.common.open')}
                      </Button>
                      <Button variant="outline" size="sm" asChild className="h-7 gap-1.5 px-2 text-xs">
                        <a href={`/api/purchases/${selectedPurchase.id}/documents/${doc.id}?download=1`}>
                          <FileDown className="h-3.5 w-3.5" />
                          {t('purchases.actions.download')}
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                        onClick={() => { setDeleteDocumentTarget(doc); setDeleteDocumentDialogOpen(true) }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <ConfirmDeleteDialog
          open={deleteItemDialogOpen} onOpenChange={setDeleteItemDialogOpen}
          onConfirm={() => {
            if (selectedPurchase && deleteItemTarget)
              deleteItemMutation.mutate({ purchaseId: selectedPurchase.id, itemId: deleteItemTarget.id })
          }}
          title={t('purchases.confirm.deleteItemTitle')}
          description={t('purchases.confirm.deleteItemDescription', { name: deleteItemTarget?.product.name ?? '' })}
        />
        <ConfirmDeleteDialog
          open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}
          onConfirm={() => { if (deleteDocumentTarget) deleteDocumentMutation.mutate({ docId: deleteDocumentTarget.id }) }}
          title={t('purchases.confirm.deleteDocumentTitle')}
          description={t('purchases.confirm.deleteDocumentDescription', { name: deleteDocumentTarget?.fileName ?? '' })}
        />

        {/* Invoice Review Dialog */}
        <Dialog open={invoiceReviewOpen} onOpenChange={(open) => { if (!open) { setInvoiceReviewOpen(false); setProcessedExtraction(null) } }}>
          <DialogContent className="w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-teal-600" />
                Revisión de Factura
              </DialogTitle>
              {processedExtraction?.meta._mock && (
                <DialogDescription className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Datos simulados (mock) — sin IA real
                </DialogDescription>
              )}
            </DialogHeader>

            {invoiceExtracting && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <p className="text-sm text-muted-foreground">Extrayendo datos de la factura…</p>
              </div>
            )}

            {!invoiceExtracting && processedExtraction && (
              <div className="space-y-4 py-2">
                {/* Meta */}
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Proveedor</p>
                    <p className="font-medium truncate">{processedExtraction.meta.vendor}</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Nro. Factura</p>
                    <p className="font-medium font-mono">{processedExtraction.meta.invoiceNumber}</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">{processedExtraction.meta.invoiceDate}</p>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
                    <p className="text-xs font-medium text-teal-700">Total simulado</p>
                    <p className="text-lg font-bold text-teal-900">{formatCurrency(locale, invoiceReviewTotals.grandTotal)}</p>
                    <p className="text-[11px] text-teal-700">Seleccionado: {formatCurrency(locale, invoiceReviewTotals.selected)}</p>
                  </div>
                </div>

                {/* Matched */}
                {processedExtraction.matched.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold">Coincidencias ({processedExtraction.matched.length})</h4>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Selecciona los precios a aplicar</p>
                        <p>Total coincidencias: <span className="font-semibold text-foreground">{formatCurrency(locale, invoiceReviewTotals.matched)}</span></p>
                      </div>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[4%] py-2" />
                            <TableHead className="w-[28%] py-2 text-xs">Producto (compra)</TableHead>
                            <TableHead className="py-2 text-xs">Línea factura</TableHead>
                            <TableHead className="w-[10%] py-2 text-xs text-right">Conf.</TableHead>
                            <TableHead className="w-[12%] py-2 text-xs text-right">Actual</TableHead>
                            <TableHead className="w-[14%] py-2 text-xs text-right">Factura</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processedExtraction.matched.map((m) => (
                            <TableRow key={m.result.invoiceLine.id} className={m.selected ? '' : 'opacity-50'}>
                              <TableCell className="py-2 pl-3">
                                <Checkbox
                                  checked={m.selected}
                                  onCheckedChange={() => toggleInvoiceSelection(m.result.invoiceLine.id)}
                                />
                              </TableCell>
                              <TableCell className="py-2 align-top">
                                <p className="break-words text-sm font-medium leading-snug">{m.purchaseItem?.product.name}</p>
                                <p className="text-xs text-muted-foreground">{m.purchaseItem?.product.code}</p>
                              </TableCell>
                              <TableCell className="py-2 align-top">
                                <p className="break-words text-sm text-muted-foreground leading-snug">{m.result.invoiceLine.description}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  Qty {m.result.invoiceLine.quantity}
                                </p>
                              </TableCell>
                              <TableCell className="py-2 text-right">
                                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${confidenceBadge(m.result.confidence)}`}>
                                  {Math.round(m.result.confidence * 100)}%
                                </span>
                              </TableCell>
                              <TableCell className="py-2 text-right text-sm text-muted-foreground">
                                {m.purchaseItem?.unitPrice ? formatCurrency(locale, m.purchaseItem.unitPrice) : '-'}
                              </TableCell>
                              <TableCell className="py-2 text-right">
                                <p className="text-sm font-semibold">{formatCurrency(locale, m.result.invoiceLine.unitPrice)}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatCurrency(locale, m.result.invoiceLine.lineTotal ?? m.result.invoiceLine.quantity * m.result.invoiceLine.unitPrice)}
                                </p>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Unmatched */}
                {processedExtraction.unmatched.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">Sin coincidencia en compra ({processedExtraction.unmatched.length})</h4>
                      <p className="text-xs text-muted-foreground">
                        Total: <span className="font-semibold text-foreground">{formatCurrency(locale, invoiceReviewTotals.unmatched)}</span>
                      </p>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="py-2 text-xs">Descripción</TableHead>
                            <TableHead className="py-2 text-xs text-right w-16">Cant.</TableHead>
                            <TableHead className="py-2 text-xs text-right w-28">Precio unit.</TableHead>
                            <TableHead className="py-2 text-xs text-right w-28">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processedExtraction.unmatched.map((line) => (
                            <TableRow key={line.id} className="text-muted-foreground">
                              <TableCell className="py-2 text-sm break-words">{line.description}</TableCell>
                              <TableCell className="py-2 text-right text-sm">{line.quantity}</TableCell>
                              <TableCell className="py-2 text-right text-sm">{formatCurrency(locale, line.unitPrice)}</TableCell>
                              <TableCell className="py-2 text-right text-sm font-medium">
                                {formatCurrency(locale, line.lineTotal ?? line.quantity * line.unitPrice)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setInvoiceReviewOpen(false); setProcessedExtraction(null) }}>
                Cancelar
              </Button>
              <Button
                onClick={handleApplyInvoicePrices}
                disabled={invoiceExtracting || !processedExtraction || applyInvoicePricesMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {applyInvoicePricesMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Aplicando…</> : 'Aplicar precios seleccionados'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('purchases.edit.title', { code: selectedPurchase.purchaseCode })}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>{t('purchases.fields.supplierRequired')}</Label>
                  <Select value={editForm.supplierId} onValueChange={(v) => setEditForm((p) => ({ ...p, supplierId: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('common.selectExisting')} /></SelectTrigger>
                    <SelectContent>{suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('purchases.fields.dateRequired')}</Label>
                  <Input type="date" value={editForm.purchaseDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1 space-y-1.5 rounded-md border border-teal-200 bg-teal-50/70 p-3">
                  <Label className="text-sm font-semibold text-teal-800">{t('purchases.fields.poNumber')}</Label>
                  <Input className="font-mono font-semibold" placeholder={t('purchases.fields.poPlaceholder')} value={editForm.poNumber}
                    onChange={(e) => setEditForm((p) => ({ ...p, poNumber: e.target.value }))} />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>{t('purchases.fields.notes')}</Label>
                  <Textarea placeholder={t('purchases.fields.notesPlaceholder')} value={editForm.notes}
                    onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">{t('purchases.items.title')} ({editItems.length})</Label>
                <DraftItemsTable
                  items={editItems}
                  products={products}
                  shelfOptions={shelfOptions}
                  showPrice={true}
                  onChange={handleEditItemChange}
                  onRemove={(tempId) => setEditItems((prev) => prev.filter((i) => i.tempId !== tempId))}
                  onAdd={() => setEditItems((prev) => [...prev, { tempId: generateTempId(), productId: '', quantity: 1, unitPrice: 0, shelfId: null, notes: '' }])}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('purchases.actions.saving') : t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ─── List View ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('reports.tabs.purchases')}</h2>
          <p className="text-sm text-muted-foreground">{t('purchases.header.description')}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" /> {t('purchases.actions.newPurchase')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('purchases.filters.searchPlaceholder')} value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={supplierFilter} onValueChange={(v) => setSupplierFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t('purchases.filters.allSuppliers')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('purchases.filters.allSuppliers')}</SelectItem>
              {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((sf) => {
            const count = sf.value === 'all' ? (statusCounts.all ?? purchases.length) : (statusCounts[sf.value] ?? 0)
            return (
              <Button key={sf.value} variant={statusFilter === sf.value ? 'default' : 'outline'}
                size="sm" className="h-7 text-xs gap-1.5" onClick={() => setStatusFilter(sf.value)}>
                {sf.label}
                {count > 0 && <Badge variant="secondary" className="h-4 px-1 text-xs">{count}</Badge>}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      {purchasesLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={ShoppingCart} title={t('purchases.empty.title')}
          description={searchTerm || statusFilter !== 'all' || supplierFilter
            ? t('purchases.empty.filtered')
            : t('purchases.empty.default')}
          action={!searchTerm && statusFilter === 'all' && !supplierFilter ? (
            <Button size="sm" onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />{t('purchases.actions.newPurchase')}</Button>
          ) : undefined}
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>PO</TableHead>
                <TableHead>{t('purchases.table.purchaseCode')}</TableHead>
                <TableHead>{t('purchases.fields.supplier')}</TableHead>
                <TableHead>{t('purchases.fields.date')}</TableHead>
                <TableHead>{t('reports.tables.status')}</TableHead>
                <TableHead className="text-center">{t('purchases.table.items')}</TableHead>
                <TableHead className="text-right">{t('purchases.common.total')}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => {
                const itemTotal = purchase.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
                return (
                  <TableRow key={purchase.id} className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedPurchaseId(purchase.id)}>
                    <TableCell>
                      <div className="inline-flex min-w-[120px] items-center rounded-md border border-teal-200 bg-teal-50 px-2 py-1 font-mono text-sm font-bold text-teal-800">
                        {purchase.poNumber || t('purchases.common.noPo')}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {purchase.purchaseCode}
                    </TableCell>
                    <TableCell>{purchase.supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{purchase.purchaseDate}</TableCell>
                    <TableCell><PurchaseStatusBadge status={purchase.status} /></TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{purchase.items.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {itemTotal > 0 ? formatCurrency(locale, itemTotal) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); downloadPdf(purchase.id, purchase.purchaseCode, 'warehouse') }}>
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                        {isEditable(purchase) && (
                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(purchase); setDeleteDialogOpen(true) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {t('purchases.actions.newPurchase')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>{t('purchases.fields.supplierRequired')}</Label>
                <Select value={createForm.supplierId}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, supplierId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('purchases.fields.selectSupplier')} /></SelectTrigger>
                  <SelectContent>{suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('purchases.fields.dateRequired')}</Label>
                <Input type="date" value={createForm.purchaseDate}
                  onChange={(e) => setCreateForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 rounded-md border border-teal-200 bg-teal-50/70 p-3">
                <Label className="text-sm font-semibold text-teal-800">{t('purchases.fields.poNumber')}</Label>
                <Input className="font-mono font-semibold" placeholder={t('purchases.fields.poPlaceholder')} value={createForm.poNumber}
                  onChange={(e) => setCreateForm((p) => ({ ...p, poNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('purchases.fields.initialStatus')}</Label>
                <Select value={createForm.status}
                  onValueChange={(v) => {
                    setCreateForm((p) => ({ ...p, status: v }))
                    if (v !== 'pedido') {
                      setCreateItems((prev) => prev.map((item) => {
                        if (item.unitPrice > 0 || !item.productId) return item
                        const prod = products?.find((p) => p.id === item.productId)
                        return prod?.referencePrice ? { ...item, unitPrice: prod.referencePrice } : item
                      }))
                    }
                  }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pedido">{t(getPurchaseStatusLabelKey('pedido'))}</SelectItem>
                    <SelectItem value="pending">{t(getPurchaseStatusLabelKey('pending'))}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('purchases.fields.notes')}</Label>
                <Input placeholder={t('purchases.fields.optionalNotes')} value={createForm.notes}
                  onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  {t('purchases.items.title')} {createItems.length > 0 && <span className="text-muted-foreground font-normal">({createItems.length})</span>}
                </Label>
                {createForm.status === 'pedido' && (
                  <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                    <Info className="h-3 w-3" /> {t('purchases.items.optionalPriceHint')}
                  </span>
                )}
              </div>
              <DraftItemsTable
                items={createItems}
                products={products}
                shelfOptions={shelfOptions}
                showPrice={createForm.status !== 'pedido'}
                onChange={handleCreateItemChange}
                onRemove={(tempId) => setCreateItems((prev) => prev.filter((i) => i.tempId !== tempId))}
                onAdd={handleCreateItemAdd}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('purchases.actions.creating') : t('purchases.actions.createPurchase')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Purchase Confirm */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteTarget(null) }}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
        title={t('purchases.confirm.deletePurchaseTitle')}
        description={t('purchases.confirm.deletePurchaseDescription', { code: deleteTarget?.purchaseCode ?? '' })}
      />

      {/* Custom delivery address Dialog */}
      <Dialog open={customAddressDialogOpen} onOpenChange={setCustomAddressDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('purchases.pdf.customAddressTitle')}</DialogTitle>
            <DialogDescription>
              {t('purchases.pdf.customAddressDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('purchases.pdf.addressLabel')}</label>
            <Textarea
              placeholder={t('purchases.pdf.addressPlaceholder')}
              value={customAddressText}
              onChange={(e) => setCustomAddressText(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t('purchases.pdf.addressHelper')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomAddressDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!selectedPurchase) return
                const addr = customAddressText.trim()
                if (!addr) { toast.error(t('purchases.validation.enterAddress')); return }
                downloadPdf(selectedPurchase.id, selectedPurchase.purchaseCode, 'custom', addr)
                setCustomAddressDialogOpen(false)
              }}
            >
              {t('purchases.actions.downloadPdf')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
