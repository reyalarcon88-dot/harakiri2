import { db } from '@/lib/db'

export const toolKitInclude = {
  items: {
    include: {
      tool: {
        include: {
          currentShelf: { include: { rack: { include: { warehouse: true } } } },
          currentContractor: true,
          currentInstaller: true,
          assignments: {
            include: {
              contractor: true,
              installer: true,
            },
            orderBy: { updatedAt: 'desc' as const },
          },
          movements: {
            take: 5,
            orderBy: { createdAt: 'desc' as const },
            include: {
              fromShelf: { include: { rack: { include: { warehouse: true } } } },
              toShelf: { include: { rack: { include: { warehouse: true } } } },
              fromContractor: true,
              toContractor: true,
              fromInstaller: true,
              toInstaller: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
}

type ToolWithHolder = {
  status: string
  availableQuantity?: number
  assignedQuantity?: number
  totalQuantity?: number
  currentShelfId: string | null
  currentContractorId: string | null
  currentInstallerId: string | null
  currentShelf?: { name: string; rack: { name: string; warehouse: { name: string } } } | null
  currentContractor?: { name: string } | null
  currentInstaller?: { name: string } | null
  assignments?: {
    holderType: string
    quantity: number
    contractor?: { name: string } | null
    installer?: { name: string } | null
  }[]
}

type KitWithItems = {
  items: { quantity?: number; tool: ToolWithHolder }[]
}

function holderKey(tool: ToolWithHolder) {
  if (tool.currentInstallerId) return `installer:${tool.currentInstallerId}`
  if (tool.currentContractorId) return `contractor:${tool.currentContractorId}`
  if (tool.currentShelfId) return `warehouse:${tool.currentShelfId}`
  return ''
}

function holderLabel(tool: ToolWithHolder) {
  if (tool.assignments?.length) {
    return tool.assignments
      .map((assignment) => {
        const name = assignment.installer?.name || assignment.contractor?.name || 'Responsable'
        return `${name}: ${assignment.quantity}`
      })
      .join(', ')
  }
  if (tool.currentInstaller) return `Instalador: ${tool.currentInstaller.name}`
  if (tool.currentContractor) return `Contratista: ${tool.currentContractor.name}`
  if (tool.currentShelf) return `${tool.currentShelf.name} / ${tool.currentShelf.rack.name} / ${tool.currentShelf.rack.warehouse.name}`
  return 'Sin ubicacion'
}

export function decorateKit<T extends KitWithItems>(kit: T) {
  const tools = kit.items.map((item) => item.tool)
  const counts = tools.reduce(
    (acc, tool) => {
      acc[tool.status] = (acc[tool.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Recipe math: how many full kits can we assemble / how many are out?
  let kitsAvailable = kit.items.length === 0 ? 0 : Infinity
  let kitsAssigned = kit.items.length === 0 ? 0 : Infinity
  let totalUnits = 0
  for (const item of kit.items) {
    const perKit = Math.max(1, item.quantity || 1)
    const availUnits = item.tool.availableQuantity ?? (item.tool.status === 'available' ? 1 : 0)
    const assignedUnits = item.tool.assignedQuantity ?? (item.tool.status === 'assigned' ? 1 : 0)
    kitsAvailable = Math.min(kitsAvailable, Math.floor(availUnits / perKit))
    kitsAssigned = Math.min(kitsAssigned, Math.floor(assignedUnits / perKit))
    totalUnits += perKit
  }
  if (!Number.isFinite(kitsAvailable)) kitsAvailable = 0
  if (!Number.isFinite(kitsAssigned)) kitsAssigned = 0

  const assignmentKeys = kit.items.flatMap((item) =>
    (item.tool.assignments || []).map((assignment) => {
      const id = assignment.holderType === 'installer' ? assignment.installer?.name : assignment.contractor?.name
      return `${assignment.holderType}:${id || ''}`
    })
  )
  const keys = Array.from(new Set(assignmentKeys.length ? assignmentKeys : tools.map(holderKey).filter(Boolean)))
  const commonHolder = keys.length === 1 ? holderLabel(tools[0]) : ''
  const computedStatus =
    kit.items.length === 0
      ? 'empty'
      : kitsAssigned >= 1 && kitsAvailable === 0
        ? 'assigned'
        : kitsAssigned >= 1 && kitsAvailable >= 1
          ? 'partial'
          : kitsAvailable >= 1
            ? 'available'
            : 'partial'

  return {
    ...kit,
    summary: {
      total: tools.length,
      componentCount: tools.length,
      totalUnits,
      kitsAvailable,
      kitsAssigned,
      available: counts.available || 0,
      assigned: counts.assigned || 0,
      maintenance: counts.maintenance || 0,
      damaged: counts.damaged || 0,
      lost: counts.lost || 0,
      retired: counts.retired || 0,
      computedStatus,
      commonHolder,
    },
  }
}
