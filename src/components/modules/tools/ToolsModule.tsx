'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, ArrowUpDown, Boxes, Building2, CornerDownLeft, Edit2, HardHat, History, LayoutList, Loader2, MoreHorizontal, Plus, RefreshCw, Search, Trash2, Users, Warehouse, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConditionBadge } from '@/components/shared/ConditionBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ToolStatusBadge } from '@/components/shared/ToolStatusBadge'

type ToolStatus = 'available' | 'assigned' | 'partial' | 'maintenance' | 'damaged' | 'lost' | 'retired'
type MovementType = 'issue' | 'transfer' | 'return' | 'status_change'
type ToolSortKey = 'name' | 'code' | 'category' | 'status' | 'condition' | 'location'

interface ToolInstaller {
  id: string
  name: string
  phone: string
  email: string
  company: string
  role: string
  notes: string
  active: boolean
  _count?: { currentTools: number }
}

interface Contractor {
  id: string
  name: string
}

interface Warehouse {
  id: string
  name: string
  racks: { id: string; name: string; shelves: { id: string; name: string }[] }[]
}

interface FlatShelf {
  id: string
  name: string
  rackName: string
  warehouseName: string
}

interface ToolMovement {
  id: string
  movementType: string
  movementDate: string
  fromType: string
  toType: string
  condition: string
  notes: string
  fromShelf?: { name: string; rack: { name: string; warehouse: { name: string } } } | null
  toShelf?: { name: string; rack: { name: string; warehouse: { name: string } } } | null
  fromContractor?: { name: string } | null
  toContractor?: { name: string } | null
  fromInstaller?: { name: string; role?: string } | null
  toInstaller?: { name: string; role?: string } | null
}

interface InventoryTool {
  id: string
  code: string
  serial: string
  category: string
  name: string
  brand: string
  model: string
  trackingType: 'serialized' | 'quantity'
  totalQuantity: number
  availableQuantity: number
  assignedQuantity: number
  status: ToolStatus
  condition: string
  notes: string
  currentLocationType: string
  currentShelf?: { name: string; rack: { name: string; warehouse: { name: string } } } | null
  currentContractor?: { name: string } | null
  currentInstaller?: { name: string; role?: string } | null
  assignments?: ToolAssignment[]
  kitItems?: { id: string; kit: { id: string; code: string; name: string } }[]
  movements: ToolMovement[]
}

interface ToolAssignment {
  id: string
  holderType: 'installer' | 'contractor'
  contractorId?: string | null
  installerId?: string | null
  quantity: number
  contractor?: { id: string; name: string } | null
  installer?: { id: string; name: string; role?: string } | null
}

interface ToolKit {
  id: string
  code: string
  name: string
  notes: string
  status: string
  items: { id: string; quantity: number; tool: InventoryTool }[]
  summary: {
    total: number
    componentCount: number
    totalUnits: number
    kitsAvailable: number
    kitsAssigned: number
    available: number
    assigned: number
    maintenance: number
    damaged: number
    lost: number
    retired: number
    computedStatus: string
    commonHolder: string
  }
}

interface ToolHolder {
  holderType: 'installer' | 'contractor'
  holderId: string
  name: string
  phone: string
  email: string
  note: string
  tools: InventoryTool[]
  toolCount: number
  kitCount: number
}

interface SimpleLedgerRow {
  tool: InventoryTool
  holderName: string
  currentHolderName: string
  currentState: 'in_possession' | 'warehouse'
  toolDescription: string
  brandModel: string
  serialNumber: string
  condition: string
  quantity: number
  qty: number
  lastInDate: string
  lastOutDate: string
  lastInMovementType: string
  dateIssued: string
  dateReturned: string
  employeeSignature: string
  companySignature: string
  notes: string
  kit: { id: string; code: string; name: string } | null
}

interface SimpleLedgerGroup {
  groupType: 'warehouse' | 'installer' | 'contractor'
  groupId: string
  name: string
  label: string
  phone: string
  email: string
  rows: SimpleLedgerRow[]
  toolCount: number
  kitCount: number
}

const emptyTool = {
  code: '',
  serial: '',
  category: '',
  name: '',
  brand: '',
  model: '',
  trackingType: 'serialized',
  totalQuantity: 1,
  condition: 'good',
  notes: '',
  currentShelfId: '',
}

const emptyInstaller = {
  name: '',
  phone: '',
  email: '',
  company: '',
  role: 'installer',
  notes: '',
  active: true,
}

const personnelRoles = [
  { value: 'installer', label: 'Instalador' },
  { value: 'contractor', label: 'Contratista' },
  { value: 'cutter', label: 'Cortador' },
  { value: 'office', label: 'Personal de oficina' },
] as const

function personnelRoleLabel(role?: string) {
  return personnelRoles.find((item) => item.value === role)?.label || 'Personal'
}

function personnelLabel(person?: { name: string; role?: string } | null) {
  if (!person) return 'Personal'
  return `${personnelRoleLabel(person.role)}: ${person.name}`
}

const emptyKit = {
  code: '',
  name: '',
  notes: '',
  status: 'active',
}

const movementLabels: Record<string, string> = {
  created: 'Creada',
  issue: 'Entregada',
  transfer: 'Transferida',
  return: 'Devuelta',
  status_change: 'Cambio de estado',
}

function shelfLabel(shelf?: { name: string; rack: { name: string; warehouse: { name: string } } } | null) {
  return shelf ? `${shelf.name} / ${shelf.rack.name} / ${shelf.rack.warehouse.name}` : ''
}

function holderLabel(tool: InventoryTool) {
  if (tool.trackingType === 'quantity') {
    if (tool.assignments?.length) {
      const holders = tool.assignments
        .map((assignment) => `${assignment.installer ? personnelLabel(assignment.installer) : assignment.contractor?.name || 'Responsable'}: ${assignment.quantity}`)
        .join(', ')
      return `${tool.availableQuantity || 0} disp. / ${tool.assignedQuantity || 0} asign. (${holders})`
    }
    return `${tool.availableQuantity || 0} disp. / ${tool.assignedQuantity || 0} asign.`
  }
  if (tool.currentInstaller) return personnelLabel(tool.currentInstaller)
  if (tool.currentContractor) return `Contratista: ${tool.currentContractor.name}`
  if (tool.currentShelf) return shelfLabel(tool.currentShelf)
  return 'Sin ubicación'
}

function canIssueTool(tool: InventoryTool): boolean {
  if (tool.status === 'lost' || tool.status === 'retired') return false
  if (tool.trackingType === 'quantity') return (tool.availableQuantity ?? 0) > 0
  return ['available', 'maintenance', 'damaged'].includes(tool.status)
}

function ledgerStateMeta(row: SimpleLedgerRow) {
  if (row.currentState === 'in_possession') {
    return {
      label: 'En posesion',
      dateLabel: 'Recibida',
      date: row.lastInDate,
      className: 'border-sky-200 bg-sky-50 text-sky-700',
    }
  }

  if (row.lastInMovementType === 'return') {
    return {
      label: 'Devuelta',
      dateLabel: 'Devuelta',
      date: row.lastInDate,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  return {
    label: 'En WH',
    dateLabel: 'Entrada',
    date: row.lastInDate,
    className: 'border-slate-200 bg-slate-50 text-slate-700',
  }
}

function getToolBorderClass(tool: InventoryTool): string {
  const isQty = tool.trackingType === 'quantity'
  const avail = tool.availableQuantity ?? 0
  const assigned = tool.assignedQuantity ?? 0
  if (tool.status === 'damaged') return 'border-l-rose-500'
  if (tool.status === 'lost') return 'border-l-rose-700'
  if (tool.status === 'retired') return 'border-l-slate-400'
  if (tool.status === 'maintenance') return 'border-l-amber-400'
  if (isQty && avail > 0 && assigned > 0) return 'border-l-amber-500'
  if (isQty && avail === 0 && assigned > 0) return 'border-l-sky-500'
  if (tool.status === 'assigned') return 'border-l-sky-500'
  if (tool.status === 'partial') return 'border-l-amber-500'
  return 'border-l-emerald-500'
}

function movementEndpointLabel(type: string, movement: ToolMovement, side: 'from' | 'to') {
  const shelf = side === 'from' ? movement.fromShelf : movement.toShelf
  const contractor = side === 'from' ? movement.fromContractor : movement.toContractor
  const installer = side === 'from' ? movement.fromInstaller : movement.toInstaller
  if (installer) return personnelLabel(installer)
  if (contractor) return `Contratista: ${contractor.name}`
  if (shelf) return shelfLabel(shelf)
  return type || '-'
}

export function ToolsModule() {
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState<'simple' | 'tools' | 'kits' | 'holders' | 'installers'>('simple')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [toolSort, setToolSort] = useState<{ key: ToolSortKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  })
  const [toolDialogOpen, setToolDialogOpen] = useState(false)
  const [kitDialogOpen, setKitDialogOpen] = useState(false)
  const [kitIssueDialogOpen, setKitIssueDialogOpen] = useState(false)
  const [kitReturnDialogOpen, setKitReturnDialogOpen] = useState(false)
  const [installerDialogOpen, setInstallerDialogOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<InventoryTool | null>(null)
  const [editingKit, setEditingKit] = useState<ToolKit | null>(null)
  const [selectedKit, setSelectedKit] = useState<ToolKit | null>(null)
  const [selectedHolder, setSelectedHolder] = useState<ToolHolder | null>(null)
  const [selectedLedgerGroupId, setSelectedLedgerGroupId] = useState('warehouse')
  const [editingInstaller, setEditingInstaller] = useState<ToolInstaller | null>(null)
  const [movementTool, setMovementTool] = useState<InventoryTool | null>(null)
  const [historyTool, setHistoryTool] = useState<InventoryTool | null>(null)
  const [toolForm, setToolForm] = useState(emptyTool)
  const [kitForm, setKitForm] = useState(emptyKit)
  const [kitToolId, setKitToolId] = useState('')
  const [kitItemQty, setKitItemQty] = useState(1)
  const [kitIssueDestination, setKitIssueDestination] = useState('')
  const [kitIssueNotes, setKitIssueNotes] = useState('')
  const [kitIssueCount, setKitIssueCount] = useState(1)
  const [kitReturnSource, setKitReturnSource] = useState('')
  const [kitReturnShelfId, setKitReturnShelfId] = useState('')
  const [kitReturnCount, setKitReturnCount] = useState(1)
  const [kitReturnMode, setKitReturnMode] = useState<'full' | 'partial'>('full')
  const [kitReturnItems, setKitReturnItems] = useState<Record<string, number>>({})
  const [kitReturnNotes, setKitReturnNotes] = useState('')
  const [installerForm, setInstallerForm] = useState(emptyInstaller)
  const [movementForm, setMovementForm] = useState({
    movementType: 'issue' as MovementType,
    source: '',
    destination: '',
    status: 'maintenance',
    quantity: 1,
    condition: '',
    notes: '',
  })

  const { data: tools = [], isLoading } = useQuery<InventoryTool[]>({
    queryKey: ['tools', search, statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      const response = await fetch(`/api/tools?${params.toString()}`)
      if (!response.ok) throw new Error(`Failed to fetch tools: ${response.status}`)
      const data = await response.json()
      return Array.isArray(data) ? data : []
    },
  })

  const { data: kits = [], isLoading: kitsLoading } = useQuery<ToolKit[]>({
    queryKey: ['tool-kits', search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      return fetch(`/api/tool-kits?${params.toString()}`).then((response) => response.json())
    },
  })

  const { data: holders = [], isLoading: holdersLoading } = useQuery<ToolHolder[]>({
    queryKey: ['tool-holders', search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      return fetch(`/api/tools/holders?${params.toString()}`).then((response) => response.json())
    },
  })

  const { data: simpleLedger = [], isLoading: simpleLedgerLoading } = useQuery<SimpleLedgerGroup[]>({
    queryKey: ['tools-simple-ledger', search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      return fetch(`/api/tools/simple-ledger?${params.toString()}`).then((response) => response.json())
    },
  })

  const { data: installers = [] } = useQuery<ToolInstaller[]>({
    queryKey: ['tool-installers'],
    queryFn: () => fetch('/api/tool-installers').then((response) => response.json()),
  })

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ['contractors'],
    queryFn: () => fetch('/api/contractors').then((response) => response.json()),
  })

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: () => fetch('/api/warehouses').then((response) => response.json()),
  })

  const shelves = useMemo<FlatShelf[]>(
    () =>
      warehouses.flatMap((warehouse) =>
        warehouse.racks.flatMap((rack) =>
          rack.shelves.map((shelf) => ({
            id: shelf.id,
            name: shelf.name,
            rackName: rack.name,
            warehouseName: warehouse.name,
          }))
        )
      ),
    [warehouses]
  )

  const kitReturnHolders = useMemo(() => {
    if (!selectedKit) return []
    const holderLabels = new Map<string, string>()

    for (const item of selectedKit.items) {
      for (const assignment of item.tool.assignments || []) {
        const holderId = assignment.holderType === 'installer' ? assignment.installerId : assignment.contractorId
        if (!holderId) continue
        const value = `${assignment.holderType}:${holderId}`
        const label =
          assignment.holderType === 'installer'
            ? personnelLabel(assignment.installer)
            : `Contratista: ${assignment.contractor?.name || ''}`
        holderLabels.set(value, label)
      }
    }

    return Array.from(holderLabels.entries())
      .map(([value, label]) => {
        const [holderType, holderId] = value.split(':')
        const fullKits = selectedKit.items.reduce((minKits, item) => {
          const perKit = Math.max(1, item.quantity || 1)
          const assignment = (item.tool.assignments || []).find((candidate) =>
            holderType === 'installer'
              ? candidate.holderType === 'installer' && candidate.installerId === holderId
              : candidate.holderType === 'contractor' && candidate.contractorId === holderId
          )
          return Math.min(minKits, Math.floor((assignment?.quantity || 0) / perKit))
        }, Number.POSITIVE_INFINITY)
        return { value, label, fullKits: Number.isFinite(fullKits) ? fullKits : 0 }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [selectedKit])

  const selectedKitReturnHolder = kitReturnHolders.find((holder) => holder.value === kitReturnSource)
  const kitReturnPartialTotal = Object.values(kitReturnItems).reduce((sum, quantity) => sum + Math.max(0, Number(quantity) || 0), 0)

  const categories = useMemo(
    () => Array.from(new Set(tools.map((tool) => tool.category).filter(Boolean))).sort(),
    [tools]
  )

  const sortedTools = useMemo(() => {
    const valueFor = (tool: InventoryTool) => {
      if (toolSort.key === 'name') return `${tool.name} ${tool.code}`.toLowerCase()
      if (toolSort.key === 'code') return (tool.code || '').toLowerCase()
      if (toolSort.key === 'category') return (tool.category || '').toLowerCase()
      if (toolSort.key === 'status') return (tool.status || '').toLowerCase()
      if (toolSort.key === 'condition') return (tool.condition || '').toLowerCase()
      return holderLabel(tool).toLowerCase()
    }

    return tools.slice().sort((a, b) => {
      const first = valueFor(a)
      const second = valueFor(b)
      const result = first.localeCompare(second) || a.name.localeCompare(b.name) || a.code.localeCompare(b.code)
      return toolSort.direction === 'asc' ? result : -result
    })
  }, [tools, toolSort])

  const createToolMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toolForm, currentShelfId: toolForm.currentShelfId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la herramienta')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      setToolDialogOpen(false)
      setToolForm(emptyTool)
      toast.success('Herramienta registrada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const createKitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tool-kits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kitForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el kit')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      setKitDialogOpen(false)
      setKitForm(emptyKit)
      toast.success('Kit creado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateKitMutation = useMutation({
    mutationFn: async () => {
      if (!editingKit) throw new Error('Selecciona un kit')
      const res = await fetch(`/api/tool-kits/${editingKit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kitForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el kit')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      setKitDialogOpen(false)
      setEditingKit(null)
      setKitForm(emptyKit)
      toast.success('Kit actualizado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteKitMutation = useMutation({
    mutationFn: async (kit: ToolKit) => {
      const res = await fetch(`/api/tool-kits/${kit.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo borrar el kit')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      queryClient.invalidateQueries({ queryKey: ['tool-holders'] })
      queryClient.invalidateQueries({ queryKey: ['tools-simple-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      toast.success('Kit borrado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const addKitItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedKit) throw new Error('Selecciona un kit')
      const res = await fetch(`/api/tool-kits/${selectedKit.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: kitToolId, quantity: kitItemQty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo agregar la herramienta')
      return data
    },
    onSuccess: (kit: ToolKit) => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      queryClient.invalidateQueries({ queryKey: ['tool-holders'] })
      queryClient.invalidateQueries({ queryKey: ['tools-simple-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      setSelectedKit(kit)
      setKitToolId('')
      setKitItemQty(1)
      toast.success('Componente agregado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateToolSerialMutation = useMutation({
    mutationFn: async ({ toolId, serial }: { toolId: string; serial: string }) => {
      const res = await fetch(`/api/tools/${toolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el serial')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      queryClient.invalidateQueries({ queryKey: ['tool-holders'] })
      queryClient.invalidateQueries({ queryKey: ['tools-simple-ledger'] })
      toast.success('Serial actualizado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateKitItemQtyMutation = useMutation({
    mutationFn: async ({ kitId, itemId, quantity }: { kitId: string; itemId: string; quantity: number }) => {
      const res = await fetch(`/api/tool-kits/${kitId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la cantidad')
      return data
    },
    onSuccess: (kit: ToolKit) => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      setSelectedKit(kit)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const removeKitItemMutation = useMutation({
    mutationFn: async ({ kitId, itemId }: { kitId: string; itemId: string }) => {
      const res = await fetch(`/api/tool-kits/${kitId}/items/${itemId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo quitar el componente')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      queryClient.invalidateQueries({ queryKey: ['tool-holders'] })
      queryClient.invalidateQueries({ queryKey: ['tools-simple-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      setSelectedKit(null)
      toast.success('Componente quitado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const issueKitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedKit) throw new Error('Selecciona un kit')
      const [toType, id] = kitIssueDestination.split(':')
      const res = await fetch(`/api/tool-kits/${selectedKit.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toType,
          toContractorId: toType === 'contractor' ? id : undefined,
          toInstallerId: toType === 'installer' ? id : undefined,
          notes: kitIssueNotes,
          kits: kitIssueCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo entregar el kit')
      return data
    },
    onSuccess: (data: { issuedCount: number; kitsIssued: number; skippedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      queryClient.invalidateQueries({ queryKey: ['tool-holders'] })
      queryClient.invalidateQueries({ queryKey: ['tools-simple-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      setKitIssueDialogOpen(false)
      setKitIssueDestination('')
      setKitIssueNotes('')
      setKitIssueCount(1)
      const kitsLabel = data.kitsIssued > 1 ? `${data.kitsIssued} kits` : '1 kit'
      toast.success(`Entregado: ${kitsLabel} (${data.issuedCount} componente(s))`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const returnKitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedKit) throw new Error('Selecciona un kit')
      const [fromType, id] = kitReturnSource.split(':')
      const body: Record<string, unknown> = {
        fromType,
        fromContractorId: fromType === 'contractor' ? id : undefined,
        fromInstallerId: fromType === 'installer' ? id : undefined,
        toShelfId: kitReturnShelfId === '__reception__' ? undefined : kitReturnShelfId,
        notes: kitReturnNotes,
      }
      if (kitReturnMode === 'full') {
        body.kits = kitReturnCount
      } else {
        body.items = Object.entries(kitReturnItems)
          .map(([toolId, quantity]) => ({ toolId, quantity: Math.max(0, Number(quantity) || 0) }))
          .filter((item) => item.quantity > 0)
      }

      const res = await fetch(`/api/tool-kits/${selectedKit.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo devolver el kit')
      return data
    },
    onSuccess: (data: { returnedCount: number; kit?: ToolKit | null }) => {
      queryClient.invalidateQueries({ queryKey: ['tool-kits'] })
      queryClient.invalidateQueries({ queryKey: ['tool-holders'] })
      queryClient.invalidateQueries({ queryKey: ['tools-simple-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      if (data.kit) setSelectedKit(data.kit)
      setKitReturnDialogOpen(false)
      setKitReturnSource('')
      setKitReturnShelfId('')
      setKitReturnCount(1)
      setKitReturnItems({})
      setKitReturnNotes('')
      toast.success(`Devolucion registrada (${data.returnedCount} componente(s))`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateToolMutation = useMutation({
    mutationFn: async () => {
      if (!editingTool) throw new Error('Selecciona una herramienta')
      const res = await fetch(`/api/tools/${editingTool.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la herramienta')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      setToolDialogOpen(false)
      setEditingTool(null)
      setToolForm(emptyTool)
      toast.success('Herramienta actualizada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteToolMutation = useMutation({
    mutationFn: async (tool: InventoryTool) => {
      const res = await fetch(`/api/tools/${tool.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo borrar la herramienta')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      toast.success('Herramienta borrada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const createInstallerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tool-installers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installerForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el personal')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-installers'] })
      setInstallerDialogOpen(false)
      setInstallerForm(emptyInstaller)
      toast.success('Personal registrado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateInstallerMutation = useMutation({
    mutationFn: async () => {
      if (!editingInstaller) throw new Error('Selecciona una persona')
      const res = await fetch(`/api/tool-installers/${editingInstaller.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installerForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el personal')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-installers'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      setInstallerDialogOpen(false)
      setEditingInstaller(null)
      setInstallerForm(emptyInstaller)
      toast.success('Personal actualizado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteInstallerMutation = useMutation({
    mutationFn: async (installer: ToolInstaller) => {
      const res = await fetch(`/api/tool-installers/${installer.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo borrar el personal')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-installers'] })
      toast.success('Personal borrado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!movementTool) throw new Error('Selecciona una herramienta')
      const [toType, id] = movementForm.destination.split(':')
      const body: Record<string, unknown> = {
        movementType: toType === 'warehouse' ? 'return' : movementForm.movementType,
        movementDate: new Date().toISOString().split('T')[0],
        quantity: movementForm.quantity,
        condition: movementForm.condition || movementTool.condition,
        notes: movementForm.notes,
      }

      if (movementForm.movementType === 'status_change') {
        body.status = movementForm.status
      } else {
        const [fromType, fromId] = movementForm.source.split(':')
        if (fromType === 'contractor') {
          body.fromType = fromType
          body.fromContractorId = fromId
        }
        if (fromType === 'installer') {
          body.fromType = fromType
          body.fromInstallerId = fromId
        }
        body.toType = toType
        if (toType === 'warehouse' && id !== '__reception__') body.toShelfId = id
        if (toType === 'contractor') body.toContractorId = id
        if (toType === 'installer') body.toInstallerId = id
      }

      const res = await fetch(`/api/tools/${movementTool.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el movimiento')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      queryClient.invalidateQueries({ queryKey: ['tool-holders'] })
      queryClient.invalidateQueries({ queryKey: ['tools-simple-ledger'] })
      setMovementTool(null)
      toast.success('Movimiento registrado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function openMovement(tool: InventoryTool, movementType: MovementType, source = '') {
    setMovementTool(tool)
    setMovementForm({
      movementType,
      source,
      destination: '',
      status: 'maintenance',
      quantity: 1,
      condition: tool.condition || 'good',
      notes: '',
    })
  }

  function openNewTool() {
    setEditingTool(null)
    setToolForm(emptyTool)
    setToolDialogOpen(true)
  }

  function openEditTool(tool: InventoryTool) {
    setEditingTool(tool)
    setToolForm({
      code: tool.code || '',
      serial: tool.serial || '',
      category: tool.category || '',
      name: tool.name || '',
      brand: tool.brand || '',
      model: tool.model || '',
      trackingType: tool.trackingType || 'serialized',
      totalQuantity: tool.totalQuantity || 1,
      condition: tool.condition || 'good',
      notes: tool.notes || '',
      currentShelfId: tool.currentShelf ? 'locked' : '',
    })
    setToolDialogOpen(true)
  }

  function openNewInstaller() {
    setEditingInstaller(null)
    setInstallerForm(emptyInstaller)
    setInstallerDialogOpen(true)
  }

  function openNewKit() {
    setEditingKit(null)
    setKitForm(emptyKit)
    setKitDialogOpen(true)
  }

  function openEditKit(kit: ToolKit) {
    setEditingKit(kit)
    setKitForm({
      code: kit.code || '',
      name: kit.name || '',
      notes: kit.notes || '',
      status: kit.status || 'active',
    })
    setKitDialogOpen(true)
  }

  function closeKitDialog(open: boolean) {
    setKitDialogOpen(open)
    if (!open) {
      setEditingKit(null)
      setKitForm(emptyKit)
    }
  }

  function confirmDeleteKit(kit: ToolKit) {
    const ok = window.confirm(`Borrar el kit "${kit.name}"?\n\nLas herramientas no se borran, solo se elimina la agrupacion.`)
    if (ok) deleteKitMutation.mutate(kit)
  }

  function openIssueKit(kit: ToolKit) {
    setSelectedKit(kit)
    setKitIssueDestination('')
    setKitIssueNotes('')
    setKitIssueCount(1)
    setKitIssueDialogOpen(true)
  }

  function openReturnKit(kit: ToolKit, mode: 'full' | 'partial' = 'full', toolId?: string) {
    setSelectedKit(kit)
    setKitReturnSource('')
    setKitReturnShelfId('')
    setKitReturnCount(1)
    setKitReturnMode(mode)
    setKitReturnItems(toolId ? { [toolId]: 1 } : {})
    setKitReturnNotes('')
    setKitReturnDialogOpen(true)
  }

  function assignmentForSource(tool: InventoryTool) {
    const [holderType, holderId] = kitReturnSource.split(':')
    return (tool.assignments || []).find((assignment) =>
      holderType === 'installer'
        ? assignment.holderType === 'installer' && assignment.installerId === holderId
        : assignment.holderType === 'contractor' && assignment.contractorId === holderId
    )
  }


  function holderTypeLabel(type: string) {
    return type === 'installer' ? 'Personal' : 'Contratista'
  }

  function toolsByKit(tools: InventoryTool[]) {
    const groups = new Map<string, { kitName: string; kitCode: string; tools: InventoryTool[] }>()
    const standalone: InventoryTool[] = []

    tools.forEach((tool) => {
      const kit = tool.kitItems?.[0]?.kit
      if (!kit) {
        standalone.push(tool)
        return
      }
      const existing = groups.get(kit.id) || { kitName: kit.name, kitCode: kit.code, tools: [] }
      existing.tools.push(tool)
      groups.set(kit.id, existing)
    })

    return { groups: Array.from(groups.values()), standalone }
  }

  function formatLedgerDate(value: string) {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString()
  }

  function openEditInstaller(installer: ToolInstaller) {
    setEditingInstaller(installer)
    setInstallerForm({
      name: installer.name || '',
      phone: installer.phone || '',
      email: installer.email || '',
      company: installer.company || '',
      role: installer.role || 'installer',
      notes: installer.notes || '',
      active: installer.active !== false,
    })
    setInstallerDialogOpen(true)
  }

  function closeToolDialog(open: boolean) {
    setToolDialogOpen(open)
    if (!open) {
      setEditingTool(null)
      setToolForm(emptyTool)
    }
  }

  function closeInstallerDialog(open: boolean) {
    setInstallerDialogOpen(open)
    if (!open) {
      setEditingInstaller(null)
      setInstallerForm(emptyInstaller)
    }
  }

  function confirmDeleteTool(tool: InventoryTool) {
    const ok = window.confirm(`Borrar la herramienta "${tool.name}"?\n\nEsto tambien borra su historial de movimientos.`)
    if (ok) deleteToolMutation.mutate(tool)
  }

  function confirmDeleteInstaller(installer: ToolInstaller) {
    const ok = window.confirm(`Borrar el personal "${installer.name}"?`)
    if (ok) deleteInstallerMutation.mutate(installer)
  }

  function changeToolSort(key: ToolSortKey) {
    setToolSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function sortableHead(label: string, key: ToolSortKey) {
    const active = toolSort.key === key
    return (
      <button
        type="button"
        onClick={() => changeToolSort(key)}
        className={`inline-flex items-center gap-1 font-medium uppercase ${active ? 'text-primary' : ''}`}
        title={`Ordenar por ${label}`}
      >
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-45'}`} />
        {active && <span className="text-[10px] normal-case">{toolSort.direction === 'asc' ? 'A-Z' : 'Z-A'}</span>}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 -mt-4 space-y-3 border-b bg-background px-4 pb-3 pt-4 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar herramienta, serial, categoría..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="available">Disponible</SelectItem>
              <SelectItem value="assigned">Asignada</SelectItem>
              <SelectItem value="partial">Parcial</SelectItem>
              <SelectItem value="maintenance">Mantenimiento</SelectItem>
              <SelectItem value="damaged">Dañada</SelectItem>
              <SelectItem value="lost">Perdida</SelectItem>
              <SelectItem value="retired">Retirada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeView === 'simple' && (
            <Button variant="outline" onClick={() => setSelectedLedgerGroupId('warehouse')}>
              Warehouse
            </Button>
          )}
          {activeView === 'tools' && (
            <Button onClick={openNewTool}>
              <Plus className="mr-2 h-4 w-4" />
              Herramienta
            </Button>
          )}
          {activeView === 'kits' && (
            <Button onClick={openNewKit}>
              <Plus className="mr-2 h-4 w-4" />
              Kit
            </Button>
          )}
          {activeView === 'holders' && (
            <Button variant="outline" onClick={() => setSelectedHolder(null)}>
              Ver todos
            </Button>
          )}
          {activeView === 'installers' && (
            <Button onClick={openNewInstaller}>
              <Plus className="mr-2 h-4 w-4" />
              Personal
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={activeView === 'simple' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('simple')}>
          <LayoutList className="mr-2 h-4 w-4" />
          Vista simple
        </Button>
        <Button variant={activeView === 'tools' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('tools')}>
          <Wrench className="mr-2 h-4 w-4" />
          Herramientas
        </Button>
        <Button variant={activeView === 'kits' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('kits')}>
          <Boxes className="mr-2 h-4 w-4" />
          Kits
        </Button>
        <Button variant={activeView === 'holders' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('holders')}>
          <Users className="mr-2 h-4 w-4" />
          Responsables
        </Button>
        <Button variant={activeView === 'installers' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('installers')}>
          <Users className="mr-2 h-4 w-4" />
          Personal
        </Button>
      </div>
      </div>

      {activeView === 'simple' && (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutList className="h-4 w-4" />
                Libreta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-3">
              {simpleLedgerLoading ? (
                <div className="text-sm text-muted-foreground">Cargando...</div>
              ) : (
                (['warehouse', 'installer', 'contractor'] as const).map((groupType) => {
                  const items = simpleLedger.filter((g) => g.groupType === groupType)
                  if (items.length === 0) return null
                  const meta = {
                    warehouse:  { icon: Warehouse,  label: 'Bodegas'      },
                    installer:  { icon: HardHat,    label: 'Personal' },
                    contractor: { icon: Building2,  label: 'Contratistas' },
                  }[groupType]
                  const Icon = meta.icon
                  return (
                    <div key={groupType} className="space-y-0.5">
                      <div className="flex items-center gap-1.5 px-1 pb-0.5 pt-3 first:pt-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                      </div>
                      {items.map((group) => (
                        <button
                          key={`${group.groupType}-${group.groupId}`}
                          className={`w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
                            selectedLedgerGroupId === group.groupId ? 'border-primary bg-primary/5' : 'border-transparent'
                          }`}
                          onClick={() => setSelectedLedgerGroupId(group.groupId)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm font-medium ${selectedLedgerGroupId === group.groupId ? 'text-primary' : ''}`}>
                              {group.name}
                            </span>
                            <Badge variant="outline" className="shrink-0 text-xs">{group.toolCount}</Badge>
                          </div>
                          {group.kitCount > 0 && (
                            <div className="mt-0.5 text-xs text-muted-foreground">{group.kitCount} kits</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {(() => {
            const selectedGroup = simpleLedger.find((group) => group.groupId === selectedLedgerGroupId) || simpleLedger[0]
            const HolderIcon =
              selectedGroup?.groupType === 'installer'
                ? HardHat
                : selectedGroup?.groupType === 'contractor'
                  ? Building2
                  : Warehouse
            const roleLabel =
              selectedGroup?.groupType === 'installer'
                ? 'Instalador'
                : selectedGroup?.groupType === 'contractor'
                  ? 'Contratista'
                  : 'Bodega'
            const contactBits = selectedGroup
              ? [selectedGroup.phone, selectedGroup.email].filter(Boolean).join(' · ')
              : ''
            const lastIssuedDate = selectedGroup
              ? selectedGroup.rows.reduce((latest, row) => (row.lastInDate && row.lastInDate > latest ? row.lastInDate : latest), '')
              : ''

            return (
              <Card className="self-start">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted">
                        <HolderIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-tight">
                          {selectedGroup?.name || 'Bodega'}
                        </CardTitle>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium">{roleLabel}</span>
                          {contactBits && (
                            <>
                              <span>·</span>
                              <span className="truncate">{contactBits}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedGroup && (
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-mono tabular-nums">
                          {selectedGroup.toolCount} hrr.
                        </Badge>
                        {selectedGroup.kitCount > 0 && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 font-mono tabular-nums text-amber-700">
                            {selectedGroup.kitCount} kits
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {simpleLedgerLoading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Cargando herramientas...</div>
                  ) : !selectedGroup || selectedGroup.rows.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Wrench}
                        title="Sin herramientas"
                        description="Este grupo no tiene herramientas en posesión actualmente."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[200px]">Herramienta</TableHead>
                              <TableHead className="min-w-[140px]">Serial</TableHead>
                              <TableHead>Condición</TableHead>
                              <TableHead className="w-14 text-right">Cant.</TableHead>
                              <TableHead className="min-w-[160px]">Estado / Movimiento</TableHead>
                              <TableHead className="min-w-[160px]">Notas</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedGroup.rows.map((row) => {
                              const isHolderAssigned = row.currentState === 'in_possession'
                              const canIssue = row.currentState === 'warehouse' && canIssueTool(row.tool)
                              const stateMeta = ledgerStateMeta(row)
                              const holderSource =
                                selectedGroup.groupType === 'installer' || selectedGroup.groupType === 'contractor'
                                  ? `${selectedGroup.groupType}:${selectedGroup.groupId}`
                                  : ''
                              return (
                                <TableRow key={row.tool.id} className="group hover:bg-muted/40 transition-colors">
                                  <TableCell>
                                    <div className="font-medium">{row.toolDescription}</div>
                                    {row.brandModel && <div className="text-xs text-muted-foreground">{row.brandModel}</div>}
                                    {row.kit && (
                                      <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-xs text-amber-700">
                                        {row.kit.name}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      key={`serial-${row.tool.id}-${row.tool.serial ?? ''}`}
                                      defaultValue={row.tool.serial ?? ''}
                                      placeholder="SN..."
                                      onBlur={(event) => {
                                        const next = event.target.value.trim()
                                        if (next !== (row.tool.serial ?? '')) {
                                          updateToolSerialMutation.mutate({ toolId: row.tool.id, serial: next })
                                        }
                                      }}
                                      className="h-8 text-xs"
                                      disabled={updateToolSerialMutation.isPending}
                                    />
                                  </TableCell>
                                  <TableCell><ConditionBadge condition={row.condition} /></TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">{row.qty}</TableCell>
                                  <TableCell className="text-sm">
                                    <Badge variant="outline" className={stateMeta.className}>
                                      {stateMeta.label}
                                    </Badge>
                                    <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                                      {stateMeta.date ? `${stateMeta.dateLabel}: ${formatLedgerDate(stateMeta.date)}` : '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden">
                                    {formatLedgerDate(row.dateIssued) || (
                                      <span className="text-muted-foreground/40">—</span>
                                    )}
                                    {row.dateReturned && (
                                      <div className="text-xs text-muted-foreground">
                                        → devuelta {formatLedgerDate(row.dateReturned)}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                    {row.notes || ''}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {canIssue && (
                                        <Button variant="outline" size="sm" onClick={() => openMovement(row.tool, 'issue')}>Entregar</Button>
                                      )}
                                      {isHolderAssigned && (
                                        <Button variant="outline" size="sm" onClick={() => openMovement(row.tool, 'transfer', holderSource)}>Transferir</Button>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {isHolderAssigned && (
                                            <DropdownMenuItem onClick={() => openMovement(row.tool, 'return', holderSource)}>
                                              <CornerDownLeft className="mr-2 h-4 w-4" /> Devolver
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem onClick={() => openMovement(row.tool, 'status_change')}>
                                            <RefreshCw className="mr-2 h-4 w-4" /> Cambiar estado
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setHistoryTool(row.tool)}>
                                            <History className="mr-2 h-4 w-4" /> Ver historial
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span>
                            <span className="font-mono font-semibold tabular-nums text-foreground">{selectedGroup.toolCount}</span> herramientas
                          </span>
                          {selectedGroup.kitCount > 0 && (
                            <span>
                              <span className="font-mono font-semibold tabular-nums text-foreground">{selectedGroup.kitCount}</span> kits
                            </span>
                          )}
                        </div>
                        {lastIssuedDate && (
                          <span>Ultimo movimiento: <span className="text-foreground">{formatLedgerDate(lastIssuedDate)}</span></span>
                        )}
                        {false && lastIssuedDate && (
                          <span>Última entrega: <span className="text-foreground">{formatLedgerDate(lastIssuedDate)}</span></span>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })()}
        </div>
      )}

      {activeView === 'tools' && (
        <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {([
          { status: 'available',   label: 'Disponibles',   color: 'border-l-emerald-500' },
          { status: 'assigned',    label: 'Asignadas',     color: 'border-l-sky-500'     },
          { status: 'partial',     label: 'Parciales',     color: 'border-l-amber-500'   },
          { status: 'maintenance', label: 'Mantenimiento', color: 'border-l-amber-400'   },
        ] as const).map(({ status, label, color }) => (
          <div key={status} className={`rounded-md border border-l-4 ${color} bg-card px-3 py-2`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
              {sortedTools.filter((t) => t.status === status).length}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando herramientas...</div>
          ) : tools.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Wrench}
                title="Sin herramientas"
                description="Registra herramientas serializadas para controlar entregas, transferencias y devoluciones."
                action={<Button onClick={openNewTool}>Registrar herramienta</Button>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{sortableHead('Herramienta', 'name')}</TableHead>
                    <TableHead>{sortableHead('Codigo', 'code')}</TableHead>
                    <TableHead>{sortableHead('Categoria', 'category')}</TableHead>
                    <TableHead>{sortableHead('Estado', 'status')}</TableHead>
                    <TableHead>{sortableHead('Condicion', 'condition')}</TableHead>
                    <TableHead>{sortableHead('Ubicacion / Responsable', 'location')}</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTools.map((tool) => (
                    <TableRow key={tool.id} className="group hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <div className="font-medium">{tool.name}</div>
                        {tool.serial && <div className="text-xs text-muted-foreground">SN {tool.serial}</div>}
                        {(tool.brand || tool.model) && (
                          <div className="text-xs text-muted-foreground">
                            {[tool.brand, tool.model].filter(Boolean).join(' / ')}
                          </div>
                        )}
                        {tool.trackingType === 'quantity' && (
                          <div className="text-xs text-muted-foreground">
                            Qty {tool.totalQuantity} · {tool.availableQuantity} disp. · {tool.assignedQuantity} asign.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{tool.code}</TableCell>
                      <TableCell>{tool.category}</TableCell>
                      <TableCell><ToolStatusBadge status={tool.status} /></TableCell>
                      <TableCell><ConditionBadge condition={tool.condition} /></TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">{holderLabel(tool)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canIssueTool(tool) && (
                            <Button variant="outline" size="sm" onClick={() => openMovement(tool, 'issue')}>Entregar</Button>
                          )}
                          {['assigned', 'partial'].includes(tool.status) && (
                            <Button variant="outline" size="sm" onClick={() => openMovement(tool, 'transfer')}>Transferir</Button>
                          )}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {['assigned', 'partial'].includes(tool.status) && (
                                  <DropdownMenuItem onClick={() => openMovement(tool, 'return')}>
                                    <CornerDownLeft className="mr-2 h-4 w-4" /> Devolver
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => openMovement(tool, 'status_change')}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Cambiar estado
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setHistoryTool(tool)}>
                                  <History className="mr-2 h-4 w-4" /> Ver historial
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditTool(tool)}>
                                  <Edit2 className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => confirmDeleteTool(tool)}
                                  disabled={deleteToolMutation.isPending}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {activeView === 'kits' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <Card>
            <CardContent className="p-0">
              {kitsLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Cargando kits...</div>
              ) : kits.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Boxes}
                    title="Sin kits"
                    description="Crea kits para agrupar herramientas y entregarlas juntas sin perder el control individual."
                    action={<Button onClick={openNewKit}>Crear kit</Button>}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Kit</TableHead>
                        <TableHead className="min-w-[110px]">Inventario</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kits.map((kit) => (
                        <TableRow key={kit.id} className={`group hover:bg-muted/40 transition-colors ${selectedKit?.id === kit.id ? 'bg-muted/50' : ''}`}>
                          <TableCell>
                            <button className="text-left font-medium hover:underline" onClick={() => setSelectedKit(kit)}>
                              {kit.name}
                            </button>
                            <div className="text-xs text-muted-foreground">{kit.code}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="whitespace-nowrap font-mono tabular-nums">
                              <span className="font-semibold text-emerald-700">{kit.summary.kitsAvailable}</span>
                              <span className="text-muted-foreground"> disp · </span>
                              <span>{kit.summary.kitsAssigned}</span>
                              <span className="text-muted-foreground"> asign</span>
                            </div>
                            <div className="whitespace-nowrap text-xs text-muted-foreground">
                              {kit.summary.componentCount} comp · {kit.summary.totalUnits} u/kit
                            </div>
                          </TableCell>
                          <TableCell><ToolStatusBadge status={kit.summary.computedStatus} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => openIssueKit(kit)}>Entregar kit</Button>
                              {kit.summary.kitsAssigned > 0 && (
                                <Button variant="outline" size="sm" onClick={() => openReturnKit(kit)}>
                                  Devolver
                                </Button>
                              )}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setSelectedKit(kit)}>
                                      <Boxes className="mr-2 h-4 w-4" /> Ver componentes
                                    </DropdownMenuItem>
                                    {kit.summary.kitsAssigned > 0 && (
                                      <DropdownMenuItem onClick={() => openReturnKit(kit, 'partial')}>
                                        <CornerDownLeft className="mr-2 h-4 w-4" /> Devolver parcial
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => openEditKit(kit)}>
                                      <Edit2 className="mr-2 h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => confirmDeleteKit(kit)}
                                      disabled={deleteKitMutation.isPending}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-4 w-4" />
                Componentes del kit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedKit ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Boxes className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Selecciona un kit de la lista para ver y gestionar sus componentes</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border bg-muted/40 px-3 py-2">
                    <div className="font-medium">{selectedKit.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedKit.code} · {selectedKit.summary.componentCount} componente(s)
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span className="font-mono tabular-nums">
                        <span className="font-semibold text-emerald-700">{selectedKit.summary.kitsAvailable}</span>
                        <span className="text-muted-foreground"> kits disp.</span>
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {selectedKit.summary.kitsAssigned} asign.
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={kitToolId} onValueChange={setKitToolId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Agregar herramienta" /></SelectTrigger>
                      <SelectContent>
                        {tools.filter((tool) => !tool.kitItems?.length).map((tool) => (
                          <SelectItem key={tool.id} value={tool.id}>
                            {tool.name}{tool.brand ? ` · ${tool.brand}` : tool.code ? ` · ${tool.code}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={kitItemQty}
                      onChange={(event) => setKitItemQty(Math.max(1, Number(event.target.value) || 1))}
                      className="w-20"
                      title="Cantidad"
                    />
                    <Button onClick={() => addKitItemMutation.mutate()} disabled={!kitToolId || addKitItemMutation.isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {selectedKit.items.map((item) => {
                      const isQty = item.tool.trackingType === 'quantity'
                      const avail = item.tool.availableQuantity ?? 0
                      const assigned = item.tool.assignedQuantity ?? 0
                      const canIssue = canIssueTool(item.tool)
                      const hasAssigned = isQty ? assigned > 0 : item.tool.status === 'assigned' || item.tool.status === 'partial'
                      const availLabel = isQty && avail > 1 ? ` (${avail} disp)` : ''
                      return (
                        <div
                          key={item.id}
                          className={`group rounded-md border border-l-2 bg-card p-3 transition-colors hover:bg-muted/20 ${getToolBorderClass(item.tool)}`}
                        >
                          {/* Top: nombre + marca + holder + badge + dropdown */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium leading-tight">{item.tool.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.tool.brand || item.tool.code}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {holderLabel(item.tool)}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <ToolStatusBadge status={item.tool.status} />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {hasAssigned && (
                                    <DropdownMenuItem onClick={() => openMovement(item.tool, 'transfer')}>
                                      <ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir
                                    </DropdownMenuItem>
                                  )}
                                  {hasAssigned && (
                                    <DropdownMenuItem onClick={() => openReturnKit(selectedKit, 'partial', item.tool.id)}>
                                      <CornerDownLeft className="mr-2 h-4 w-4" /> Devolver al WH
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => openMovement(item.tool, 'status_change')}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Cambiar estado
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setHistoryTool(item.tool)}>
                                    <History className="mr-2 h-4 w-4" /> Ver historial
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => removeKitItemMutation.mutate({ kitId: selectedKit.id, itemId: item.id })}
                                    disabled={removeKitItemMutation.isPending}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Quitar del kit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Bottom: serial + cant + acción primaria */}
                          <div className="mt-2.5 flex items-end gap-2 border-t pt-2.5">
                            <div className="space-y-0.5">
                              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Serial</Label>
                              <Input
                                key={`serial-${item.tool.id}-${item.tool.serial ?? ''}`}
                                defaultValue={item.tool.serial ?? ''}
                                placeholder="SN..."
                                onBlur={(event) => {
                                  const next = event.target.value.trim()
                                  if (next !== (item.tool.serial ?? '')) {
                                    updateToolSerialMutation.mutate({ toolId: item.tool.id, serial: next })
                                  }
                                }}
                                className="h-7 w-28 text-xs"
                                disabled={updateToolSerialMutation.isPending}
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cant/kit</Label>
                              <Input
                                type="number"
                                min={1}
                                defaultValue={item.quantity ?? 1}
                                onBlur={(event) => {
                                  const next = Math.max(1, Number(event.target.value) || 1)
                                  if (next !== (item.quantity ?? 1)) {
                                    updateKitItemQtyMutation.mutate({ kitId: selectedKit.id, itemId: item.id, quantity: next })
                                  }
                                }}
                                className="h-7 w-14 text-center text-xs"
                                disabled={updateKitItemQtyMutation.isPending}
                              />
                            </div>
                            <div className="ml-auto">
                              {canIssue ? (
                                <Button size="sm" className="h-8" onClick={() => openMovement(item.tool, 'issue')}>
                                  Entregar{availLabel}
                                </Button>
                              ) : hasAssigned ? (
                                <Button variant="outline" size="sm" className="h-8" onClick={() => openMovement(item.tool, 'transfer')}>
                                  Transferir
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'holders' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
          <Card>
            <CardContent className="p-0">
              {holdersLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Cargando responsables...</div>
              ) : holders.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Users}
                    title="Sin responsables"
                    description="Cuando entregues herramientas a personal o contratistas, apareceran aqui."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead className="text-right">Herramientas</TableHead>
                        <TableHead className="text-right">Kits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holders.map((holder) => (
                        <TableRow
                          key={`${holder.holderType}-${holder.holderId}`}
                          className={selectedHolder?.holderType === holder.holderType && selectedHolder?.holderId === holder.holderId ? 'bg-muted/50' : ''}
                        >
                          <TableCell>
                            <button className="text-left font-medium hover:underline" onClick={() => setSelectedHolder(holder)}>
                              {holder.name}
                            </button>
                            <div className="text-xs text-muted-foreground">{holderTypeLabel(holder.holderType)}{holder.note ? ` · ${holder.note}` : ''}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {[holder.phone, holder.email].filter(Boolean).join(' · ') || '-'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{holder.toolCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{holder.kitCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4" />
                Herramientas en posesión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedHolder ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Selecciona un responsable para ver las herramientas que tiene en posesión</p>
                </div>
              ) : selectedHolder.toolCount === 0 ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {selectedHolder.name} no tiene herramientas asignadas ahora mismo.
                </div>
              ) : (
                <>
                  <div className="rounded-md border bg-muted/40 px-3 py-2">
                    <div className="font-medium">{selectedHolder.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {holderTypeLabel(selectedHolder.holderType)} · {selectedHolder.toolCount} herramientas · {selectedHolder.kitCount} kits
                    </div>
                  </div>
                  {(() => {
                    const grouped = toolsByKit(selectedHolder.tools)
                    const holderSource = `${selectedHolder.holderType}:${selectedHolder.holderId}`
                    return (
                      <div className="space-y-4">
                        {grouped.groups.map((group) => (
                          <div key={group.kitCode} className="rounded-md border">
                            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                              <div>
                                <div className="text-sm font-medium">{group.kitName}</div>
                                <div className="text-xs text-muted-foreground">{group.kitCode} · {group.tools.length} componentes con esta persona</div>
                              </div>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Kit parcial</Badge>
                            </div>
                            <div className="divide-y">
                              {group.tools.map((tool) => (
                                <div key={tool.id} className="group/tool flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/40">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{tool.name}</div>
                                    <div className="truncate text-xs text-muted-foreground">{tool.code}{tool.serial ? ` · SN ${tool.serial}` : ''} · {tool.category}</div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Button variant="outline" size="sm" onClick={() => openMovement(tool, 'transfer', holderSource)}>Transferir</Button>
                                    <div className="opacity-0 group-hover/tool:opacity-100 transition-opacity">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => openMovement(tool, 'return', holderSource)}>
                                            <CornerDownLeft className="mr-2 h-4 w-4" /> Devolver
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setHistoryTool(tool)}>
                                            <History className="mr-2 h-4 w-4" /> Ver historial
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {grouped.standalone.length > 0 && (
                          <div className="rounded-md border">
                            <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Herramientas individuales</div>
                            <div className="divide-y">
                              {grouped.standalone.map((tool) => (
                                <div key={tool.id} className="group/tool flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/40">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{tool.name}</div>
                                    <div className="truncate text-xs text-muted-foreground">{tool.code}{tool.serial ? ` · SN ${tool.serial}` : ''} · {tool.category}</div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Button variant="outline" size="sm" onClick={() => openMovement(tool, 'transfer', holderSource)}>Transferir</Button>
                                    <div className="opacity-0 group-hover/tool:opacity-100 transition-opacity">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => openMovement(tool, 'return', holderSource)}>
                                            <CornerDownLeft className="mr-2 h-4 w-4" /> Devolver
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setHistoryTool(tool)}>
                                            <History className="mr-2 h-4 w-4" /> Ver historial
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'installers' && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Personal
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openNewInstaller}>
            <Plus className="mr-2 h-4 w-4" />
            Persona
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {installers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={HardHat}
                title="Sin personal"
                description="Registra instaladores, contratistas, cortadores y personal de oficina para asignar herramientas y controlar su inventario."
                action={<Button onClick={openNewInstaller}>Registrar personal</Button>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Compania / nota</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Herramientas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installers.map((installer) => (
                    <TableRow key={installer.id}>
                      <TableCell className="font-medium">{installer.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                          {personnelRoleLabel(installer.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[installer.phone, installer.email].filter(Boolean).join(' · ') || '-'}
                      </TableCell>
                      <TableCell>{installer.company || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={installer.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground'}>
                          {installer.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{installer._count?.currentTools || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditInstaller(installer)} title="Editar personal">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => confirmDeleteInstaller(installer)}
                            disabled={deleteInstallerMutation.isPending}
                            title="Borrar personal"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Dialog open={toolDialogOpen} onOpenChange={closeToolDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTool ? 'Editar herramienta' : 'Registrar herramienta'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Código interno *</Label>
              <Input value={toolForm.code} onChange={(event) => setToolForm({ ...toolForm, code: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Serial</Label>
              <Input value={toolForm.serial} onChange={(event) => setToolForm({ ...toolForm, serial: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Drill, sierra, blower..." value={toolForm.name} onChange={(event) => setToolForm({ ...toolForm, name: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <Input value={toolForm.category} onChange={(event) => setToolForm({ ...toolForm, category: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input value={toolForm.brand} onChange={(event) => setToolForm({ ...toolForm, brand: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={toolForm.model} onChange={(event) => setToolForm({ ...toolForm, model: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Control</Label>
              <Select value={toolForm.trackingType} onValueChange={(value) => setToolForm({ ...toolForm, trackingType: value, totalQuantity: value === 'serialized' ? 1 : toolForm.totalQuantity })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="serialized">Serializada</SelectItem>
                  <SelectItem value="quantity">Por cantidad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad total</Label>
              <Input
                type="number"
                min={1}
                value={toolForm.totalQuantity}
                disabled={toolForm.trackingType === 'serialized'}
                onChange={(event) => setToolForm({ ...toolForm, totalQuantity: Math.max(1, Number(event.target.value) || 1) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Condición</Label>
              <Select value={toolForm.condition} onValueChange={(value) => setToolForm({ ...toolForm, condition: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Buena</SelectItem>
                  <SelectItem value="fair">Regular</SelectItem>
                  <SelectItem value="damaged">Dañada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingTool && (
              <div className="space-y-1.5">
                <Label>Ubicación inicial</Label>
                <Select value={toolForm.currentShelfId || '__none__'} onValueChange={(value) => setToolForm({ ...toolForm, currentShelfId: value === '__none__' ? '' : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin shelf</SelectItem>
                    {shelves.map((shelf) => (
                      <SelectItem key={shelf.id} value={shelf.id}>{shelf.name} / {shelf.rackName} / {shelf.warehouseName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notas</Label>
              <Textarea value={toolForm.notes} onChange={(event) => setToolForm({ ...toolForm, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeToolDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => (editingTool ? updateToolMutation.mutate() : createToolMutation.mutate())}
              disabled={createToolMutation.isPending || updateToolMutation.isPending || !toolForm.code || !toolForm.name || !toolForm.category}
            >
              {(createToolMutation.isPending || updateToolMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTool ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kitDialogOpen} onOpenChange={closeKitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKit ? 'Editar kit' : 'Nuevo kit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Código interno *</Label>
              <Input value={kitForm.code} onChange={(event) => setKitForm({ ...kitForm, code: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={kitForm.name} onChange={(event) => setKitForm({ ...kitForm, name: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={kitForm.status} onValueChange={(value) => setKitForm({ ...kitForm, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={kitForm.notes} onChange={(event) => setKitForm({ ...kitForm, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeKitDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => (editingKit ? updateKitMutation.mutate() : createKitMutation.mutate())}
              disabled={createKitMutation.isPending || updateKitMutation.isPending || !kitForm.code || !kitForm.name}
            >
              {(createKitMutation.isPending || updateKitMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingKit ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kitIssueDialogOpen} onOpenChange={(open) => !open && setKitIssueDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entregar kit</DialogTitle>
          </DialogHeader>
          {selectedKit && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{selectedKit.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-emerald-700">{selectedKit.summary.kitsAvailable}</span> kit(s) disponibles · {selectedKit.summary.componentCount} componente(s) por kit
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cantidad de kits</Label>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, selectedKit.summary.kitsAvailable)}
                    value={kitIssueCount}
                    onChange={(event) => setKitIssueCount(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Recibe</Label>
                  <Select value={kitIssueDestination} onValueChange={setKitIssueDestination}>
                    <SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger>
                    <SelectContent>
                      {installers.filter((installer) => installer.active).map((installer) => (
                        <SelectItem key={installer.id} value={`installer:${installer.id}`}>{personnelLabel(installer)}</SelectItem>
                      ))}
                      {contractors.map((contractor) => (
                        <SelectItem key={contractor.id} value={`contractor:${contractor.id}`}>Contratista: {contractor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {kitIssueCount > selectedKit.summary.kitsAvailable && (
                <p className="text-xs text-rose-600">Solo hay {selectedKit.summary.kitsAvailable} kit(s) disponibles.</p>
              )}
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea value={kitIssueNotes} onChange={(event) => setKitIssueNotes(event.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKitIssueDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => issueKitMutation.mutate()}
              disabled={
                !kitIssueDestination ||
                issueKitMutation.isPending ||
                (selectedKit ? kitIssueCount > selectedKit.summary.kitsAvailable : true) ||
                kitIssueCount < 1
              }
            >
              {issueKitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kitReturnDialogOpen} onOpenChange={(open) => !open && setKitReturnDialogOpen(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Devolver kit</DialogTitle>
          </DialogHeader>
          {selectedKit && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{selectedKit.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedKit.code} · {selectedKit.summary.kitsAssigned} kit(s) asignado(s)
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Devuelve</Label>
                  <Select value={kitReturnSource} onValueChange={setKitReturnSource}>
                    <SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger>
                    <SelectContent>
                      {kitReturnHolders.map((holder) => (
                        <SelectItem key={holder.value} value={holder.value}>
                          {holder.label} · {holder.fullKits} kit(s)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Destino WH</Label>
                  <Select value={kitReturnShelfId} onValueChange={setKitReturnShelfId}>
                    <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__reception__">WH: Recepcion</SelectItem>
                      {shelves.map((shelf) => (
                        <SelectItem key={shelf.id} value={shelf.id}>WH: {shelf.name} / {shelf.rackName} / {shelf.warehouseName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de devolucion</Label>
                <Select value={kitReturnMode} onValueChange={(value) => setKitReturnMode(value as 'full' | 'partial')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Kit completo</SelectItem>
                    <SelectItem value="partial">Herramientas especificas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kitReturnMode === 'full' ? (
                <div className="space-y-1.5">
                  <Label>Cantidad de kits</Label>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, selectedKitReturnHolder?.fullKits || 1)}
                    value={kitReturnCount}
                    onChange={(event) => setKitReturnCount(Math.max(1, Number(event.target.value) || 1))}
                  />
                  {selectedKitReturnHolder && kitReturnCount > selectedKitReturnHolder.fullKits && (
                    <p className="text-xs text-rose-600">Ese responsable solo tiene {selectedKitReturnHolder.fullKits} kit(s) completo(s).</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Herramienta</TableHead>
                        <TableHead className="w-28 text-right">Asignada</TableHead>
                        <TableHead className="w-32">Devuelve</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedKit.items.map((item) => {
                        const assignment = assignmentForSource(item.tool)
                        const maxQuantity = assignment?.quantity || 0
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.tool.name}</div>
                              <div className="text-xs text-muted-foreground">{item.tool.code}</div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{maxQuantity}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={maxQuantity}
                                value={kitReturnItems[item.tool.id] || 0}
                                onChange={(event) =>
                                  setKitReturnItems({
                                    ...kitReturnItems,
                                    [item.tool.id]: Math.min(maxQuantity, Math.max(0, Number(event.target.value) || 0)),
                                  })
                                }
                                disabled={!kitReturnSource || maxQuantity === 0}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea value={kitReturnNotes} onChange={(event) => setKitReturnNotes(event.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKitReturnDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => returnKitMutation.mutate()}
              disabled={
                returnKitMutation.isPending ||
                !kitReturnSource ||
                !kitReturnShelfId ||
                (kitReturnMode === 'full' && (!selectedKitReturnHolder || selectedKitReturnHolder.fullKits < 1 || kitReturnCount > selectedKitReturnHolder.fullKits)) ||
                (kitReturnMode === 'partial' && kitReturnPartialTotal < 1)
              }
            >
              {returnKitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={installerDialogOpen} onOpenChange={closeInstallerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingInstaller ? 'Editar personal' : 'Nuevo personal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={installerForm.name} onChange={(event) => setInstallerForm({ ...installerForm, name: event.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={installerForm.role} onValueChange={(value) => setInstallerForm({ ...installerForm, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {personnelRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input value={installerForm.phone} onChange={(event) => setInstallerForm({ ...installerForm, phone: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={installerForm.email} onChange={(event) => setInstallerForm({ ...installerForm, email: event.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Compania / nota</Label>
              <Input value={installerForm.company} onChange={(event) => setInstallerForm({ ...installerForm, company: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={installerForm.active ? 'active' : 'inactive'} onValueChange={(value) => setInstallerForm({ ...installerForm, active: value === 'active' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={installerForm.notes} onChange={(event) => setInstallerForm({ ...installerForm, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeInstallerDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => (editingInstaller ? updateInstallerMutation.mutate() : createInstallerMutation.mutate())}
              disabled={createInstallerMutation.isPending || updateInstallerMutation.isPending || !installerForm.name}
            >
              {(createInstallerMutation.isPending || updateInstallerMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingInstaller ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movementTool} onOpenChange={(open) => !open && setMovementTool(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Movimiento de herramienta
            </DialogTitle>
          </DialogHeader>
          {movementTool && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{movementTool.name}</p>
                <p className="text-xs text-muted-foreground">{movementTool.code} · Actual: {holderLabel(movementTool)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={movementForm.movementType} onValueChange={(value) => setMovementForm({ ...movementForm, movementType: value as MovementType, source: '', destination: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="issue">Entregar</SelectItem>
                    <SelectItem value="transfer">Transferir</SelectItem>
                    <SelectItem value="return">Devolver</SelectItem>
                    <SelectItem value="status_change">Cambiar estado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {movementForm.movementType === 'status_change' ? (
                <div className="space-y-1.5">
                  <Label>Nuevo estado</Label>
                  <Select value={movementForm.status} onValueChange={(value) => setMovementForm({ ...movementForm, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Mantenimiento</SelectItem>
                      <SelectItem value="damaged">Dañada</SelectItem>
                      <SelectItem value="lost">Perdida</SelectItem>
                      <SelectItem value="retired">Retirada</SelectItem>
                      <SelectItem value="available">Disponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Destino</Label>
                  <Select value={movementForm.destination} onValueChange={(value) => setMovementForm({ ...movementForm, destination: value })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar destino" /></SelectTrigger>
                    <SelectContent>
                      {movementForm.movementType === 'return' && (
                        <>
                          <SelectItem value="warehouse:__reception__">WH: Recepcion</SelectItem>
                          {shelves.map((shelf) => (
                            <SelectItem key={shelf.id} value={`warehouse:${shelf.id}`}>WH: {shelf.name} / {shelf.rackName} / {shelf.warehouseName}</SelectItem>
                          ))}
                        </>
                      )}
                      {movementForm.movementType !== 'return' && (
                        <>
                          {installers.filter((installer) => installer.active).map((installer) => (
                            <SelectItem key={installer.id} value={`installer:${installer.id}`}>{personnelLabel(installer)}</SelectItem>
                          ))}
                          {contractors.map((contractor) => (
                            <SelectItem key={contractor.id} value={`contractor:${contractor.id}`}>Contratista: {contractor.name}</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {movementTool.trackingType === 'quantity' && ['return', 'transfer'].includes(movementForm.movementType) && (movementTool.assignments?.length || 0) > 1 && !movementForm.source && (
                <div className="space-y-1.5">
                  <Label>Origen</Label>
                  <Select value={movementForm.source} onValueChange={(value) => setMovementForm({ ...movementForm, source: value })}>
                    <SelectTrigger><SelectValue placeholder="Quien entrega" /></SelectTrigger>
                    <SelectContent>
                      {(movementTool.assignments || []).map((assignment) => {
                        const holderId = assignment.holderType === 'installer' ? assignment.installerId : assignment.contractorId
                        if (!holderId) return null
                        return (
                          <SelectItem key={assignment.id} value={`${assignment.holderType}:${holderId}`}>
                            {assignment.holderType === 'installer' ? personnelLabel(assignment.installer) : `Contratista: ${assignment.contractor?.name || ''}`} · {assignment.quantity}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {movementTool.trackingType === 'quantity' && movementForm.movementType !== 'status_change' && (
                <div className="space-y-1.5">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={1}
                    max={movementForm.movementType === 'return' ? movementTool.assignedQuantity : movementTool.availableQuantity}
                    value={movementForm.quantity}
                    onChange={(event) => setMovementForm({ ...movementForm, quantity: Math.max(1, Number(event.target.value) || 1) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Disponible: {movementTool.availableQuantity} · Asignada: {movementTool.assignedQuantity}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Condición al mover</Label>
                <Select value={movementForm.condition} onValueChange={(value) => setMovementForm({ ...movementForm, condition: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Buena</SelectItem>
                    <SelectItem value="fair">Regular</SelectItem>
                    <SelectItem value="damaged">Dañada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea value={movementForm.notes} onChange={(event) => setMovementForm({ ...movementForm, notes: event.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementTool(null)}>Cancelar</Button>
            <Button
              onClick={() => movementMutation.mutate()}
              disabled={
                movementMutation.isPending ||
                (movementForm.movementType !== 'status_change' && !movementForm.destination) ||
                (movementTool?.trackingType === 'quantity' && ['return', 'transfer'].includes(movementForm.movementType) && (movementTool.assignments?.length || 0) > 1 && !movementForm.source)
              }
            >
              {movementMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyTool} onOpenChange={(open) => !open && setHistoryTool(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de herramienta</DialogTitle>
          </DialogHeader>
          {historyTool && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="font-medium">{historyTool.name}</p>
                <p className="text-xs text-muted-foreground">{historyTool.code} · {holderLabel(historyTool)}</p>
              </div>
              <div className="max-h-[420px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Movimiento</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Condición</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyTool.movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap">{movement.movementDate}</TableCell>
                        <TableCell>{movementLabels[movement.movementType] || movement.movementType}</TableCell>
                        <TableCell className="text-xs">{movementEndpointLabel(movement.fromType, movement, 'from')}</TableCell>
                        <TableCell className="text-xs">{movementEndpointLabel(movement.toType, movement, 'to')}</TableCell>
                        <TableCell>{movement.condition || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
