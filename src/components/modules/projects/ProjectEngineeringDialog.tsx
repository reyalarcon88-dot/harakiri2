'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, type QueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { useI18n } from '@/components/layout/I18nProvider'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { formatLocaleInteger } from '@/lib/i18n/format'
import { ENGINEERING_SECTIONS } from '@/lib/engineering-sections'
import { isProductCompatibleWithProjectColor } from '@/lib/project-color'
import { useDocumentViewerStore } from '@/stores/document-viewer'
import type { InventoryDocumentRecord } from '@/types/documents'

const DocumentPreview = dynamic(
  () => import('@/components/documents/DocumentPreview').then((module) => module.DocumentPreview),
  { ssr: false }
)

type EngineeringDialogMode = 'apply' | 'template'

interface EngineeringProduct {
  id: string
  name: string
  code: string
  currentStock: number
  family?: string
  engineeringSection?: string
  color?: string
  unitOfMeasure?: string
}

interface EngineeringTemplateItem {
  id: string
  productId: string
  plannedQuantity: number
  section?: string
  sortOrder?: number
  product: { id: string; name: string; code: string }
}

interface EngineeringTemplate {
  id: string
  name: string
  description: string
  projectType?: string
  sourceFileName?: string
  items: EngineeringTemplateItem[]
}

interface EngineeringProjectMaterial {
  id: string
  productId: string
  plannedQuantity: number
  dispatchedQuantity: number
  engineeringSection?: string
  sortOrder?: number
  product: { id: string; name: string; code: string }
}

interface EngineeringProjectDocument {
  id: string
  fileName: string
  fileType: string
  fileUrl: string
  fileSize: number
  uploadedAt: string
}

interface EngineeringProject {
  id: string
  name: string
  projectType?: string
  color?: string
  poNumber?: string
  status?: string
  client?: { name: string }
  materials: EngineeringProjectMaterial[]
  documents?: EngineeringProjectDocument[]
}

interface ProjectEngineeringDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: EngineeringDialogMode
  project: EngineeringProject
  products: EngineeringProduct[]
  templates: EngineeringTemplate[]
  queryClient: QueryClient
}

interface DraftRow {
  id: string
  section: string
  productId: string
  quantity: string
  sourceLabel: string
  unresolved: boolean
}

function normalizeEngineeringText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseEngineeringQuantity(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const normalized = String(value ?? '')
    .trim()
    .replace(/,/g, '.')
  const quantity = Number(normalized)
  return Number.isFinite(quantity) ? quantity : 0
}

function createDraftRow(overrides: Partial<DraftRow> = {}): DraftRow {
  return {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
    section: '',
    productId: '',
    quantity: '',
    sourceLabel: '',
    unresolved: false,
    ...overrides,
  }
}

function isRowEmpty(row: DraftRow) {
  return !row.section.trim() && !row.productId && !row.quantity.trim() && !row.sourceLabel.trim()
}

function looksLikeSectionLabel(label: string) {
  const trimmed = label.trim()
  if (!trimmed) return false
  if (/\d/.test(trimmed)) return false
  if (/["']/.test(trimmed)) return false
  if (/\b[a-z]+\s*x\s*[a-z0-9]+\b/i.test(trimmed)) return false
  const words = trimmed.split(/\s+/).length
  return words <= 5 && trimmed.length <= 42
}

function buildDraftRowsFromProject(materials: EngineeringProjectMaterial[]) {
  if (materials.length === 0) return [createDraftRow()]

  return materials.map((material, index) =>
    createDraftRow({
      id: material.id || `project-${index}`,
      section: material.engineeringSection || '',
      productId: material.productId,
      quantity: material.plannedQuantity > 0 ? String(material.plannedQuantity) : '',
      sourceLabel: material.product.name,
      unresolved: false,
    })
  )
}

function buildDraftRowsFromTemplate(items: EngineeringTemplateItem[]) {
  if (items.length === 0) return [createDraftRow()]

  return items.map((item, index) =>
    createDraftRow({
      id: item.id || `template-${index}`,
      section: item.section || '',
      productId: item.productId,
      quantity: item.plannedQuantity > 0 ? String(item.plannedQuantity) : '',
      sourceLabel: item.product.name,
      unresolved: false,
    })
  )
}

function ProductPicker({
  products,
  selectableProducts,
  value,
  onChange,
  placeholder,
  invalid = false,
}: {
  products: EngineeringProduct[]
  selectableProducts?: EngineeringProduct[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  invalid?: boolean
}) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = products.find((product) => product.id === value)
  const options = useMemo(() => {
    const baseOptions = selectableProducts ?? products
    if (selected && !baseOptions.some((product) => product.id === selected.id)) {
      return [selected, ...baseOptions]
    }
    return baseOptions
  }, [products, selectableProducts, selected])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={`w-full justify-between font-normal text-left ${
            invalid ? 'border-rose-300 text-rose-700 hover:border-rose-400 hover:text-rose-700' : ''
          }`}
        >
          {selected ? (
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{selected.name}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">({selected.code})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-9" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>{t('purchases.empty.noResults')}</CommandEmpty>
              <CommandGroup>
              {options.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.name} ${product.code} ${product.family ?? ''} ${product.color ?? ''}`}
                  onSelect={() => {
                    onChange(product.id)
                    setOpen(false)
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === product.id ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{product.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {product.code} · {t('projects.addMaterial.stockLabel', {
                        count: formatLocaleInteger(locale, product.currentStock),
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
  )
}

export function ProjectEngineeringDialog({
  open,
  onOpenChange,
  mode,
  project,
  products,
  templates,
  queryClient,
}: ProjectEngineeringDialogProps) {
  const { locale, t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const openDocumentViewer = useDocumentViewerStore((state) => state.openViewer)

  const [draftRows, setDraftRows] = useState<DraftRow[]>([createDraftRow()])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateProjectType, setTemplateProjectType] = useState('')
  const [sourceFileName, setSourceFileName] = useState('')
  const [showAllTemplates, setShowAllTemplates] = useState(false)
  const [showOnlyReviewRows, setShowOnlyReviewRows] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [planDocumentId, setPlanDocumentId] = useState('')
  const [planPage, setPlanPage] = useState(1)
  const [planPageCount, setPlanPageCount] = useState(1)
  const [planZoom, setPlanZoom] = useState(1)
  const [planRotation, setPlanRotation] = useState(0)
  const [planRefreshKey, setPlanRefreshKey] = useState(0)

  const normalizedProjectType = normalizeEngineeringText(project.projectType)
  const compatibleProducts = useMemo(
    () => products.filter((product) => isProductCompatibleWithProjectColor(project.color, product.color)),
    [products, project.color]
  )

  const productCodeMap = useMemo(() => {
    const map = new Map<string, EngineeringProduct>()
    compatibleProducts.forEach((product) => {
      const key = normalizeEngineeringText(product.code)
      if (key && !map.has(key)) {
        map.set(key, product)
      }
    })
    return map
  }, [compatibleProducts])

  const productNameMap = useMemo(() => {
    const map = new Map<string, EngineeringProduct>()
    compatibleProducts.forEach((product) => {
      const key = normalizeEngineeringText(product.name)
      if (key && !map.has(key)) {
        map.set(key, product)
      }
    })
    return map
  }, [compatibleProducts])

  const availableTemplates = useMemo(() => {
    const filtered = templates.filter((template) => {
      if (showAllTemplates || !normalizedProjectType) return true

      const templateType = normalizeEngineeringText(template.projectType)
      return !templateType || templateType === normalizedProjectType
    })

    return filtered.sort((a, b) => {
      const aType = normalizeEngineeringText(a.projectType)
      const bType = normalizeEngineeringText(b.projectType)
      const aScore = aType === normalizedProjectType ? 0 : aType ? 1 : 2
      const bScore = bType === normalizedProjectType ? 0 : bType ? 1 : 2
      return aScore - bScore || a.name.localeCompare(b.name)
    })
  }, [normalizedProjectType, showAllTemplates, templates])

  const viewerDocuments = useMemo<InventoryDocumentRecord[]>(() => {
    return (project.documents || []).map((document) => ({
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileUrl: `/api/projects/${project.id}/documents/${document.id}`,
      downloadUrl: `/api/projects/${project.id}/documents/${document.id}?download=1`,
      entityType: 'project',
      entityId: project.id,
      fileSize: document.fileSize,
      source: 'database',
      uploadedAt: document.uploadedAt,
      metadata: {
        projectName: project.name,
        poNumber: project.poNumber || '',
      },
    }))
  }, [project.documents, project.id, project.name, project.poNumber])

  const selectedPlanDocument = viewerDocuments.find((document) => document.id === planDocumentId) || viewerDocuments[0]

  const nonEmptyRows = useMemo(() => draftRows.filter((row) => !isRowEmpty(row)), [draftRows])
  const unresolvedRowsCount = useMemo(
    () => nonEmptyRows.filter((row) => !row.productId).length,
    [nonEmptyRows]
  )
  const invalidQuantityCount = useMemo(
    () => nonEmptyRows.filter((row) => parseEngineeringQuantity(row.quantity) <= 0).length,
    [nonEmptyRows]
  )
  const rowsNeedingReviewCount = unresolvedRowsCount + invalidQuantityCount
  const visibleRows = useMemo(() => {
    if (!showOnlyReviewRows) return draftRows

    const filtered = draftRows.filter((row) => {
      if (isRowEmpty(row)) return false
      return !row.productId || parseEngineeringQuantity(row.quantity) <= 0
    })

    return filtered.length > 0 ? filtered : draftRows
  }, [draftRows, showOnlyReviewRows])

  const autoSelectDoneRef = useRef(false)

  // Main init: resets all state when the dialog opens or key project props change.
  useEffect(() => {
    if (!open) {
      autoSelectDoneRef.current = false
      return
    }

    autoSelectDoneRef.current = false
    setDraftRows(buildDraftRowsFromProject(project.materials || []))
    setSelectedTemplateId('')
    setTemplateName(mode === 'template' ? `${project.projectType || project.name}`.trim() : '')
    setTemplateDescription('')
    setTemplateProjectType(project.projectType || '')
    setSourceFileName('')
    setShowAllTemplates(false)
    setShowOnlyReviewRows(false)
    setPlanOpen(viewerDocuments.length > 0)
    setPlanDocumentId(viewerDocuments[0]?.id || '')
    setPlanPage(1)
    setPlanPageCount(1)
    setPlanZoom(1)
    setPlanRotation(0)
    setPlanRefreshKey(0)
  }, [mode, open, project.materials, project.name, project.projectType, viewerDocuments])

  // Auto-select: watches templates so it fires even if templates load after the dialog opens.
  // Runs at most once per open session (guarded by autoSelectDoneRef).
  useEffect(() => {
    if (!open || mode !== 'apply') return
    if (autoSelectDoneRef.current) return
    if (templates.length === 0) return

    const normalizedType = normalizeEngineeringText(project.projectType)
    if (!normalizedType) return

    const matching = templates.find(
      (tmpl) => normalizeEngineeringText(tmpl.projectType) === normalizedType
    )
    if (!matching) return

    autoSelectDoneRef.current = true
    setSelectedTemplateId(matching.id)

    if ((project.materials || []).length === 0 && matching.items.length > 0) {
      setDraftRows(buildDraftRowsFromTemplate(matching.items))
      setSourceFileName(matching.sourceFileName || '')
    }
  }, [open, mode, templates, project.materials, project.projectType])

  useEffect(() => {
    if (!selectedPlanDocument) return
    setPlanPage(1)
    setPlanPageCount(1)
    setPlanZoom(1)
    setPlanRotation(0)
    setPlanRefreshKey((current) => current + 1)
  }, [planDocumentId, selectedPlanDocument?.id])

  const resolveProduct = (reference: string) => {
    const normalized = normalizeEngineeringText(reference)
    if (!normalized) return null
    if (productCodeMap.has(normalized)) return productCodeMap.get(normalized) || null
    if (productNameMap.has(normalized)) return productNameMap.get(normalized) || null

    return (
      compatibleProducts.find((product) => {
        const name = normalizeEngineeringText(product.name)
        const code = normalizeEngineeringText(product.code)
        return name.includes(normalized) || normalized.includes(name) || code.includes(normalized)
      }) || null
    )
  }

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const items = validateRowsForPersist()
      if (!templateName.trim()) {
        throw new Error(t('projects.validation.templateNameRequired'))
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim(),
          projectType: templateProjectType.trim(),
          sourceFileName,
          items,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || t('projects.toast.engineeringPresetSaveError'))
      }

      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-templates'] })
      toast.success(t('projects.toast.engineeringPresetSaved'))
      if (mode === 'template') {
        onOpenChange(false)
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('projects.toast.engineeringPresetSaveError'))
    },
  })

  const applyEngineeringMutation = useMutation({
    mutationFn: async () => {
      const items = validateRowsForPersist()
      const response = await fetch(`/api/projects/${project.id}/materials/sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, clearMissing: true }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || t('projects.toast.engineeringApplyError'))
      }

      return payload as { keptWithDispatch?: number }
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(
        t('projects.toast.engineeringApplied', {
          count: formatLocaleInteger(locale, nonEmptyRows.length),
        })
      )
      if (payload.keptWithDispatch && payload.keptWithDispatch > 0) {
        toast.info(
          t('projects.toast.engineeringKeptDispatched', {
            count: formatLocaleInteger(locale, payload.keptWithDispatch),
          })
        )
      }
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('projects.toast.engineeringApplyError'))
    },
  })

  function validateRowsForPersist() {
    const rows = draftRows.filter((row) => !isRowEmpty(row))
    if (rows.length === 0) {
      throw new Error(t('projects.validation.templateNeedsItems'))
    }

    const unresolved = rows.filter((row) => !row.productId)
    if (unresolved.length > 0) {
      throw new Error(
        t('projects.validation.engineeringNeedsResolvedProducts', {
          count: formatLocaleInteger(locale, unresolved.length),
        })
      )
    }

    const invalidQty = rows.filter((row) => parseEngineeringQuantity(row.quantity) <= 0)
    if (invalidQty.length > 0) {
      throw new Error(
        t('projects.validation.engineeringNeedsValidQuantities', {
          count: formatLocaleInteger(locale, invalidQty.length),
        })
      )
    }

    return rows.map((row, index) => ({
      productId: row.productId,
      plannedQuantity: parseEngineeringQuantity(row.quantity),
      section: row.section.trim(),
      engineeringSection: row.section.trim(),
      sortOrder: index,
    }))
  }

  function handleLoadTemplate(templateId: string) {
    const template = templates.find((current) => current.id === templateId)
    if (!template) return

    setSelectedTemplateId(templateId)
    setDraftRows(buildDraftRowsFromTemplate(template.items))
    setTemplateName(template.name)
    setTemplateDescription(template.description || '')
    setTemplateProjectType(template.projectType || project.projectType || '')
    setSourceFileName(template.sourceFileName || '')
  }

  function updateDraftRow(id: string, updater: (row: DraftRow) => DraftRow) {
    setDraftRows((current) => current.map((row) => (row.id === id ? updater(row) : row)))
  }

  function syncSectionsFromProducts() {
    setDraftRows((current) =>
      current.map((row) => {
        const product = products.find((p) => p.id === row.productId)
        if (!product?.engineeringSection) return row
        return { ...row, section: product.engineeringSection }
      })
    )
  }

  function addDraftRow() {
    setDraftRows((current) => [
      ...current,
      createDraftRow({
        section: current[current.length - 1]?.section || '',
      }),
    ])
  }

  function removeDraftRow(id: string) {
    setDraftRows((current) => {
      const next = current.filter((row) => row.id !== id)
      return next.length > 0 ? next : [createDraftRow()]
    })
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      })

      const importedRows: DraftRow[] = []
      let currentSection = ''
      let unresolved = 0
      let skipped = 0
      let invalidQuantity = 0

      rawRows.forEach((cells, index) => {
        const first = String(cells?.[0] ?? '').trim()
        const second = cells?.[1] ?? ''
        const third = cells?.[2] ?? ''
        const rowNumber = index + 1

        if (!first && !String(second).trim() && !String(third).trim()) return

        const headerLabels = [first, String(second), String(third)].map(normalizeEngineeringText)
        const looksLikeHeaderRow =
          headerLabels.some((label) => ['code', 'codigo', 'material', 'producto', 'quantity', 'cantidad', 'qty'].includes(label)) &&
          index === 0

        if (looksLikeHeaderRow) return

        const quantity = parseEngineeringQuantity(second)

        if (!first && quantity <= 0) {
          skipped += 1
          return
        }

        if (first && quantity <= 0 && looksLikeSectionLabel(first)) {
          currentSection = first
          return
        }

        const product = resolveProduct(first)
        const hasValidQuantity = quantity > 0

        importedRows.push(
          createDraftRow({
            section: currentSection,
            productId: product?.id || '',
            quantity: hasValidQuantity ? String(quantity) : '',
            sourceLabel: first,
            unresolved: !product,
          })
        )

        if (!product) {
          unresolved += 1
        }

        if (first && quantity <= 0 && !looksLikeSectionLabel(first)) {
          skipped += 1
          invalidQuantity += 1
        }

        if (!product && rowNumber > 0) {
          return
        }
      })

      if (importedRows.length === 0) {
        toast.error(t('projects.toast.engineeringImportError'))
        return
      }

      setDraftRows(importedRows)
      setSelectedTemplateId('')
      setSourceFileName(file.name)
      setShowOnlyReviewRows(unresolved > 0 || invalidQuantity > 0)
      if (!templateName.trim()) {
        setTemplateName(file.name.replace(/\.[^.]+$/, ''))
      }
      toast.success(
        t('projects.toast.engineeringImportSuccess', {
          imported: formatLocaleInteger(locale, importedRows.length),
          unresolved: formatLocaleInteger(locale, unresolved),
          skipped: formatLocaleInteger(locale, skipped),
        })
      )
    } catch {
      toast.error(t('projects.toast.engineeringImportError'))
    } finally {
      event.target.value = ''
    }
  }

  const title =
    mode === 'apply'
      ? t('projects.actions.applyTemplate')
      : t('projects.actions.createTemplate')

  const description =
    mode === 'apply'
      ? t('projects.templates.engineeringDescription')
      : t('projects.templates.createEngineeringDescription')

  const savePending = saveTemplateMutation.isPending
  const applyPending = applyEngineeringMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-6xl">
        <div className={`relative min-h-0 flex flex-1 flex-col ${planOpen && viewerDocuments.length > 0 ? 'lg:pr-[452px]' : ''}`}>
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-600" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {project.projectType ? (
                <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">
                  {t('projects.fields.projectType')}: {project.projectType}
                </Badge>
              ) : null}
              {sourceFileName ? (
                <Badge variant="secondary">{t('projects.templates.importedFile', { file: sourceFileName })}</Badge>
              ) : null}
              <Badge variant="secondary">
                {t('projects.templates.totalRows', { count: formatLocaleInteger(locale, nonEmptyRows.length) })}
              </Badge>
              {unresolvedRowsCount > 0 ? (
                <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                  {t('projects.templates.unresolvedRows', {
                    count: formatLocaleInteger(locale, unresolvedRowsCount),
                  })}
                </Badge>
              ) : null}
              {invalidQuantityCount > 0 ? (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  {t('projects.templates.invalidRows', {
                    count: formatLocaleInteger(locale, invalidQuantityCount),
                  })}
                </Badge>
              ) : null}
              {rowsNeedingReviewCount > 0 ? (
                <Button
                  type="button"
                  variant={showOnlyReviewRows ? 'default' : 'outline'}
                  size="sm"
                  className={showOnlyReviewRows ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}
                  onClick={() => setShowOnlyReviewRows((current) => !current)}
                >
                  {showOnlyReviewRows
                    ? t('projects.templates.showAllRows')
                    : t('projects.templates.showOnlyReviewRows')}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card className="shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t('projects.templates.presetLabel')}</Label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={showAllTemplates}
                            onCheckedChange={(checked) => setShowAllTemplates(checked === true)}
                          />
                          {t('projects.templates.showAllTypes')}
                        </label>
                      </div>
                      <Select
                        value={selectedTemplateId || '__none__'}
                        onValueChange={(value) => {
                          if (value === '__none__') {
                            setSelectedTemplateId('')
                            return
                          }
                          handleLoadTemplate(value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('projects.templates.selectPreset')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('projects.templates.noPresetSelected')}</SelectItem>
                          {availableTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 self-end"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      {t('projects.actions.importExcel')}
                    </Button>

                    <Button type="button" variant="outline" className="gap-2 self-end" onClick={addDraftRow}>
                      <Plus className="h-4 w-4" />
                      {t('projects.templates.addRow')}
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportFile}
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('common.nameRequired')}</Label>
                      <Input
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                        placeholder={t('projects.templates.namePlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('projects.fields.projectType')}</Label>
                      <Input
                        value={templateProjectType}
                        onChange={(event) => setTemplateProjectType(event.target.value)}
                        placeholder={t('projects.fields.projectTypePlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('common.description')}</Label>
                    <Textarea
                      value={templateDescription}
                      onChange={(event) => setTemplateDescription(event.target.value)}
                      placeholder={t('projects.templates.descriptionPlaceholder')}
                      className="min-h-[76px] resize-none"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <div className="grid flex-1 grid-cols-[140px_minmax(0,1fr)_120px_40px] gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          {t('projects.templates.section')}
                          <button
                            type="button"
                            title={t('projects.templates.syncSections')}
                            onClick={syncSectionsFromProducts}
                            className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </span>
                        <span>{t('reports.tables.product')}</span>
                        <span>{t('projects.materials.table.planned')}</span>
                        <span></span>
                      </div>
                      {showOnlyReviewRows ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t('projects.templates.filteredReviewRows', {
                            count: formatLocaleInteger(locale, visibleRows.length),
                          })}
                        </span>
                      ) : null}
                    </div>

                    <ScrollArea className="h-[420px] rounded-md border lg:h-[520px]">
                      <div className="space-y-2 p-3 pb-16">
                        {draftRows.length === 0 ? (
                          <EmptyState
                            icon={FileSpreadsheet}
                            title={t('projects.templates.emptyDraftTitle')}
                            description={t('projects.templates.emptyDraftDescription')}
                          />
                        ) : visibleRows.length === 0 ? (
                          <EmptyState
                            icon={FileSpreadsheet}
                            title={t('projects.templates.emptyReviewTitle')}
                            description={t('projects.templates.emptyReviewDescription')}
                          />
                        ) : (
                          visibleRows.map((row) => {
                            const selectedProduct = products.find((product) => product.id === row.productId)
                            const isMissingProduct = !isRowEmpty(row) && !row.productId
                            const hasInvalidQty = !isRowEmpty(row) && parseEngineeringQuantity(row.quantity) <= 0

                            return (
                              <div
                                key={row.id}
                                className={`grid gap-2 rounded-md border p-3 lg:grid-cols-[140px_minmax(0,1fr)_120px_40px] ${
                                  isMissingProduct || hasInvalidQty ? 'border-amber-200 bg-amber-50/50' : 'bg-background'
                                }`}
                              >
                                <Select
                                  value={row.section || '__none__'}
                                  onValueChange={(val) =>
                                    updateDraftRow(row.id, (current) => ({
                                      ...current,
                                      section: val === '__none__' ? '' : val,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder={t('projects.templates.sectionPlaceholder')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      <span className="text-muted-foreground">— {t('projects.templates.sectionPlaceholder')} —</span>
                                    </SelectItem>
                                    {ENGINEERING_SECTIONS.map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <div className="space-y-1.5">
                                  <ProductPicker
                                    products={products}
                                    selectableProducts={compatibleProducts}
                                    value={row.productId}
                                    onChange={(productId) => {
                                      const picked = products.find((p) => p.id === productId)
                                      updateDraftRow(row.id, (current) => ({
                                        ...current,
                                        productId,
                                        unresolved: false,
                                        section: picked?.engineeringSection || current.section,
                                      }))
                                    }}
                                    placeholder={t('projects.addMaterial.searchPlaceholder')}
                                    invalid={isMissingProduct}
                                  />
                                  {row.sourceLabel ? (
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="text-muted-foreground">
                                        {t('projects.templates.referenceLabel')}: {row.sourceLabel}
                                      </span>
                                      {selectedProduct ? (
                                        <span className="text-muted-foreground">
                                          {selectedProduct.code} · {t('projects.addMaterial.stockLabel', {
                                            count: formatLocaleInteger(locale, selectedProduct.currentStock),
                                          })}
                                        </span>
                                      ) : (
                                        <span className="font-medium text-rose-600">
                                          {t('projects.templates.needsMapping')}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </div>

                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={row.quantity}
                                  onChange={(event) =>
                                    updateDraftRow(row.id, (current) => ({
                                      ...current,
                                      quantity: event.target.value,
                                    }))
                                  }
                                  className={hasInvalidQty ? 'border-amber-300' : ''}
                                  placeholder="0"
                                />

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 text-muted-foreground hover:text-rose-600"
                                  onClick={() => removeDraftRow(row.id)}
                                  aria-label={t('common.delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('projects.templates.workflowTitle')}</p>
                    <p className="text-sm text-muted-foreground">{t('projects.templates.workflowDescription')}</p>
                  </div>

                  <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{t('projects.templates.planPanelTitle')}</p>
                        <p className="text-muted-foreground">{t('projects.templates.planPanelDescription')}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => setPlanOpen((current) => !current)}
                        disabled={viewerDocuments.length === 0}
                      >
                        <Eye className="h-4 w-4" />
                        {planOpen ? t('projects.actions.hidePlan') : t('projects.actions.showPlan')}
                      </Button>
                    </div>

                    {viewerDocuments.length === 0 ? (
                      <div className="rounded-md border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">{t('projects.plan.emptyTitle')}</p>
                        <p className="mt-1">{t('projects.plan.emptyDescription')}</p>
                      </div>
                    ) : (
                      <div className="rounded-md border bg-background px-3 py-3 text-sm">
                        <p className="font-medium">{t('projects.plan.documentsReady', {
                          count: formatLocaleInteger(locale, viewerDocuments.length),
                        })}</p>
                        <p className="mt-1 text-muted-foreground">{t('projects.plan.documentsHint')}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">{t('projects.templates.summaryTitle')}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border bg-background p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          {t('projects.templates.totalRows', { count: formatLocaleInteger(locale, nonEmptyRows.length) })}
                        </p>
                        <p className="mt-1 text-lg font-semibold">{formatLocaleInteger(locale, nonEmptyRows.length)}</p>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          {t('projects.templates.unresolvedRows', {
                            count: formatLocaleInteger(locale, unresolvedRowsCount),
                          })}
                        </p>
                        <p className="mt-1 text-lg font-semibold">{formatLocaleInteger(locale, unresolvedRowsCount)}</p>
                      </div>
                    </div>
                    {mode === 'apply' ? (
                      <div className="rounded-md border bg-background p-3">
                        <p className="text-sm font-medium">{t('projects.actions.syncMaterials')}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('projects.templates.applyProjectDescription')}
                        </p>
                        <Button
                          onClick={() => applyEngineeringMutation.mutate()}
                          disabled={applyPending}
                          className="mt-3 w-full bg-amber-600 text-white hover:bg-amber-700"
                        >
                          {applyPending ? t('common.saveChanges') : t('projects.actions.syncMaterials')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={mode === 'template' ? 'default' : 'outline'}
              onClick={() => saveTemplateMutation.mutate()}
              disabled={savePending}
              className={mode === 'template' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'gap-2'}
            >
              {savePending ? t('projects.actions.creating') : t('projects.actions.savePreset')}
            </Button>
            {mode === 'apply' ? (
              <Button
                onClick={() => applyEngineeringMutation.mutate()}
                disabled={applyPending}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {applyPending ? t('common.saveChanges') : t('projects.actions.syncMaterials')}
              </Button>
            ) : null}
          </DialogFooter>

          {planOpen ? (
            viewerDocuments.length === 0 ? null : (
              <div className="fixed inset-x-4 bottom-4 top-20 z-[70] rounded-lg border bg-background shadow-2xl lg:absolute lg:inset-x-auto lg:bottom-6 lg:right-4 lg:top-24 lg:w-[420px]">
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{t('projects.plan.title')}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPlanDocument?.fileName || t('projects.plan.selectDocument')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (!selectedPlanDocument) return
                          openDocumentViewer({
                            documents: viewerDocuments,
                            initialDocumentId: selectedPlanDocument.id,
                            initialPanel: 'info',
                            contextTitle: t('projects.viewer.contextTitle', { name: project.name }),
                            contextPath: [
                              t('projects.viewer.inventorySection'),
                              t('navigation.page.projects'),
                              project.name,
                              t('projects.tabs.documents'),
                            ],
                          })
                        }}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlanOpen(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 border-b px-4 py-3">
                    <Select value={planDocumentId || selectedPlanDocument?.id || ''} onValueChange={setPlanDocumentId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('projects.plan.selectDocument')} />
                      </SelectTrigger>
                      <SelectContent>
                        {viewerDocuments.map((document) => (
                          <SelectItem key={document.id} value={document.id}>
                            {document.fileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPlanPage((current) => Math.max(current - 1, 1))}
                        disabled={planPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPlanPage((current) => Math.min(current + 1, planPageCount))}
                        disabled={planPage >= planPageCount}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="px-2 text-xs text-muted-foreground">
                        {t('projects.plan.pageSummary', {
                          page: formatLocaleInteger(locale, planPage),
                          total: formatLocaleInteger(locale, planPageCount),
                        })}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="ml-auto h-8 w-8"
                        onClick={() => setPlanZoom((current) => Math.max(0.6, Number((current - 0.1).toFixed(2))))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPlanZoom((current) => Math.min(2, Number((current + 0.1).toFixed(2))))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPlanRotation((current) => (current + 90) % 360)}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPlanRefreshKey((current) => current + 1)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    {selectedPlanDocument ? (
                      <DocumentPreview
                        document={selectedPlanDocument}
                        pageNumber={planPage}
                        refreshKey={planRefreshKey}
                        rotation={planRotation}
                        zoom={planZoom}
                        onLoadSuccess={(pageCount) => {
                          setPlanPageCount(pageCount)
                          setPlanPage((current) => Math.min(current, pageCount))
                        }}
                        onLoadError={() => {
                          setPlanPageCount(1)
                          setPlanPage(1)
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-6">
                        <EmptyState
                          icon={FileText}
                          title={t('projects.plan.emptyTitle')}
                          description={t('projects.plan.emptyDescription')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
