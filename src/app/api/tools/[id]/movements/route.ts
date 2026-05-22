import { db } from '@/lib/db'
import {
  decrementToolAssignment,
  incrementToolAssignment,
  movementEndpoint,
  resolveQuantityReturnSource,
  syncQuantityToolLocation,
  type ToolHolderType,
} from '@/lib/tool-assignments'
import { NextRequest, NextResponse } from 'next/server'

function currentHolder(tool: {
  currentLocationType: string
  currentShelfId: string | null
  currentContractorId: string | null
  currentInstallerId: string | null
}) {
  return {
    fromType: tool.currentLocationType || '',
    fromShelfId: tool.currentShelfId,
    fromContractorId: tool.currentContractorId,
    fromInstallerId: tool.currentInstallerId,
  }
}

function targetFor(body: {
  toType?: string
  toShelfId?: string
  toContractorId?: string
  toInstallerId?: string
}) {
  const toType = String(body.toType || '')
  return {
    toType,
    toShelfId: toType === 'warehouse' ? body.toShelfId || null : null,
    toContractorId: toType === 'contractor' ? body.toContractorId || null : null,
    toInstallerId: toType === 'installer' ? body.toInstallerId || null : null,
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const movementType = String(body.movementType || '')
    const movementDate = String(body.movementDate || new Date().toISOString().split('T')[0])
    const condition = String(body.condition || '')
    const notes = String(body.notes || '')
    const quantity = Math.max(1, Number(body.quantity) || 1)

    const tool = await db.inventoryTools.findUnique({
      where: { id },
      include: { assignments: true },
    })
    if (!tool) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 })
    }

    let from = currentHolder(tool)
    let to = targetFor(body)
    let nextStatus = tool.status
    let nextLocationType = tool.currentLocationType
    let nextShelfId: string | null = tool.currentShelfId
    let nextContractorId: string | null = tool.currentContractorId
    let nextInstallerId: string | null = tool.currentInstallerId
    const isQuantityTool = tool.trackingType === 'quantity'

    if (movementType === 'issue') {
      if (!isQuantityTool && tool.status === 'assigned') {
        return NextResponse.json({ error: 'Esta herramienta ya está asignada. Usa Transferir o Devolver.' }, { status: 400 })
      }
      if (isQuantityTool && quantity > tool.availableQuantity) {
        return NextResponse.json({ error: `Solo hay ${tool.availableQuantity} disponible(s).` }, { status: 400 })
      }
      if (!['contractor', 'installer'].includes(to.toType) || (!to.toContractorId && !to.toInstallerId)) {
        return NextResponse.json({ error: 'Selecciona el contratista o instalador que recibe.' }, { status: 400 })
      }
      nextStatus = isQuantityTool && tool.availableQuantity - quantity > 0 ? 'partial' : 'assigned'
      nextLocationType = to.toType
      nextShelfId = null
      nextContractorId = to.toContractorId
      nextInstallerId = to.toInstallerId
    } else if (movementType === 'transfer') {
      if (!['assigned', 'partial'].includes(tool.status)) {
        return NextResponse.json({ error: 'Solo se puede transferir una herramienta asignada.' }, { status: 400 })
      }
      if (!['contractor', 'installer'].includes(to.toType) || (!to.toContractorId && !to.toInstallerId)) {
        return NextResponse.json({ error: 'Selecciona el nuevo responsable.' }, { status: 400 })
      }
      nextStatus = 'assigned'
      nextLocationType = to.toType
      nextShelfId = null
      nextContractorId = to.toContractorId
      nextInstallerId = to.toInstallerId
    } else if (movementType === 'return') {
      if (to.toType !== 'warehouse') {
        return NextResponse.json({ error: 'Selecciona el shelf de devolución.' }, { status: 400 })
      }
      if (isQuantityTool && quantity > tool.assignedQuantity) {
        return NextResponse.json({ error: `Solo hay ${tool.assignedQuantity} asignada(s) para devolver.` }, { status: 400 })
      }
      if (isQuantityTool) {
        const source = await resolveQuantityReturnSource(
          db,
          id,
          quantity,
          body.fromType ? String(body.fromType) : undefined,
          body.fromContractorId || body.fromInstallerId ? String(body.fromContractorId || body.fromInstallerId) : undefined
        )
        from = movementEndpoint(source.holderType, source.holderId, 'from') as ReturnType<typeof currentHolder>
      }
      nextStatus = isQuantityTool && tool.assignedQuantity - quantity > 0 ? 'partial' : 'available'
      nextLocationType = 'warehouse'
      nextShelfId = to.toShelfId
      nextContractorId = isQuantityTool && tool.assignedQuantity - quantity > 0 ? tool.currentContractorId : null
      nextInstallerId = isQuantityTool && tool.assignedQuantity - quantity > 0 ? tool.currentInstallerId : null
    } else if (movementType === 'status_change') {
      const requestedStatus = String(body.status || '')
      if (!['maintenance', 'damaged', 'lost', 'retired', 'available'].includes(requestedStatus)) {
        return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
      }
      if (requestedStatus === 'available' && tool.currentLocationType !== 'warehouse') {
        return NextResponse.json({ error: 'Para marcarla disponible, primero devuélvela al warehouse.' }, { status: 400 })
      }
      nextStatus = requestedStatus
      to = { toType: tool.currentLocationType || '', toShelfId: tool.currentShelfId, toContractorId: tool.currentContractorId, toInstallerId: tool.currentInstallerId }
    } else {
      return NextResponse.json({ error: 'Tipo de movimiento inválido.' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      const movement = await tx.toolMovements.create({
        data: {
          toolId: id,
          movementType,
          movementDate,
          quantity,
          ...from,
          ...to,
          condition: condition || tool.condition,
          notes,
        },
      })

      const updatedTool = await tx.inventoryTools.update({
        where: { id },
        data: {
          status: nextStatus,
          currentLocationType: nextLocationType,
          currentShelfId: nextShelfId,
          currentContractorId: nextContractorId,
          currentInstallerId: nextInstallerId,
          ...(isQuantityTool && movementType === 'issue'
            ? {
                availableQuantity: tool.availableQuantity - quantity,
                assignedQuantity: tool.assignedQuantity + quantity,
              }
            : {}),
          ...(isQuantityTool && movementType === 'return'
            ? {
                availableQuantity: tool.availableQuantity + quantity,
                assignedQuantity: tool.assignedQuantity - quantity,
              }
            : {}),
          ...(condition ? { condition } : {}),
        },
      })

      if (isQuantityTool && movementType === 'issue') {
        await incrementToolAssignment(tx, id, to.toType as ToolHolderType, String(to.toContractorId || to.toInstallerId), quantity)
        await syncQuantityToolLocation(tx, id, tool.currentShelfId)
      }

      if (isQuantityTool && movementType === 'transfer') {
        const source = await resolveQuantityReturnSource(
          tx,
          id,
          quantity,
          body.fromType ? String(body.fromType) : undefined,
          body.fromContractorId || body.fromInstallerId ? String(body.fromContractorId || body.fromInstallerId) : undefined
        )
        await decrementToolAssignment(tx, id, source.holderType, source.holderId, quantity)
        await incrementToolAssignment(tx, id, to.toType as ToolHolderType, String(to.toContractorId || to.toInstallerId), quantity)
        await syncQuantityToolLocation(tx, id, tool.currentShelfId)
      }

      if (isQuantityTool && movementType === 'return') {
        const source = await resolveQuantityReturnSource(
          tx,
          id,
          quantity,
          body.fromType ? String(body.fromType) : undefined,
          body.fromContractorId || body.fromInstallerId ? String(body.fromContractorId || body.fromInstallerId) : undefined
        )
        await decrementToolAssignment(tx, id, source.holderType, source.holderId, quantity)
        await syncQuantityToolLocation(tx, id, to.toShelfId)
      }

      return { movement, tool: updatedTool }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create movement'
    console.error('POST /api/tools/[id]/movements error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
