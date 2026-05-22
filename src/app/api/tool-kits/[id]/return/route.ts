import { db } from '@/lib/db'
import { decrementToolAssignment, holderWhere, movementEndpoint, syncQuantityToolLocation, type ToolHolderType } from '@/lib/tool-assignments'
import { NextRequest, NextResponse } from 'next/server'
import { decorateKit, toolKitInclude } from '../../helpers'

type ReturnItemInput = {
  toolId?: string
  quantity?: number
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const fromType = String(body.fromType || '') as ToolHolderType
    const fromHolderId = fromType === 'contractor' ? String(body.fromContractorId || '') : String(body.fromInstallerId || '')
    const toShelfId = typeof body.toShelfId === 'string' && body.toShelfId.trim() ? String(body.toShelfId) : null
    const movementDate = String(body.movementDate || new Date().toISOString().split('T')[0])
    const notes = String(body.notes || '')
    const kitsToReturn = Math.max(1, Number(body.kits) || 1)
    const partialItems = Array.isArray(body.items) ? (body.items as ReturnItemInput[]) : []

    if (!['contractor', 'installer'].includes(fromType) || !fromHolderId) {
      return NextResponse.json({ error: 'Selecciona quien esta devolviendo el kit.' }, { status: 400 })
    }
    const kit = await db.toolKits.findUnique({
      where: { id },
      include: { items: { include: { tool: { include: { assignments: true } } } } },
    })

    if (!kit) return NextResponse.json({ error: 'Kit no encontrado' }, { status: 404 })
    if (kit.items.length === 0) return NextResponse.json({ error: 'El kit no tiene componentes.' }, { status: 400 })

    const plannedReturns =
      partialItems.length > 0
        ? partialItems
            .map((item) => ({
              toolId: String(item.toolId || ''),
              quantity: Math.max(0, Number(item.quantity) || 0),
            }))
            .filter((item) => item.toolId && item.quantity > 0)
        : kit.items.map((item) => ({
            toolId: item.toolId,
            quantity: Math.max(1, item.quantity || 1) * kitsToReturn,
          }))

    if (plannedReturns.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos una herramienta para devolver.' }, { status: 400 })
    }

    const kitToolIds = new Set(kit.items.map((item) => item.toolId))
    for (const item of plannedReturns) {
      if (!kitToolIds.has(item.toolId)) {
        return NextResponse.json({ error: 'Una herramienta no pertenece a este kit.' }, { status: 400 })
      }
      const kitItem = kit.items.find((candidate) => candidate.toolId === item.toolId)
      const assignment = kitItem?.tool.assignments.find((candidate) => {
        if (candidate.holderType !== fromType) return false
        return fromType === 'contractor' ? candidate.contractorId === fromHolderId : candidate.installerId === fromHolderId
      })
      if (!assignment || assignment.quantity < item.quantity) {
        return NextResponse.json(
          { error: `${kitItem?.tool.name || 'Herramienta'} no tiene cantidad suficiente asignada a ese responsable.` },
          { status: 400 }
        )
      }
    }

    let returnedCount = 0
    await db.$transaction(async (tx) => {
      for (const item of plannedReturns) {
        const kitItem = kit.items.find((candidate) => candidate.toolId === item.toolId)
        if (!kitItem) continue
        await tx.toolMovements.create({
          data: {
            toolId: item.toolId,
            movementType: 'return',
            movementDate,
            ...movementEndpoint(fromType, fromHolderId, 'from'),
            toType: 'warehouse',
            toShelfId,
            condition: kitItem.tool.condition,
            quantity: item.quantity,
            notes: notes || `Devolucion por kit ${kit.code}`,
          },
        })
        await decrementToolAssignment(tx, item.toolId, fromType, fromHolderId, item.quantity)
        await syncQuantityToolLocation(tx, item.toolId, toShelfId)
        returnedCount++
      }
    })

    const updatedKit = await db.toolKits.findUnique({
      where: { id },
      include: toolKitInclude,
    })

    return NextResponse.json({
      returnedCount,
      kit: updatedKit ? decorateKit(updatedKit) : null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to return tool kit'
    console.error('POST /api/tool-kits/[id]/return error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
