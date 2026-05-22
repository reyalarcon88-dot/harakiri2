import { db } from '@/lib/db'
import { incrementToolAssignment, syncQuantityToolLocation, type ToolHolderType } from '@/lib/tool-assignments'
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const toType = String(body.toType || '')
    const toContractorId = toType === 'contractor' ? String(body.toContractorId || '') : ''
    const toInstallerId = toType === 'installer' ? String(body.toInstallerId || '') : ''
    const movementDate = String(body.movementDate || new Date().toISOString().split('T')[0])
    const notes = String(body.notes || '')
    const kitsToIssue = Math.max(1, Number(body.kits) || 1)

    if (!['contractor', 'installer'].includes(toType) || (!toContractorId && !toInstallerId)) {
      return NextResponse.json({ error: 'Selecciona el contratista o instalador que recibe.' }, { status: 400 })
    }

    const kit = await db.toolKits.findUnique({
      where: { id },
      include: { items: { include: { tool: true } } },
    })

    if (!kit) return NextResponse.json({ error: 'Kit no encontrado' }, { status: 404 })
    if (kit.items.length === 0) {
      return NextResponse.json({ error: 'El kit no tiene componentes.' }, { status: 400 })
    }

    // Validate every component has enough available units to satisfy kitsToIssue.
    const shortfalls: { code: string; name: string; need: number; have: number }[] = []
    for (const item of kit.items) {
      const perKit = Math.max(1, item.quantity || 1)
      const need = perKit * kitsToIssue
      const have = item.tool.availableQuantity || 0
      if (have < need) shortfalls.push({ code: item.tool.code, name: item.tool.name, need, have })
    }
    if (shortfalls.length > 0) {
      return NextResponse.json(
        { error: `Inventario insuficiente para ${kitsToIssue} kit(s).`, shortfalls },
        { status: 400 }
      )
    }

    let movementCount = 0
    await db.$transaction(async (tx) => {
      for (const item of kit.items) {
        const tool = item.tool
        const perKit = Math.max(1, item.quantity || 1)
        const moveQty = perKit * kitsToIssue
        const nextAvailable = (tool.availableQuantity || 0) - moveQty
        const nextAssigned = (tool.assignedQuantity || 0) + moveQty
        const nextStatus = nextAvailable > 0 && nextAssigned > 0 ? 'partial' : nextAssigned > 0 ? 'assigned' : 'available'

        await tx.toolMovements.create({
          data: {
            toolId: tool.id,
            movementType: 'issue',
            movementDate,
            ...currentHolder(tool),
            toType,
            toContractorId: toContractorId || null,
            toInstallerId: toInstallerId || null,
            condition: tool.condition,
            quantity: moveQty,
            notes: notes || `Entrega por kit ${kit.code} (×${kitsToIssue})`,
          },
        })
        movementCount++

        if (tool.trackingType === 'quantity') {
          await incrementToolAssignment(tx, tool.id, toType as ToolHolderType, toContractorId || toInstallerId, moveQty)
          await syncQuantityToolLocation(tx, tool.id, tool.currentShelfId)
        } else {
          await tx.inventoryTools.update({
            where: { id: tool.id },
            data: {
              availableQuantity: nextAvailable,
              assignedQuantity: nextAssigned,
              status: nextStatus,
              currentLocationType: toType,
              currentShelfId: nextAvailable > 0 ? tool.currentShelfId : null,
              currentContractorId: toContractorId || null,
              currentInstallerId: toInstallerId || null,
            },
          })
        }
      }
    })

    return NextResponse.json({
      issuedCount: movementCount,
      kitsIssued: kitsToIssue,
      skippedCount: 0,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to issue tool kit'
    console.error('POST /api/tool-kits/[id]/issue error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
