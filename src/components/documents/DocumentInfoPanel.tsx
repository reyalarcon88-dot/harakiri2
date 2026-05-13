'use client'

import { useI18n } from '@/components/layout/I18nProvider'
import { Badge } from '@/components/ui/badge'
import {
  formatDocumentFileSize,
  getDocumentTypeLabel,
  getEntityLabel,
} from '@/lib/document-utils'
import type { InventoryDocumentRecord } from '@/types/documents'

interface DocumentInfoPanelProps {
  document: InventoryDocumentRecord
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-border/70 bg-background/70 p-3">
      <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="break-words text-sm font-medium">{value}</span>
    </div>
  )
}

export function DocumentInfoPanel({ document }: DocumentInfoPanelProps) {
  const { t } = useI18n()
  const metadataEntries = Object.entries(document.metadata ?? {})
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-md px-2 py-0.5">
          {getEntityLabel(document.entityType, entityLabels)}
        </Badge>
        <Badge variant="outline" className="rounded-md px-2 py-0.5">
          {getDocumentTypeLabel(document, t('documents.info.fileFallback'))}
        </Badge>
        <Badge variant="outline" className="rounded-md px-2 py-0.5">
          {document.source === 'url'
            ? t('documents.info.source.url')
            : document.source === 'local-path'
              ? t('documents.info.source.localPath')
              : t('documents.info.source.database')}
        </Badge>
      </div>

      <div className="grid gap-3">
        <InfoRow label={t('documents.info.name')} value={document.fileName} />
        <InfoRow
          label={t('documents.info.entity')}
          value={`${getEntityLabel(document.entityType, entityLabels)} ${document.entityId}`}
        />
        <InfoRow
          label={t('documents.info.size')}
          value={formatDocumentFileSize(document.fileSize, t('documents.info.noData'))}
        />
        <InfoRow label={t('documents.info.uploaded')} value={document.uploadedAt ?? t('documents.info.noData')} />
        <InfoRow label={t('documents.info.user')} value={document.uploadedBy ?? t('documents.info.systemUser')} />
        <InfoRow label={t('documents.info.version')} value={document.version ?? '1.0'} />
      </div>

      {metadataEntries.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {t('documents.info.metadata')}
          </p>
          <div className="grid gap-2">
            {metadataEntries.map(([key, value]) => (
              <InfoRow key={key} label={key} value={String(value ?? '-')} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
