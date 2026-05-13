import type { InventoryDocumentRecord } from '@/types/documents'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'])
const TEXT_EXTENSIONS = new Set(['txt', 'csv', 'md', 'json', 'log'])

export type DocumentPreviewKind = 'pdf' | 'image' | 'text' | 'unsupported'
export type DocumentEntityLabelMap = Partial<
  Record<InventoryDocumentRecord['entityType'], string>
>

export function getDocumentExtension(fileName: string, fileType?: string) {
  if (!fileName && fileType) {
    const mimePart = fileType.split('/').pop()?.toLowerCase()
    return mimePart ?? ''
  }

  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function resolveDocumentUrl(document: InventoryDocumentRecord) {
  if (/^https?:\/\//i.test(document.fileUrl)) {
    return document.fileUrl
  }

  if (document.fileUrl.startsWith('/')) {
    return document.fileUrl
  }

  return `/${document.fileUrl.replace(/^\/+/, '')}`
}

export function buildDocumentDownloadUrl(document: InventoryDocumentRecord) {
  if (document.downloadUrl) {
    return document.downloadUrl
  }

  const url = resolveDocumentUrl(document)
  if (!url.startsWith('/api/')) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}download=1`
}

export function getDocumentPreviewKind(document: InventoryDocumentRecord): DocumentPreviewKind {
  const ext = getDocumentExtension(document.fileName, document.fileType)
  const mime = document.fileType.toLowerCase()

  if (mime.includes('pdf') || ext === 'pdf') {
    return 'pdf'
  }

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) {
    return 'image'
  }

  if (mime.startsWith('text/') || TEXT_EXTENSIONS.has(ext)) {
    return 'text'
  }

  return 'unsupported'
}

export function formatDocumentFileSize(bytes?: number, emptyLabel = 'No data') {
  if (!bytes || bytes <= 0) return emptyLabel
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getDocumentTypeLabel(document: InventoryDocumentRecord, fallbackLabel = 'File') {
  if (document.fileType) {
    return document.fileType
  }

  const ext = getDocumentExtension(document.fileName, document.fileType)
  return ext ? ext.toUpperCase() : fallbackLabel
}

export function getEntityLabel(
  entityType: InventoryDocumentRecord['entityType'],
  labels?: DocumentEntityLabelMap
) {
  switch (entityType) {
    case 'project':
      return labels?.project ?? 'Project'
    case 'purchase':
      return labels?.purchase ?? 'Purchase'
    case 'product':
      return labels?.product ?? 'Product'
    case 'rack':
      return labels?.rack ?? 'Rack'
    case 'warehouse':
      return labels?.warehouse ?? 'Warehouse'
    case 'location':
      return labels?.location ?? 'Location'
    case 'material':
      return labels?.material ?? 'Material'
    default:
      return labels?.other ?? 'Document'
  }
}
