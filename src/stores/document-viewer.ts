import { create } from 'zustand'
import type {
  InventoryDocumentPanel,
  InventoryDocumentRecord,
  OpenInventoryDocumentViewerPayload,
} from '@/types/documents'

interface DocumentViewerState {
  isOpen: boolean
  isDeleting: boolean
  documents: InventoryDocumentRecord[]
  currentIndex: number
  activePanel: InventoryDocumentPanel
  contextTitle: string
  contextPath: string[]
  onDeleteDocument?: (document: InventoryDocumentRecord) => Promise<void>
  openViewer: (payload: OpenInventoryDocumentViewerPayload) => void
  closeViewer: () => void
  setActivePanel: (panel: InventoryDocumentPanel) => void
  setCurrentIndex: (index: number) => void
  nextDocument: () => void
  previousDocument: () => void
  deleteCurrentDocument: () => Promise<void>
}

export const useDocumentViewerStore = create<DocumentViewerState>((set, get) => ({
  isOpen: false,
  isDeleting: false,
  documents: [],
  currentIndex: 0,
  activePanel: 'info',
  contextTitle: 'Document Viewer',
  contextPath: ['Inventario'],
  onDeleteDocument: undefined,
  openViewer: ({
    documents,
    initialDocumentId,
    initialPanel,
    contextTitle,
    contextPath,
    onDeleteDocument,
  }) => {
    if (documents.length === 0) return

    const initialIndex = initialDocumentId
      ? Math.max(
          0,
          documents.findIndex((document) => document.id === initialDocumentId)
        )
      : 0

    set({
      isOpen: true,
      isDeleting: false,
      documents,
      currentIndex: initialIndex,
      activePanel: initialPanel ?? 'info',
      contextTitle: contextTitle ?? 'Document Viewer',
      contextPath: contextPath ?? ['Inventario'],
      onDeleteDocument,
    })
  },
  closeViewer: () =>
    set({
      isOpen: false,
      isDeleting: false,
      documents: [],
      currentIndex: 0,
      activePanel: 'info',
      contextTitle: 'Document Viewer',
      contextPath: ['Inventario'],
      onDeleteDocument: undefined,
    }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCurrentIndex: (index) =>
    set((state) => ({
      currentIndex: Math.min(Math.max(index, 0), Math.max(state.documents.length - 1, 0)),
    })),
  nextDocument: () =>
    set((state) => ({
      currentIndex: Math.min(state.currentIndex + 1, Math.max(state.documents.length - 1, 0)),
    })),
  previousDocument: () =>
    set((state) => ({
      currentIndex: Math.max(state.currentIndex - 1, 0),
    })),
  deleteCurrentDocument: async () => {
    const state = get()
    const currentDocument = state.documents[state.currentIndex]

    if (!currentDocument || !state.onDeleteDocument) {
      return
    }

    set({ isDeleting: true })

    try {
      await state.onDeleteDocument(currentDocument)
      set((currentState) => {
        const nextDocuments = currentState.documents.filter(
          (document) => document.id !== currentDocument.id
        )

        if (nextDocuments.length === 0) {
          return {
            isOpen: false,
            isDeleting: false,
            documents: [],
            currentIndex: 0,
            activePanel: currentState.activePanel,
            contextTitle: currentState.contextTitle,
            contextPath: currentState.contextPath,
            onDeleteDocument: currentState.onDeleteDocument,
          }
        }

        return {
          isDeleting: false,
          documents: nextDocuments,
          currentIndex: Math.min(currentState.currentIndex, nextDocuments.length - 1),
        }
      })
    } catch (error) {
      set({ isDeleting: false })
      throw error
    }
  },
}))
