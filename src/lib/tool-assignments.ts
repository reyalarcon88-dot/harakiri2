type ToolAssignmentTx = {
  toolAssignments: {
    findFirst: (args: unknown) => Promise<any>
    findMany: (args: unknown) => Promise<any[]>
    create: (args: unknown) => Promise<any>
    update: (args: unknown) => Promise<any>
    delete: (args: unknown) => Promise<any>
  }
  inventoryTools: {
    findUnique: (args: unknown) => Promise<any>
    update: (args: unknown) => Promise<any>
  }
}

export type ToolHolderType = 'contractor' | 'installer'

export function holderWhere(holderType: ToolHolderType, holderId: string) {
  return holderType === 'contractor'
    ? { holderType, contractorId: holderId, installerId: null }
    : { holderType, contractorId: null, installerId: holderId }
}

export function movementEndpoint(holderType: ToolHolderType, holderId: string, prefix: 'from' | 'to') {
  return holderType === 'contractor'
    ? { [`${prefix}Type`]: holderType, [`${prefix}ContractorId`]: holderId, [`${prefix}InstallerId`]: null }
    : { [`${prefix}Type`]: holderType, [`${prefix}ContractorId`]: null, [`${prefix}InstallerId`]: holderId }
}

export async function incrementToolAssignment(
  tx: ToolAssignmentTx,
  toolId: string,
  holderType: ToolHolderType,
  holderId: string,
  quantity: number
) {
  const current = await tx.toolAssignments.findFirst({
    where: { toolId, ...holderWhere(holderType, holderId) },
  })

  if (current) {
    return tx.toolAssignments.update({
      where: { id: current.id },
      data: { quantity: current.quantity + quantity },
    })
  }

  return tx.toolAssignments.create({
    data: {
      toolId,
      holderType,
      contractorId: holderType === 'contractor' ? holderId : null,
      installerId: holderType === 'installer' ? holderId : null,
      quantity,
    },
  })
}

export async function decrementToolAssignment(
  tx: ToolAssignmentTx,
  toolId: string,
  holderType: ToolHolderType,
  holderId: string,
  quantity: number
) {
  const current = await tx.toolAssignments.findFirst({
    where: { toolId, ...holderWhere(holderType, holderId) },
  })

  if (!current || current.quantity < quantity) {
    throw new Error(`Ese responsable no tiene suficiente cantidad asignada para devolver.`)
  }

  const nextQuantity = current.quantity - quantity
  if (nextQuantity <= 0) {
    await tx.toolAssignments.delete({ where: { id: current.id } })
    return null
  }

  return tx.toolAssignments.update({
    where: { id: current.id },
    data: { quantity: nextQuantity },
  })
}

export async function resolveQuantityReturnSource(
  tx: ToolAssignmentTx,
  toolId: string,
  quantity: number,
  holderType?: string,
  holderId?: string
) {
  if (holderType && holderId) {
    if (!['contractor', 'installer'].includes(holderType)) {
      throw new Error('Responsable invalido.')
    }
    const assignment = await tx.toolAssignments.findFirst({
      where: { toolId, ...holderWhere(holderType as ToolHolderType, holderId) },
    })
    if (!assignment || assignment.quantity < quantity) {
      throw new Error('Ese responsable no tiene suficiente cantidad asignada.')
    }
    return { holderType: holderType as ToolHolderType, holderId }
  }

  const assignments = await tx.toolAssignments.findMany({
    where: { toolId, quantity: { gt: 0 } },
  })

  if (assignments.length === 1 && assignments[0].quantity >= quantity) {
    const assignment = assignments[0]
    return {
      holderType: assignment.holderType as ToolHolderType,
      holderId: assignment.holderType === 'contractor' ? assignment.contractorId : assignment.installerId,
    }
  }

  throw new Error('Selecciona de que responsable se esta devolviendo esta herramienta.')
}

export async function syncQuantityToolLocation(tx: ToolAssignmentTx, toolId: string, fallbackShelfId?: string | null) {
  const tool = await tx.inventoryTools.findUnique({ where: { id: toolId } })
  if (!tool) return null

  const assignments = await tx.toolAssignments.findMany({
    where: { toolId, quantity: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
  })
  const assignedQuantity = assignments.reduce((sum, assignment) => sum + assignment.quantity, 0)
  const availableQuantity = Math.max(0, (tool.totalQuantity || 0) - assignedQuantity)
  const status = assignedQuantity > 0 && availableQuantity > 0 ? 'partial' : assignedQuantity > 0 ? 'assigned' : 'available'

  let currentLocationType = 'warehouse'
  let currentShelfId = availableQuantity > 0 ? fallbackShelfId || tool.currentShelfId : null
  let currentContractorId: string | null = null
  let currentInstallerId: string | null = null

  if (assignments.length === 1 && availableQuantity === 0) {
    currentLocationType = assignments[0].holderType
    currentContractorId = assignments[0].contractorId
    currentInstallerId = assignments[0].installerId
  } else if (assignments.length > 0) {
    currentLocationType = 'split'
  }

  return tx.inventoryTools.update({
    where: { id: toolId },
    data: {
      availableQuantity,
      assignedQuantity,
      status,
      currentLocationType,
      currentShelfId,
      currentContractorId,
      currentInstallerId,
    },
  })
}
