'use client'

import type { ElementType } from 'react'
import {
  FileSearch,
  GalleryVerticalEnd,
  Info,
  MessageSquare,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import { DocumentInfoPanel } from '@/components/documents/DocumentInfoPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDocumentFileSize } from '@/lib/document-utils'
import type { InventoryDocumentPanel, InventoryDocumentRecord } from '@/types/documents'

interface DocumentSidebarProps {
  activePanel: InventoryDocumentPanel
  currentIndex: number
  currentDocument: InventoryDocumentRecord
  documents: InventoryDocumentRecord[]
  onSelectDocument: (index: number) => void
  onSelectPanel: (panel: InventoryDocumentPanel) => void
}

function PlaceholderPanel({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-md border border-dashed border-border/80 bg-background/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

export function DocumentSidebar({
  activePanel,
  currentIndex,
  currentDocument,
  documents,
  onSelectDocument,
  onSelectPanel,
}: DocumentSidebarProps) {
  const { t } = useI18n()
  const panelItems = [
    { id: 'comments', label: t('documents.sidebar.comments'), icon: MessageSquare },
    { id: 'versions', label: t('documents.sidebar.versions'), icon: Workflow },
    { id: 'gallery', label: t('documents.sidebar.gallery'), icon: GalleryVerticalEnd },
    { id: 'info', label: t('documents.sidebar.info'), icon: Info },
    { id: 'extract', label: t('documents.sidebar.extract'), icon: FileSearch },
  ] as const satisfies Array<{ id: InventoryDocumentPanel; label: string; icon: ElementType }>

  return (
    <aside className="flex min-h-0 flex-col border-t border-border/70 bg-card/65 xl:border-l xl:border-t-0">
      <div className="border-b border-border/70 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {t('common.actions')}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {panelItems.map((item) => (
            <Button
              key={item.id}
              variant={activePanel === item.id ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onSelectPanel(item.id)}
              className="justify-start gap-2 rounded-md"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {activePanel === 'info' ? <DocumentInfoPanel document={currentDocument} /> : null}

        {activePanel === 'gallery' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                {t('documents.sidebar.collection')}
              </p>
              <Badge variant="outline" className="rounded-md px-2 py-0.5">
                {t('documents.sidebar.filesCount', { count: documents.length })}
              </Badge>
            </div>

            <div className="grid gap-2">
              {documents.map((document, index) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => onSelectDocument(index)}
                  className={`rounded-md border px-3 py-3 text-left transition ${
                    index === currentIndex
                      ? 'border-primary/50 bg-primary/[0.08] ring-1 ring-primary/30'
                      : 'border-border/70 bg-background/70 hover:bg-accent/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{document.fileName}</p>
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{document.uploadedAt ?? t('documents.sidebar.noDate')}</span>
                    <span>{formatDocumentFileSize(document.fileSize, t('documents.info.noData'))}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activePanel === 'comments' ? (
          <PlaceholderPanel
            title={t('documents.sidebar.commentsReadyTitle')}
            description={t('documents.sidebar.commentsReadyDescription')}
          />
        ) : null}

        {activePanel === 'versions' ? (
          <PlaceholderPanel
            title={t('documents.sidebar.versionsReadyTitle')}
            description={t('documents.sidebar.versionsReadyDescription')}
          />
        ) : null}

        {activePanel === 'extract' ? (
          <PlaceholderPanel
            title={t('documents.sidebar.extractReadyTitle')}
            description={t('documents.sidebar.extractReadyDescription')}
          />
        ) : null}
      </div>
    </aside>
  )
}
