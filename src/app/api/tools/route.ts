import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const toolInclude = {
  currentShelf: { include: { rack: { include: { warehouse: true } } } },
  currentContractor: true,
  currentInstaller: true,
  assignments: { include: { contractor: true, installer: true }, orderBy: { updatedAt: 'desc' as const } },
  kitItems: { include: { kit: true } },
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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''

    const tools = await db.inventoryTools.findMany({
      where: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(category && category !== 'all' ? { category } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search } },
                { serial: { contains: search } },
                { name: { contains: search } },
                { brand: { contains: search } },
                { model: { contains: search } },
                { category: { contains: search } },
              ],
            }
          : {}),
      },
      include: toolInclude,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(tools)
  } catch (error) {
    console.error('GET /api/tools error:', error)
    return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, serial, category, name, brand, model, condition, notes, currentShelfId, trackingType, totalQuantity } = body
    const normalizedTrackingType = trackingType === 'quantity' ? 'quantity' : 'serialized'
    const normalizedQuantity = normalizedTrackingType === 'quantity' ? Math.max(1, Number(totalQuantity) || 1) : 1

    if (!code || !name || !category) {
      return NextResponse.json({ error: 'Código, nombre y categoría son obligatorios' }, { status: 400 })
    }

    const tool = await db.inventoryTools.create({
      data: {
        code: String(code).trim(),
        serial: String(serial || '').trim(),
        category: String(category).trim(),
        name: String(name).trim(),
        brand: String(brand || '').trim(),
        model: String(model || '').trim(),
        trackingType: normalizedTrackingType,
        totalQuantity: normalizedQuantity,
        availableQuantity: normalizedQuantity,
        assignedQuantity: 0,
        condition: String(condition || 'good'),
        notes: String(notes || '').trim(),
        status: 'available',
        currentLocationType: currentShelfId ? 'warehouse' : 'warehouse',
        currentShelfId: currentShelfId || null,
      },
      include: toolInclude,
    })

    await db.toolMovements.create({
      data: {
        toolId: tool.id,
        movementType: 'created',
        movementDate: new Date().toISOString().split('T')[0],
        quantity: normalizedQuantity,
        toType: currentShelfId ? 'warehouse' : '',
        toShelfId: currentShelfId || null,
        condition: tool.condition,
        notes: 'Registro inicial de herramienta',
      },
    })

    return NextResponse.json(tool, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create tool'
    console.error('POST /api/tools error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
