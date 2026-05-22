import { create } from 'zustand'

export type PageKey =
  | 'dashboard'
  | 'warehouses'
  | 'products'
  | 'tools'
  | 'purchases'
  | 'recepcion'
  | 'projects'
  | 'transfers'
  | 'returns'
  | 'suppliers'
  | 'clients'
  | 'contractors'
  | 'personnel'
  | 'tasks'
  | 'calendar'
  | 'reports'
  | 'settings'
  | 'inventory-timeline'

interface NavigationState {
  currentPage: PageKey
  targetPurchaseId: string | null
  targetProjectId: string | null
  targetRecepcionProjectId: string | null
  setPage: (page: PageKey) => void
  openPurchase: (purchaseId: string) => void
  openProject: (projectId: string) => void
  openRecepcionForProject: (projectId: string) => void
  clearTargets: () => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentPage: 'dashboard',
  targetPurchaseId: null,
  targetProjectId: null,
  targetRecepcionProjectId: null,
  setPage: (page) => set({ currentPage: page }),
  openPurchase: (purchaseId) => set({ currentPage: 'purchases', targetPurchaseId: purchaseId }),
  openProject: (projectId) => set({ currentPage: 'projects', targetProjectId: projectId }),
  openRecepcionForProject: (projectId) => set({ currentPage: 'recepcion', targetRecepcionProjectId: projectId }),
  clearTargets: () => set({ targetPurchaseId: null, targetProjectId: null, targetRecepcionProjectId: null }),
}))
