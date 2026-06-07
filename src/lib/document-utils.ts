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

function buildDocumentFavicon(kind: DocumentPreviewKind): string {
  switch (kind) {
    case 'pdf':
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path fill="#e53935" d="M6 2h14l6 6v22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>' +
        '<path fill="#ffcdd2" d="M20 2v6h6z"/>' +
        '<text x="16" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="#fff">PDF</text>' +
        '</svg>'
      )
    case 'image':
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path fill="#43a047" d="M6 2h14l6 6v22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>' +
        '<path fill="#c8e6c9" d="M20 2v6h6z"/>' +
        '<circle cx="13" cy="18" r="2" fill="#fff"/>' +
        '<path fill="#fff" d="M9 26l4-5 3 3 4-6 4 8z"/>' +
        '</svg>'
      )
    case 'text':
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path fill="#1e88e5" d="M6 2h14l6 6v22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>' +
        '<path fill="#bbdefb" d="M20 2v6h6z"/>' +
        '<rect x="8" y="14" width="16" height="1.5" fill="#fff"/>' +
        '<rect x="8" y="18" width="16" height="1.5" fill="#fff"/>' +
        '<rect x="8" y="22" width="10" height="1.5" fill="#fff"/>' +
        '</svg>'
      )
    default:
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path fill="#757575" d="M6 2h14l6 6v22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>' +
        '<path fill="#e0e0e0" d="M20 2v6h6z"/>' +
        '</svg>'
      )
  }
}

export function openDocumentInNewTab(document: InventoryDocumentRecord) {
  const url = resolveDocumentUrl(document)
  const win = window.open('', '_blank')
  if (!win) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const title = escape(document.fileName)
  const safeUrl = escape(url)
  const faviconSvg = buildDocumentFavicon(getDocumentPreviewKind(document))
  const faviconHref = `data:image/svg+xml;utf8,${encodeURIComponent(faviconSvg)}`
  win.document.open()
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>` +
    `<link rel="icon" type="image/svg+xml" href="${faviconHref}">` +
    `<style>html,body{margin:0;padding:0;height:100%;background:#1f1f1f}` +
    `iframe,embed,img{width:100vw;height:100vh;border:0;display:block}` +
    `img{object-fit:contain}</style></head>` +
    `<body><iframe src="${safeUrl}" title="${title}"></iframe></body></html>`
  )
  win.document.close()
  win.document.title = document.fileName
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
