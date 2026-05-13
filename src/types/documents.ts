export type InventoryDocumentEntityType =
  | 'product'
  | 'purchase'
  | 'project'
  | 'rack'
  | 'warehouse'
  | 'location'
  | 'material'
  | 'other'

export type InventoryDocumentPanel = 'comments' | 'versions' | 'gallery' | 'info' | 'extract'

export interface InventoryDocumentRecord {
  id: string
  fileName: string
  fileType: string
  fileUrl: string
  entityType: InventoryDocumentEntityType
  entityId: string
  uploadedAt?: string
  uploadedBy?: string
  version?: string
  fileSize?: number
  source?: 'database' | 'url' | 'local-path'
  downloadUrl?: string
  originalFileUrl?: string
  locationPath?: string[]
  metadata?: Record<string, string | number | boolean | null>
}

export interface OpenInventoryDocumentViewerPayload {
  documents: InventoryDocumentRecord[]
  initialDocumentId?: string
  initialPanel?: InventoryDocumentPanel
  contextTitle?: string
  contextPath?: string[]
  onDeleteDocument?: (document: InventoryDocumentRecord) => Promise<void>
}
