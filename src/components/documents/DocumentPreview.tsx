'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useI18n } from '@/components/layout/I18nProvider'
import { Button } from '@/components/ui/button'
import {
  buildDocumentDownloadUrl,
  getDocumentPreviewKind,
  getDocumentTypeLabel,
  resolveDocumentUrl,
} from '@/lib/document-utils'
import type { InventoryDocumentRecord } from '@/types/documents'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface DocumentPreviewProps {
  document: InventoryDocumentRecord
  onLoadError: (message: string) => void
  onLoadSuccess: (pageCount: number) => void
  pageNumber: number
  refreshKey: number
  rotation: number
  zoom: number
}

function PreviewError({
  document,
  message,
}: {
  document: InventoryDocumentRecord
  message: string
}) {
  const { t } = useI18n()

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border/80 bg-card/90 p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{t('documents.preview.errorTitle')}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="outline" size="sm" asChild className="rounded-md">
          <a href={resolveDocumentUrl(document)} target="_blank" rel="noopener noreferrer">
            {t('documents.preview.openFile')}
          </a>
        </Button>
        <Button variant="secondary" size="sm" asChild className="rounded-md">
          <a href={buildDocumentDownloadUrl(document)}>{t('documents.toolbar.download')}</a>
        </Button>
      </div>
    </div>
  )
}

export function DocumentPreview({
  document,
  onLoadError,
  onLoadSuccess,
  pageNumber,
  refreshKey,
  rotation,
  zoom,
}: DocumentPreviewProps) {
  const { t } = useI18n()
  const previewKind = getDocumentPreviewKind(document)
  const resolvedUrl = resolveDocumentUrl(document)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(960)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [textContent, setTextContent] = useState('')
  const [textLoading, setTextLoading] = useState(previewKind === 'text')
  const [pdfChecking, setPdfChecking] = useState(previewKind === 'pdf')

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerWidth(entry.contentRect.width)
    })

    observer.observe(element)
    const frameId = window.requestAnimationFrame(() => {
      setContainerWidth(element.clientWidth || 960)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (previewKind !== 'text') {
      return
    }

    const controller = new AbortController()

    fetch(resolvedUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(t('documents.preview.textReadError'))
        }

        const text = await response.text()
        setTextContent(text)
        onLoadSuccess(1)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : t('documents.preview.readError')
        setPreviewError(message)
        onLoadError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTextLoading(false)
        }
      })

    return () => controller.abort()
  }, [document.id, onLoadError, onLoadSuccess, previewKind, refreshKey, resolvedUrl, t])

  useEffect(() => {
    if (previewKind !== 'pdf') {
      setPdfChecking(false)
      return
    }

    const controller = new AbortController()
    setPdfChecking(true)
    setPreviewError(null)

    fetch(resolvedUrl, { method: 'HEAD', signal: controller.signal })
      .then((response) => {
        if (response.status === 404) {
          throw new Error(t('documents.preview.fileMissing'))
        }

        if (!response.ok && response.status !== 405) {
          throw new Error(t('documents.preview.openPdfError'))
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : t('documents.preview.openPdfError')
        setPreviewError(message)
        onLoadError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPdfChecking(false)
        }
      })

    return () => controller.abort()
  }, [document.id, onLoadError, previewKind, refreshKey, resolvedUrl, t])

  const pageWidth = Math.max(320, Math.min(containerWidth - 56, 1180) * zoom)

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 items-start justify-center overflow-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%),radial-gradient(circle_at_top,rgba(148,163,184,0.08),transparent_32%)] p-4 md:p-6"
    >
      {previewKind === 'pdf' && pdfChecking ? (
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('documents.preview.loadingPdf')}
        </div>
      ) : null}

      {previewKind === 'pdf' && !pdfChecking ? (
        previewError ? (
          <PreviewError message={previewError} document={document} />
        ) : (
        <Document
          file={resolvedUrl}
          key={`${document.id}-${refreshKey}`}
          loading={
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('documents.preview.loadingPdf')}
            </div>
          }
          error={<PreviewError message={t('documents.preview.pdfRenderError')} document={document} />}
          onLoadSuccess={({ numPages }) => {
            onLoadSuccess(numPages)
            setPreviewError(null)
          }}
          onLoadError={(error) => {
            const message = error instanceof Error ? error.message : t('documents.preview.openPdfError')
            setPreviewError(message)
            onLoadError(message)
          }}
        >
          <Page
            pageNumber={pageNumber}
            width={pageWidth}
            rotate={rotation}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading={
              <div className="rounded-md border border-border/70 bg-card/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                {t('documents.preview.renderingPage')}
              </div>
            }
            className="[&_.react-pdf__Page__canvas]:mx-auto [&_.react-pdf__Page__canvas]:rounded-md [&_.react-pdf__Page__canvas]:shadow-[0_24px_60px_rgba(15,23,42,0.16)]"
          />
        </Document>
        )
      ) : null}

      {previewKind === 'image' ? (
        previewError ? (
          <PreviewError message={previewError} document={document} />
        ) : (
          <div className="rounded-lg border border-border/70 bg-card/70 p-3 shadow-sm">
            <img
              src={resolvedUrl}
              alt={document.fileName}
              className="max-h-full max-w-full rounded-md object-contain shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
              style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, transformOrigin: 'center center' }}
              onLoad={() => {
                setPreviewError(null)
                onLoadSuccess(1)
              }}
              onError={() => {
                const message = t('documents.preview.imageRenderError')
                setPreviewError(message)
                onLoadError(message)
              }}
            />
          </div>
        )
      ) : null}

      {previewKind === 'text' ? (
        previewError ? (
          <PreviewError message={previewError} document={document} />
        ) : (
          <div className="w-full max-w-5xl rounded-lg border border-border/70 bg-card/85 p-4 shadow-sm">
            {textLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('documents.preview.loadingText')}
              </div>
            ) : (
              <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md bg-background/80 p-4 font-mono text-xs leading-6 text-foreground">
                {textContent || t('documents.preview.emptyText')}
              </pre>
            )}
          </div>
        )
      ) : null}

      {previewKind === 'unsupported' ? (
        <div className="mx-auto max-w-lg rounded-lg border border-border/80 bg-card/90 p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">{t('documents.preview.unsupportedTitle')}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('documents.preview.unsupportedDescription')}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {getDocumentTypeLabel(document, t('documents.info.fileFallback'))}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" size="sm" asChild className="rounded-md">
              <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                {t('documents.preview.openFile')}
              </a>
            </Button>
            <Button variant="secondary" size="sm" asChild className="rounded-md">
              <a href={buildDocumentDownloadUrl(document)}>{t('documents.toolbar.download')}</a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
