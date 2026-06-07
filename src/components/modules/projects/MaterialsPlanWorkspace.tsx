'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  RotateCw,
  Scissors,
  Search,
  Send,
  ShoppingBag,
  StickyNote,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PlanPdfCanvasProps {
  file: string
  loading: ReactNode
  onLoadError: (error: unknown) => void
  onLoadSuccess: (pageCount: number) => void
  pageNumber: number
  rotation: number
  scale: number
}

const PlanPdfCanvas = dynamic<PlanPdfCanvasProps>(
  async () => {
    const { Document, Page, pdfjs } = await import('react-pdf')

    // Worker via CDN — funciona consistente en Turbopack sin depender de import.meta.url
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

    function PlanPdfCanvasComponent({
      file,
      loading,
      onLoadError,
      onLoadSuccess,
      pageNumber,
      rotation,
      scale,
    }: PlanPdfCanvasProps) {
      return (
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
          onLoadError={onLoadError}
          loading={loading}
        >
          <Page
            pageNumber={pageNumber}
            rotate={rotation}
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="bg-white shadow-md"
          />
        </Document>
      )
    }

    return PlanPdfCanvasComponent
  },
  { ssr: false },
)

// ─────────────────────────────────────────────────────────────────────
// useSplitViewSettings — persistencia por proyecto en localStorage
// ─────────────────────────────────────────────────────────────────────

export function useSplitViewSettings(projectId: string) {
  const [enabled, setEnabledState] = useState(false)
  const [ratio, setRatioState] = useState(0.5)
  const [selectedPlanId, setSelectedPlanIdState] = useState<string | null>(null)
  const [listCollapsed, setListCollapsedState] = useState(false)
  const [headerCollapsed, setHeaderCollapsedState] = useState(false)

  // Cargar al montar
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const flag = window.localStorage.getItem(`mat-split-${projectId}`)
      setEnabledState(flag === '1')
      const r = Number(window.localStorage.getItem(`mat-split-ratio-${projectId}`))
      if (r > 0 && r < 1) setRatioState(r)
      const planId = window.localStorage.getItem(`mat-split-plan-${projectId}`)
      setSelectedPlanIdState(planId)
      setListCollapsedState(window.localStorage.getItem(`mat-split-list-${projectId}`) === '1')
      setHeaderCollapsedState(window.localStorage.getItem(`proj-header-${projectId}`) === '1')
    } catch {
      // localStorage no disponible — usar defaults
    }
  }, [projectId])

  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value)
      try {
        window.localStorage.setItem(`mat-split-${projectId}`, value ? '1' : '0')
      } catch {
        /* noop */
      }
    },
    [projectId]
  )

  const setRatio = useCallback(
    (value: number) => {
      const clamped = Math.max(0.25, Math.min(0.75, value))
      setRatioState(clamped)
      try {
        window.localStorage.setItem(`mat-split-ratio-${projectId}`, String(clamped))
      } catch {
        /* noop */
      }
    },
    [projectId]
  )

  const setSelectedPlanId = useCallback(
    (id: string | null) => {
      setSelectedPlanIdState(id)
      try {
        if (id) window.localStorage.setItem(`mat-split-plan-${projectId}`, id)
        else window.localStorage.removeItem(`mat-split-plan-${projectId}`)
      } catch {
        /* noop */
      }
    },
    [projectId]
  )

  const setListCollapsed = useCallback(
    (value: boolean) => {
      setListCollapsedState(value)
      try {
        window.localStorage.setItem(`mat-split-list-${projectId}`, value ? '1' : '0')
      } catch {
        /* noop */
      }
    },
    [projectId]
  )

  const setHeaderCollapsed = useCallback(
    (value: boolean) => {
      setHeaderCollapsedState(value)
      try {
        window.localStorage.setItem(`proj-header-${projectId}`, value ? '1' : '0')
      } catch {
        /* noop */
      }
    },
    [projectId]
  )

  return {
    enabled,
    setEnabled,
    ratio,
    setRatio,
    selectedPlanId,
    setSelectedPlanId,
    listCollapsed,
    setListCollapsed,
    headerCollapsed,
    setHeaderCollapsed,
  }
}

// ─────────────────────────────────────────────────────────────────────
// SplitDragHandle — arrastrable, ajusta proporción del workspace
// ─────────────────────────────────────────────────────────────────────

export function SplitDragHandle({
  containerRef,
  onResize,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  onResize: (ratio: number) => void
}) {
  const draggingRef = useRef(false)

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newRatio = (event.clientX - rect.left) / rect.width
      onResize(newRatio)
    }
    function handleMouseUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef, onResize])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="group relative cursor-col-resize bg-border hover:bg-primary/30 transition-colors"
      onMouseDown={(event) => {
        event.preventDefault()
        draggingRef.current = true
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }}
    >
      <div className="absolute inset-y-0 left-1/2 flex w-3 -translate-x-1/2 items-center justify-center">
        <div className="text-[10px] leading-none tracking-tighter text-muted-foreground/50 group-hover:text-muted-foreground">
          ⋮⋮
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// PlanPdfPane — visor embebido del plano de ingeniería
// ─────────────────────────────────────────────────────────────────────

interface PdfDocLike {
  id: string
  fileName: string
  fileType: string
  category: string
}

interface PlanPdfPaneProps {
  projectId: string
  documents: PdfDocLike[]
  selectedPlanId: string | null
  onSelectPlan: (id: string | null) => void
  onOpenFullViewer?: () => void
  onUploadPlan?: () => void
}

function isPdfDoc(d: PdfDocLike): boolean {
  if (d.fileType?.toLowerCase().includes('pdf')) return true
  return Boolean(d.fileName?.toLowerCase().endsWith('.pdf'))
}

function planPageStorageKey(projectId: string, documentId: string): string {
  return `mat-split-plan-page-${projectId}-${documentId}`
}

function planRotationStorageKey(projectId: string, documentId: string): string {
  return `mat-split-plan-rotation-${projectId}-${documentId}`
}

function planZoomStorageKey(projectId: string, documentId: string): string {
  return `mat-split-plan-zoom-${projectId}-${documentId}`
}

function readStoredPlanPage(projectId: string, documentId: string): number {
  if (typeof window === 'undefined') return 1

  try {
    const page = Number(window.localStorage.getItem(planPageStorageKey(projectId, documentId)))
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  } catch {
    return 1
  }
}

function normalizeRotation(value: number): number {
  const normalized = Math.round(value / 90) * 90
  return ((normalized % 360) + 360) % 360
}

function normalizeZoom(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0.5, Math.min(3, Math.round(value * 10) / 10))
}

function readStoredPlanRotation(projectId: string, documentId: string): number {
  if (typeof window === 'undefined') return 0

  try {
    const rotation = Number(window.localStorage.getItem(planRotationStorageKey(projectId, documentId)))
    return Number.isFinite(rotation) ? normalizeRotation(rotation) : 0
  } catch {
    return 0
  }
}

function readStoredPlanZoom(projectId: string, documentId: string): number {
  if (typeof window === 'undefined') return 1

  try {
    const zoom = Number(window.localStorage.getItem(planZoomStorageKey(projectId, documentId)))
    return normalizeZoom(zoom)
  } catch {
    return 1
  }
}

function storePlanPage(projectId: string, documentId: string, page: number) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(planPageStorageKey(projectId, documentId), String(Math.max(1, Math.floor(page))))
  } catch {
    /* noop */
  }
}

function storePlanRotation(projectId: string, documentId: string, rotation: number) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(planRotationStorageKey(projectId, documentId), String(normalizeRotation(rotation)))
  } catch {
    /* noop */
  }
}

function storePlanZoom(projectId: string, documentId: string, zoom: number) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(planZoomStorageKey(projectId, documentId), String(normalizeZoom(zoom)))
  } catch {
    /* noop */
  }
}

export function PlanPdfPane({
  projectId,
  documents,
  selectedPlanId,
  onSelectPlan,
  onOpenFullViewer,
  onUploadPlan,
}: PlanPdfPaneProps) {
  const pdfDocs = documents.filter(isPdfDoc)
  const engineeringDocs = pdfDocs.filter((d) => d.category === 'engineering')
  const defaultDoc = engineeringDocs[0] || pdfDocs[0]

  const currentDocId =
    selectedPlanId && pdfDocs.some((d) => d.id === selectedPlanId)
      ? selectedPlanId
      : defaultDoc?.id ?? null

  const currentDoc = currentDocId ? pdfDocs.find((d) => d.id === currentDocId) ?? null : null

  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  const [scale, setScale] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setPageNumber(currentDocId ? readStoredPlanPage(projectId, currentDocId) : 1)
    setRotation(currentDocId ? readStoredPlanRotation(projectId, currentDocId) : 0)
    setScale(currentDocId ? readStoredPlanZoom(projectId, currentDocId) : 1)
    setNumPages(null)
    setLoadError(null)
  }, [currentDocId, projectId])

  // Pre-flight HEAD check: if the file is missing on disk (404), surface a friendly
  // error without invoking react-pdf — which otherwise floods the console with
  // "ResponseException: Unexpected server response (404)" warnings from pdf.js.
  const [pdfAvailable, setPdfAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    if (!currentDocId) {
      setPdfAvailable(null)
      return
    }
    let cancelled = false
    setPdfAvailable(null)
    fetch(`/api/projects/${projectId}/documents/${currentDocId}`, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setPdfAvailable(true)
        } else {
          setPdfAvailable(false)
          setLoadError('archivo no disponible en el servidor')
        }
      })
      .catch(() => {
        if (cancelled) return
        setPdfAvailable(false)
        setLoadError('archivo no disponible en el servidor')
      })
    return () => {
      cancelled = true
    }
  }, [currentDocId, projectId])

  if (pdfDocs.length === 0 || !currentDoc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/20 p-8 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">Sin planos PDF cargados</p>
        <p className="text-xs text-muted-foreground/80">
          Subí planos en la tab Documentos (categoría Ingeniería).
        </p>
        {onUploadPlan && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onUploadPlan}>
            Ir a Documentos
          </Button>
        )}
      </div>
    )
  }

  const pdfUrl = `/api/projects/${projectId}/documents/${currentDoc.id}`

  // Pan-with-drag (click sostenido) sobre el canvas del PDF
  const pdfCanvasRef = useRef<HTMLDivElement>(null)
  const panStateRef = useRef<{ x: number; y: number; scrollX: number; scrollY: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  const setAndStorePageNumber = useCallback(
    (nextPage: number | ((currentPage: number) => number)) => {
      if (!currentDocId) return

      setPageNumber((currentPage) => {
        const resolvedPage = typeof nextPage === 'function' ? nextPage(currentPage) : nextPage
        const clampedPage = Math.max(1, Math.floor(resolvedPage))
        storePlanPage(projectId, currentDocId, clampedPage)
        return clampedPage
      })
    },
    [currentDocId, projectId],
  )

  const setAndStoreScale = useCallback(
    (nextScale: number | ((currentScale: number) => number)) => {
      if (!currentDocId) return

      setScale((currentScale) => {
        const resolvedScale = typeof nextScale === 'function' ? nextScale(currentScale) : nextScale
        const normalizedScale = normalizeZoom(resolvedScale)
        storePlanZoom(projectId, currentDocId, normalizedScale)
        return normalizedScale
      })
    },
    [currentDocId, projectId],
  )

  const rotatePlan = useCallback(() => {
    if (!currentDocId) return

    setRotation((currentRotation) => {
      const nextRotation = normalizeRotation(currentRotation + 90)
      storePlanRotation(projectId, currentDocId, nextRotation)
      return nextRotation
    })
  }, [currentDocId, projectId])

  function handlePanStart(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return // sólo botón izquierdo
    if (!pdfCanvasRef.current) return
    panStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollX: pdfCanvasRef.current.scrollLeft,
      scrollY: pdfCanvasRef.current.scrollTop,
    }
    setIsPanning(true)
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!panStateRef.current || !pdfCanvasRef.current) return
      const dx = event.clientX - panStateRef.current.x
      const dy = event.clientY - panStateRef.current.y
      pdfCanvasRef.current.scrollLeft = panStateRef.current.scrollX - dx
      pdfCanvasRef.current.scrollTop = panStateRef.current.scrollY - dy
    }
    function handleMouseUp() {
      if (!panStateRef.current) return
      panStateRef.current = null
      setIsPanning(false)
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-muted/10">
      {/* Header — fila 1: selector + expand */}
      <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select
            value={currentDoc.id}
            onValueChange={(v) => {
              onSelectPlan(v)
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pdfDocs.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.category === 'engineering' ? `[ING] ${d.fileName}` : d.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {onOpenFullViewer && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onOpenFullViewer}
            title="Abrir en pantalla completa"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Header — fila 2: navegación de página + zoom (siempre visible arriba) */}
      {numPages && numPages > 0 && (
        <div className="flex items-center justify-center gap-2 border-b bg-background px-3 py-1.5 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAndStorePageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="tabular-nums">
            Página {pageNumber} de {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAndStorePageNumber((p) => Math.min(numPages || 1, p + 1))}
            disabled={pageNumber >= (numPages || 1)}
            title="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="mx-2 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAndStoreScale((s) => s - 0.1)}
            title="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAndStoreScale((s) => s + 0.1)}
            title="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={rotatePlan}
            title={`Rotar ${rotation}°`}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* PDF canvas — pan con click sostenido */}
      <div
        ref={pdfCanvasRef}
        onMouseDown={handlePanStart}
        className={`flex min-h-0 flex-1 items-start justify-center overflow-auto bg-muted/30 p-4 pb-24 ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        } select-none`}
      >
        {loadError ? (
          <div className="m-auto rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            No se pudo cargar el plano: {loadError}
          </div>
        ) : pdfAvailable === false ? null : pdfAvailable === null ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando plano…
          </div>
        ) : (
          <div className="pointer-events-none" draggable={false}>
            <PlanPdfCanvas
              file={pdfUrl}
              pageNumber={pageNumber}
              rotation={rotation}
              scale={scale}
              onLoadSuccess={(n) => {
                const validPageCount = Math.max(1, n)
                setNumPages(validPageCount)
                setAndStorePageNumber((p) => Math.min(validPageCount, Math.max(1, p)))
                setLoadError(null)
              }}
              onLoadError={(error) =>
                setLoadError(error instanceof Error ? error.message : 'error al cargar')
              }
              loading={
                <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando plano…
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// MaterialsCompactView — lista densa con secciones, chips y acciones inline
// ─────────────────────────────────────────────────────────────────────

export interface CompactMaterial {
  id: string
  productId: string
  productName: string
  productCode: string
  section: string
  plannedQuantity: number
  dispatchedQuantity: number
  returnedQuantity: number
  notes: string
  // Cobertura calculada
  canDispatch: boolean
  needsPurchase: boolean
  inStock: number
  uncovered: number
  gap: number
  cuttableStock?: number
  cutSourceLabel?: string
  cutSourceLength?: number
}

interface MaterialsCompactViewProps {
  materials: CompactMaterial[]
  isPostDispatch: boolean
  search: string
  onSearchChange: (s: string) => void
  actionFilter: 'all' | 'dispatch' | 'order'
  onActionFilterChange: (v: 'all' | 'dispatch' | 'order') => void
  // Inline qty edit (estado controlado desde el padre)
  editingMaterialId: string | null
  editingQty: string
  onEditingQtyChange: (s: string) => void
  onStartEdit: (mat: CompactMaterial) => void
  onCancelEdit: () => void
  onSaveEdit: (matId: string, dispatchedQty: number) => void
  isEditPending: boolean
  // Inline note edit (mismo patrón que qty)
  editingNoteMaterialId: string | null
  editingNote: string
  onEditingNoteChange: (s: string) => void
  onStartEditNote: (mat: CompactMaterial) => void
  onCancelEditNote: () => void
  onSaveEditNote: (matId: string) => void
  isEditNotePending: boolean
  // Otras acciones (reusan dialogs/mutations existentes)
  onDelete: (matId: string) => void
  onDispatch: (mat: CompactMaterial) => void
  onRequest: (mat: CompactMaterial) => void
  onSwitch: (mat: CompactMaterial) => void
  // Botón opcional para colapsar la lista (solo en split mode con pane izquierdo)
  onCollapse?: () => void
  scrollStorageKey?: string
}

function sectionId(section: string): string {
  return `mat-section-${section.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
}

export function MaterialsCompactView({
  materials,
  isPostDispatch,
  search,
  onSearchChange,
  actionFilter,
  onActionFilterChange,
  editingMaterialId,
  editingQty,
  onEditingQtyChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  isEditPending,
  editingNoteMaterialId,
  editingNote,
  onEditingNoteChange,
  onStartEditNote,
  onCancelEditNote,
  onSaveEditNote,
  isEditNotePending,
  onDelete,
  onDispatch,
  onRequest,
  onSwitch,
  onCollapse,
  scrollStorageKey,
}: MaterialsCompactViewProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const scrollRestoredRef = useRef(false)
  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials.filter((m) => {
      if (actionFilter === 'dispatch' && !m.canDispatch) return false
      if (actionFilter === 'order' && !m.needsPurchase) return false
      if (!q) return true
      return (
        m.productName.toLowerCase().includes(q) ||
        m.productCode.toLowerCase().includes(q) ||
        m.section.toLowerCase().includes(q)
      )
    })
  }, [materials, search, actionFilter])

  // Agrupar materiales filtrados por sección (manteniendo orden de aparición)
  const sectionGroups = useMemo(() => {
    const groups: { section: string; items: CompactMaterial[] }[] = []
    for (const m of filteredMaterials) {
      const section = m.section || 'Sin sección'
      const last = groups[groups.length - 1]
      if (last && last.section === section) {
        last.items.push(m)
      } else {
        groups.push({ section, items: [m] })
      }
    }
    return groups
  }, [filteredMaterials])

  const dispatchCount = useMemo(() => materials.filter((m) => m.canDispatch).length, [materials])
  const orderCount = useMemo(() => materials.filter((m) => m.needsPurchase).length, [materials])

  useEffect(() => {
    scrollRestoredRef.current = false
  }, [scrollStorageKey])

  useEffect(() => {
    if (!scrollStorageKey || scrollRestoredRef.current || typeof window === 'undefined') return

    const frame = window.requestAnimationFrame(() => {
      const savedTop = Number(window.localStorage.getItem(scrollStorageKey))
      if (Number.isFinite(savedTop) && savedTop > 0 && listRef.current) {
        listRef.current.scrollTop = savedTop
      }
      scrollRestoredRef.current = true
    })

    return () => window.cancelAnimationFrame(frame)
  }, [scrollStorageKey, sectionGroups.length, filteredMaterials.length])

  const handleListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!scrollStorageKey || typeof window === 'undefined') return
      window.localStorage.setItem(scrollStorageKey, String(event.currentTarget.scrollTop))
    },
    [scrollStorageKey],
  )

  function coverageDot(mat: CompactMaterial) {
    // verde = cubierto, ámbar = parcial, rojo = faltante puro
    const totalPlanned = mat.plannedQuantity
    const covered = totalPlanned - mat.uncovered
    if (mat.uncovered === 0) return { tone: 'bg-emerald-500', title: 'Cubierto' }
    if (covered > 0) return { tone: 'bg-amber-500', title: 'Parcial' }
    return { tone: 'bg-rose-500', title: 'Faltante' }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">

      {/* Search + filter pills */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background p-2">
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Colapsar lista (mostrar solo el plano)"
            aria-label="Colapsar lista"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
        <div className="relative min-w-[140px] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar material por nombre o código..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        {dispatchCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onActionFilterChange(actionFilter === 'dispatch' ? 'all' : 'dispatch')
            }
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              actionFilter === 'dispatch'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Send className="h-3 w-3" />
            {dispatchCount} por despachar
          </button>
        )}
        {orderCount > 0 && (
          <button
            type="button"
            onClick={() => onActionFilterChange(actionFilter === 'order' ? 'all' : 'order')}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              actionFilter === 'order'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <ShoppingBag className="h-3 w-3" />
            {orderCount} por pedir
          </button>
        )}
        {actionFilter !== 'all' && (
          <button
            type="button"
            onClick={() => onActionFilterChange('all')}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* List */}
      <div ref={listRef} onScroll={handleListScroll} className="min-h-0 flex-1 overflow-auto">
        {filteredMaterials.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search || actionFilter !== 'all'
              ? 'Sin materiales que coincidan con el filtro.'
              : 'Sin materiales en el proyecto.'}
          </div>
        ) : (
          sectionGroups.map(({ section, items }) => {
            const coveredCount = items.filter(m => m.uncovered === 0).length
            const pct = items.length > 0 ? Math.round((coveredCount / items.length) * 100) : 0
            const borderColor = pct >= 80 ? 'border-l-emerald-400' : pct >= 20 ? 'border-l-amber-400' : 'border-l-rose-400'

            return (
            <div key={section}>
              <div
                id={sectionId(section)}
                className={`sticky top-0 z-10 flex items-center gap-2 border-b border-l-3 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-400 ${borderColor}`}
              >
                <span className="truncate flex-1">{section}</span>
                <span className="rounded bg-slate-200 px-1.5 font-semibold tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {items.length}
                </span>
              </div>
              {items.map((mat) => {
                const isEditing = editingMaterialId === mat.id
                const dot = coverageDot(mat)
                const borderColor = dot.tone === 'bg-emerald-500' ? 'border-l-emerald-400' : dot.tone === 'bg-amber-500' ? 'border-l-amber-400' : 'border-l-rose-400'
                const qtyBgColor = dot.tone === 'bg-emerald-500' ? 'bg-emerald-50 border-emerald-200' : dot.tone === 'bg-amber-500' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
                const qtyTextColor = dot.tone === 'bg-emerald-500' ? 'text-emerald-700' : dot.tone === 'bg-amber-500' ? 'text-amber-700' : 'text-rose-700'
                return (
                  <div
                    key={mat.id}
                    className={`group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 border-b border-l-2 border-border/40 px-3 py-1 transition hover:bg-muted/40 ${borderColor}`}
                  >
                    {/* Name (click to switch product) + nota inline + chips condicionales de despachado/devuelto */}
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSwitch(mat)}
                        disabled={isPostDispatch || mat.dispatchedQuantity > 0}
                        className="group/name flex min-w-0 shrink-0 items-center gap-1 text-left disabled:cursor-not-allowed disabled:opacity-100"
                        title={
                          mat.dispatchedQuantity > 0
                            ? `${mat.productCode} — No se puede cambiar (ya despachado)`
                            : `${mat.productCode} — Click para cambiar el producto`
                        }
                      >
                        <span className="truncate text-sm font-medium text-foreground transition group-hover/name:text-cyan-700 group-hover/name:underline group-hover/name:decoration-dotted group-hover/name:underline-offset-2 group-disabled/name:no-underline group-disabled/name:hover:text-foreground">
                          {mat.productName}
                        </span>
                        {!isPostDispatch && mat.dispatchedQuantity === 0 && (
                          <ArrowLeftRight className="h-3 w-3 shrink-0 text-cyan-500 opacity-0 transition-opacity group-hover/name:opacity-100" />
                        )}
                      </button>
                      {editingNoteMaterialId === mat.id ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                          <span className="text-xs text-muted-foreground">—</span>
                          <Input
                            type="text"
                            value={editingNote}
                            maxLength={150}
                            onChange={(e) => onEditingNoteChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSaveEditNote(mat.id)
                              if (e.key === 'Escape') onCancelEditNote()
                            }}
                            onBlur={() => onSaveEditNote(mat.id)}
                            autoFocus
                            disabled={isEditNotePending}
                            placeholder="ej: una pata con un centro, 4 tornillos arriba…"
                            className="h-6 flex-1 text-xs italic"
                          />
                        </div>
                      ) : mat.notes ? (
                        <button
                          type="button"
                          onClick={() => onStartEditNote(mat)}
                          className="min-w-0 truncate text-left text-xs italic text-muted-foreground hover:text-foreground"
                          title={`${mat.notes} (click para editar)`}
                        >
                          — {mat.notes}
                        </button>
                      ) : !isPostDispatch ? (
                        <button
                          type="button"
                          onClick={() => onStartEditNote(mat)}
                          className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] italic text-muted-foreground/70 opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          title="Agregar nota"
                        >
                          <StickyNote className="h-3 w-3" />
                          nota
                        </button>
                      ) : null}
                      {mat.dispatchedQuantity > 0 && (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                          title={`${mat.dispatchedQuantity} despachados`}
                        >
                          <Check className="h-2.5 w-2.5" />
                          {mat.dispatchedQuantity} desp
                        </span>
                      )}
                      {mat.returnedQuantity > 0 && (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                          title={`${mat.returnedQuantity} devueltos`}
                        >
                          ↩ {mat.returnedQuantity} dev
                        </span>
                      )}
                    </div>

                    {/* Qty — click to edit inline */}
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={mat.dispatchedQuantity || 1}
                          step="any"
                          value={editingQty}
                          onChange={(e) => onEditingQtyChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const qty = parseFloat(editingQty)
                              if (Number.isFinite(qty) && qty > 0) {
                                onSaveEdit(mat.id, mat.dispatchedQuantity)
                              }
                            }
                            if (e.key === 'Escape') onCancelEdit()
                          }}
                          autoFocus
                          disabled={isEditPending}
                          className="h-7 w-24 font-mono text-right text-xs tabular-nums"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => onSaveEdit(mat.id, mat.dispatchedQuantity)}
                          disabled={isEditPending}
                          title="Guardar (Enter)"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={onCancelEdit}
                          disabled={isEditPending}
                          title="Cancelar (Esc)"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartEdit(mat)}
                        disabled={isPostDispatch}
                        className={`group/qty inline-flex items-center justify-center gap-1 rounded border px-2 py-1 font-mono text-xs tabular-nums font-semibold transition disabled:cursor-not-allowed disabled:opacity-100 ${qtyBgColor} ${qtyTextColor} hover:brightness-95 min-w-14`}
                        title={
                          isPostDispatch
                            ? 'Proyecto cerrado, no se puede editar'
                            : 'Click para editar cantidad'
                        }
                      >
                        <span>{mat.plannedQuantity}</span>
                        {!isPostDispatch && (
                          <Edit3 className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/qty:opacity-60" />
                        )}
                      </button>
                    )}

                    {/* Coverage dot */}
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full ${dot.tone}`}
                      title={dot.title}
                    />

                    {/* Inline contextual actions */}
                    <div className="flex items-center gap-1">
                      {mat.canDispatch && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px] text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onDispatch(mat)}
                          title={
                            mat.inStock > 0
                              ? `Despachar ${Math.min(mat.gap, mat.inStock)} unidades`
                              : `Cortar desde ${mat.cutSourceLabel || `${mat.cutSourceLength || ''}'`}`
                          }
                        >
                          {mat.inStock > 0 ? <Send className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
                          {mat.inStock > 0 ? 'Despachar' : `Cortar ${mat.cutSourceLength ? `${mat.cutSourceLength}'` : ''}`}
                        </Button>
                      )}
                      {mat.needsPurchase && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px] text-blue-700 hover:bg-blue-50"
                          onClick={() => onRequest(mat)}
                          title={`Faltan ${mat.uncovered} unidades`}
                        >
                          <ShoppingBag className="h-3 w-3" />
                          Pedir
                        </Button>
                      )}
                    </div>

                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground opacity-60 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                      onClick={() => onDelete(mat.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// CollapsedListStrip — strip vertical (~52px) cuando la lista está colapsada
// Muestra: chevron expandir + label vertical + chips de cobertura por sección
// ─────────────────────────────────────────────────────────────────────

interface CollapsedListStripProps {
  materials: CompactMaterial[]
  onExpand: () => void
}

export function CollapsedListStrip({ materials, onExpand }: CollapsedListStripProps) {
  // Resumen por sección: cuántos cubiertos / parciales / faltantes
  const sectionSummaries = useMemo(() => {
    const summaries: {
      section: string
      total: number
      tone: 'emerald' | 'amber' | 'rose'
      title: string
    }[] = []
    const order: string[] = []
    const map = new Map<string, { covered: number; partial: number; missing: number; total: number }>()

    for (const m of materials) {
      const section = m.section || 'Sin sección'
      if (!map.has(section)) {
        map.set(section, { covered: 0, partial: 0, missing: 0, total: 0 })
        order.push(section)
      }
      const stat = map.get(section)!
      stat.total += 1
      const covered = m.plannedQuantity - m.uncovered
      if (m.uncovered === 0) stat.covered += 1
      else if (covered > 0) stat.partial += 1
      else stat.missing += 1
    }

    for (const section of order) {
      const stat = map.get(section)!
      let tone: 'emerald' | 'amber' | 'rose' = 'emerald'
      if (stat.missing > 0) tone = 'rose'
      else if (stat.partial > 0) tone = 'amber'
      const parts: string[] = []
      if (stat.covered > 0) parts.push(`${stat.covered} cubiertos`)
      if (stat.partial > 0) parts.push(`${stat.partial} parciales`)
      if (stat.missing > 0) parts.push(`${stat.missing} faltantes`)
      summaries.push({
        section,
        total: stat.total,
        tone,
        title: `${section} · ${parts.join(' · ') || `${stat.total} items`}`,
      })
    }

    return summaries
  }, [materials])

  const toneClasses: Record<'emerald' | 'amber' | 'rose', string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 border-r bg-card py-2">
      <button
        type="button"
        onClick={onExpand}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Expandir lista de materiales"
        aria-label="Expandir lista"
      >
        <ChevronsRight className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onExpand}
        className="flex flex-1 flex-col items-center justify-start gap-2 overflow-hidden text-muted-foreground hover:text-foreground"
        title={`${materials.length} materiales — click para expandir`}
      >
        <div
          className="select-none whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Materiales · {materials.length}
        </div>

        <div className="mt-2 flex flex-col items-center gap-1.5">
          {sectionSummaries.map((s) => (
            <span
              key={s.section}
              className={`h-2.5 w-2.5 rounded-full ${toneClasses[s.tone]} ring-1 ring-white/40`}
              title={s.title}
            />
          ))}
        </div>
      </button>
    </div>
  )
}
