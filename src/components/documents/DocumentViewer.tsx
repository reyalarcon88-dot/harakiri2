'use client'

import { useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useI18n } from '@/components/layout/I18nProvider'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { DocumentHeader } from '@/components/documents/DocumentHeader'
import { DocumentPreview } from '@/components/documents/DocumentPreview'
import { DocumentSidebar } from '@/components/documents/DocumentSidebar'
import { DocumentToolbar } from '@/components/documents/DocumentToolbar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildDocumentDownloadUrl, getDocumentPreviewKind, resolveDocumentUrl } from '@/lib/document-utils'
import { useDocumentViewerStore } from '@/stores/document-viewer'
import type { InventoryDocumentRecord } from '@/types/documents'

interface DocumentViewerSessionProps {
  activePanel: ReturnType<typeof useDocumentViewerStore.getState>['activePanel']
  canDelete: boolean
  closeViewer: () => void
  contextPath: string[]
  contextTitle: string
  currentDocument: InventoryDocumentRecord
  currentIndex: number
  deleteCurrentDocument: () => Promise<void>
  documents: InventoryDocumentRecord[]
  isDeleting: boolean
  nextDocument: () => void
  previousDocument: () => void
  setActivePanel: ReturnType<typeof useDocumentViewerStore.getState>['setActivePanel']
  setCurrentIndex: (index: number) => void
}

function DocumentViewerSession({
  activePanel,
  canDelete,
  closeViewer,
  contextPath,
  contextTitle,
  currentDocument,
  currentIndex,
  deleteCurrentDocument,
  documents,
  isDeleting,
  nextDocument,
  previousDocument,
  setActivePanel,
  setCurrentIndex,
}: DocumentViewerSessionProps) {
  const { t } = useI18n()
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const previewKind = getDocumentPreviewKind(currentDocument)
  const isPdf = previewKind === 'pdf'
  const canPreviousDocument = currentIndex > 0
  const canNextDocument = currentIndex < documents.length - 1

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = buildDocumentDownloadUrl(currentDocument)
    link.download = currentDocument.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [currentDocument])

  const handlePrint = useCallback(() => {
    const target = window.open(resolveDocumentUrl(currentDocument), '_blank', 'noopener,noreferrer')
    if (!target) return

    const tryPrint = () => {
      try {
        target.print()
      } catch {
        // ignore
      }
    }

    target.addEventListener('load', tryPrint, { once: true })
    window.setTimeout(tryPrint, 900)
  }, [currentDocument])

  const handleDelete = useCallback(async () => {
    try {
      await deleteCurrentDocument()
      setDeleteDialogOpen(false)
      toast.success(t('documents.toast.deleted'))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('documents.toast.deleteError')
      toast.error(message)
    }
  }, [deleteCurrentDocument, t])

  const handlePreviewLoadError = useCallback((message: string) => {
    if (message) {
      toast.error(message)
    }
  }, [])

  const handlePreviewLoadSuccess = useCallback((pageCount: number) => {
    setTotalPages(pageCount || 1)
    setCurrentPage((page) => Math.min(Math.max(page, 1), pageCount || 1))
  }, [])

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <DocumentHeader
          document={currentDocument}
          contextTitle={contextTitle}
          contextPath={contextPath}
          documentIndex={currentIndex}
          totalDocuments={documents.length}
          onClose={closeViewer}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative flex min-h-0 flex-col">
            <div className="relative min-h-0 flex-1">
              {documents.length > 1 ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={previousDocument}
                    disabled={!canPreviousDocument}
                    className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-md bg-background/90 shadow-sm backdrop-blur"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">{t('documents.viewer.previousDocument')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={nextDocument}
                    disabled={!canNextDocument}
                    className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-md bg-background/90 shadow-sm backdrop-blur"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">{t('documents.viewer.nextDocument')}</span>
                  </Button>
                </>
              ) : null}

              <DocumentPreview
                key={`${currentDocument.id}-${refreshKey}`}
                document={currentDocument}
                pageNumber={currentPage}
                refreshKey={refreshKey}
                rotation={rotation}
                zoom={zoom}
                onLoadError={handlePreviewLoadError}
                onLoadSuccess={handlePreviewLoadSuccess}
              />
            </div>

            <DocumentToolbar
              canDelete={canDelete}
              canNextPage={currentPage < totalPages}
              canPreviousPage={currentPage > 1}
              currentPage={currentPage}
              isDeleting={isDeleting}
              isPdf={isPdf}
              totalPages={totalPages}
              zoom={zoom}
              onDelete={() => setDeleteDialogOpen(true)}
              onDownload={handleDownload}
              onNextPage={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
              onOpenComments={() => setActivePanel('comments')}
              onPreviousPage={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              onPrint={handlePrint}
              onRefresh={() => setRefreshKey((key) => key + 1)}
              onRotate={() => setRotation((value) => (value + 90) % 360)}
              onZoomIn={() => setZoom((value) => Math.min(Number((value + 0.1).toFixed(2)), 2.5))}
              onZoomOut={() => setZoom((value) => Math.max(Number((value - 0.1).toFixed(2)), 0.5))}
              onZoomReset={() => setZoom(1)}
            />
          </div>

          <DocumentSidebar
            activePanel={activePanel}
            currentDocument={currentDocument}
            currentIndex={currentIndex}
            documents={documents}
            onSelectDocument={setCurrentIndex}
            onSelectPanel={setActivePanel}
          />
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('documents.viewer.deleteTitle')}
        description={t('documents.viewer.deleteDescription', { fileName: currentDocument.fileName })}
      />
    </>
  )
}

export function DocumentViewer() {
  const { t } = useI18n()
  const {
    activePanel,
    canDelete,
    closeViewer,
    contextPath,
    contextTitle,
    currentIndex,
    deleteCurrentDocument,
    documents,
    isDeleting,
    isOpen,
    nextDocument,
    previousDocument,
    setActivePanel,
    setCurrentIndex,
  } = useDocumentViewerStore(
    useShallow((state) => ({
      activePanel: state.activePanel,
      canDelete: state.onDeleteDocument != null,
      closeViewer: state.closeViewer,
      contextPath: state.contextPath,
      contextTitle: state.contextTitle,
      currentIndex: state.currentIndex,
      deleteCurrentDocument: state.deleteCurrentDocument,
      documents: state.documents,
      isDeleting: state.isDeleting,
      isOpen: state.isOpen,
      nextDocument: state.nextDocument,
      previousDocument: state.previousDocument,
      setActivePanel: state.setActivePanel,
      setCurrentIndex: state.setCurrentIndex,
    }))
  )

  const currentDocument = documents[currentIndex] ?? null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeViewer()}>
      <DialogContent
        showCloseButton={false}
        className="h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-lg border-border/70 p-0 shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('documents.viewer.title')}</DialogTitle>
          <DialogDescription>{t('documents.viewer.description')}</DialogDescription>
        </DialogHeader>

        {currentDocument ? (
          <DocumentViewerSession
            key={currentDocument.id}
            activePanel={activePanel}
            canDelete={canDelete}
            closeViewer={closeViewer}
            contextPath={contextPath}
            contextTitle={contextTitle}
            currentDocument={currentDocument}
            currentIndex={currentIndex}
            deleteCurrentDocument={deleteCurrentDocument}
            documents={documents}
            isDeleting={isDeleting}
            nextDocument={nextDocument}
            previousDocument={previousDocument}
            setActivePanel={setActivePanel}
            setCurrentIndex={setCurrentIndex}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
