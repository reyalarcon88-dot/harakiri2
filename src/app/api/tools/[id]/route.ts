import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const includeToolDetail = {
  currentShelf: { include: { rack: { include: { warehouse: true } } } },
  currentContractor: true,
  currentInstaller: true,
  assignments: { include: { contractor: true, installer: true }, orderBy: { updatedAt: 'desc' as const } },
  kitItems: { include: { kit: true } },
  movements: {
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
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tool = await db.inventoryTools.findUnique({
      where: { id },
      include: includeToolDetail,
    })

    if (!tool) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 })
    }

    return NextResponse.json(tool)
  } catch (error) {
    console.error('GET /api/tools/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch tool' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, serial, category, name, brand, model, condition, notes, trackingType, totalQuantity } = body

    if (code !== undefined && !String(code).trim()) {
      return NextResponse.json({ error: 'El codigo interno es obligatorio' }, { status: 400 })
    }
    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }
    if (category !== undefined && !String(category).trim()) {
      return NextResponse.json({ error: 'La categoria es obligatoria' }, { status: 400 })
    }

    const existing = await db.inventoryTools.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 })
    }

    const nextTrackingType = trackingType === 'quantity' ? 'quantity' : trackingType === 'serialized' ? 'serialized' : existing.trackingType
    const requestedTotalQuantity = totalQuantity !== undefined ? Math.max(1, Number(totalQuantity) || 1) : existing.totalQuantity
    const assignedQuantity = existing.assignedQuantity || 0
    if (nextTrackingType === 'serialized' && assignedQuantity > 1) {
      return NextResponse.json({ error: 'No se puede convertir a serializada mientras tenga mas de 1 unidad asignada.' }, { status: 400 })
    }
    if (requestedTotalQuantity < assignedQuantity) {
      return NextResponse.json({ error: 'La cantidad total no puede ser menor que la cantidad asignada.' }, { status: 400 })
    }

    const nextTotalQuantity = nextTrackingType === 'serialized' ? 1 : requestedTotalQuantity
    const nextAvailableQuantity = Math.max(0, nextTotalQuantity - assignedQuantity)

    const tool = await db.inventoryTools.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: String(code).trim() }),
        ...(serial !== undefined && { serial: String(serial || '').trim() }),
        ...(category !== undefined && { category: String(category).trim() }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(brand !== undefined && { brand: String(brand || '').trim() }),
        ...(model !== undefined && { model: String(model || '').trim() }),
        ...(trackingType !== undefined && { trackingType: nextTrackingType }),
        ...(trackingType !== undefined || totalQuantity !== undefined
          ? {
              totalQuantity: nextTotalQuantity,
              availableQuantity: nextAvailableQuantity,
              status: assignedQuantity > 0 && nextAvailableQuantity > 0 ? 'partial' : assignedQuantity > 0 ? 'assigned' : 'available',
            }
          : {}),
        ...(condition !== undefined && { condition: String(condition || 'good') }),
        ...(notes !== undefined && { notes: String(notes || '').trim() }),
      },
      include: includeToolDetail,
    })

    return NextResponse.json(tool)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update tool'
    console.error('PUT /api/tools/[id] error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const existing = await db.inventoryTools.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 })
    }

    await db.inventoryTools.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete tool'
    console.error('DELETE /api/tools/[id] error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
