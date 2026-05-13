'use client'

import { X, ExternalLink } from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { InventoryDocumentRecord } from '@/types/documents'
import { getEntityLabel, resolveDocumentUrl } from '@/lib/document-utils'

interface DocumentHeaderProps {
  document: InventoryDocumentRecord
  contextTitle: string
  contextPath: string[]
  documentIndex: number
  totalDocuments: number
  onClose: () => void
}

export function DocumentHeader({
  document,
  contextTitle,
  contextPath,
  documentIndex,
  totalDocuments,
  onClose,
}: DocumentHeaderProps) {
  const { t } = useI18n()
  const entityLabels = {
    project: t('documents.entity.project'),
    purchase: t('documents.entity.purchase'),
    product: t('documents.entity.product'),
    rack: t('documents.entity.rack'),
    warehouse: t('documents.entity.warehouse'),
    location: t('documents.entity.location'),
    material: t('documents.entity.material'),
    other: t('documents.entity.other'),
  } as const
  const breadcrumbBase = document.locationPath?.length ? document.locationPath : contextPath
  const breadcrumb = [...breadcrumbBase, document.fileName]

  return (
    <div className="border-b border-border/70 bg-card/80 px-4 py-3 backdrop-blur md:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-md px-2 py-0.5">
              {getEntityLabel(document.entityType, entityLabels)}
            </Badge>
            <Badge variant="outline" className="rounded-md px-2 py-0.5">
              {documentIndex + 1} / {totalDocuments}
            </Badge>
            {document.version ? (
              <Badge variant="outline" className="rounded-md px-2 py-0.5">
                v{document.version}
              </Badge>
            ) : null}
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              {contextTitle}
            </p>
            <h2 className="truncate text-lg font-semibold md:text-xl">{document.fileName}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((segment, index) => (
              <span key={`${segment}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <span className="text-muted-foreground/60">/</span> : null}
                <span className={index === breadcrumb.length - 1 ? 'text-foreground/80' : ''}>
                  {segment}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-md">
            <a href={resolveDocumentUrl(document)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              {t('documents.header.openExternal')}
            </a>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-md">
            <X className="h-4 w-4" />
            <span className="sr-only">{t('documents.header.closeViewer')}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
