'use client'

import {
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Printer,
  RefreshCw,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Button } from '@/components/ui/button'

interface DocumentToolbarProps {
  canDelete: boolean
  canNextPage: boolean
  canPreviousPage: boolean
  currentPage: number
  isDeleting: boolean
  isPdf: boolean
  totalPages: number
  zoom: number
  onDelete: () => void
  onDownload: () => void
  onNextPage: () => void
  onOpenComments: () => void
  onPreviousPage: () => void
  onPrint: () => void
  onRefresh: () => void
  onRotate: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function DocumentToolbar({
  canDelete,
  canNextPage,
  canPreviousPage,
  currentPage,
  isDeleting,
  isPdf,
  totalPages,
  zoom,
  onDelete,
  onDownload,
  onNextPage,
  onOpenComments,
  onPreviousPage,
  onPrint,
  onRefresh,
  onRotate,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: DocumentToolbarProps) {
  const { t } = useI18n()

  return (
    <div className="border-t border-border/70 bg-card/90 px-3 py-3 backdrop-blur md:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onOpenComments} className="gap-2 rounded-md">
            <MessageSquare className="h-4 w-4" />
            {t('documents.toolbar.comments')}
          </Button>
          <Button variant="outline" size="sm" onClick={onZoomOut} className="rounded-md">
            <ZoomOut className="h-4 w-4" />
            <span className="sr-only">{t('documents.toolbar.zoomOut')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onZoomIn} className="rounded-md">
            <ZoomIn className="h-4 w-4" />
            <span className="sr-only">{t('documents.toolbar.zoomIn')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onZoomReset} className="min-w-16 rounded-md">
            {Math.round(zoom * 100)}%
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousPage}
            disabled={!isPdf || !canPreviousPage}
            className="rounded-md"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">{t('documents.toolbar.previousPage')}</span>
          </Button>
          <div className="min-w-24 rounded-md border border-border/80 bg-background/80 px-3 py-1 text-center text-sm tabular-nums">
            {currentPage} / {totalPages || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={!isPdf || !canNextPage}
            className="rounded-md"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">{t('documents.toolbar.nextPage')}</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRotate} className="rounded-md">
            <RotateCw className="h-4 w-4" />
            {t('documents.toolbar.rotate')}
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} className="rounded-md">
            <RefreshCw className="h-4 w-4" />
            {t('documents.toolbar.refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload} className="rounded-md">
            <Download className="h-4 w-4" />
            {t('documents.toolbar.download')}
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint} className="rounded-md">
            <Printer className="h-4 w-4" />
            {t('documents.toolbar.print')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={!canDelete || isDeleting}
            className="rounded-md"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? t('documents.toolbar.deleting') : t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  )
}
