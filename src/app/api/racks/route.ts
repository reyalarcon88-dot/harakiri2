import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { warehouseId, name, description } = body

    if (!warehouseId || !name) {
      return NextResponse.json({ error: 'Warehouse ID and name are required' }, { status: 400 })
    }

    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    const lastRack = await db.racks.findFirst({
      where: { warehouseId },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      select: { sortOrder: true },
    })

    const rack = await db.racks.create({
      data: {
        warehouseId,
        name,
        description: description ?? '',
        sortOrder: (lastRack?.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json(rack, { status: 201 })
  } catch (error) {
    console.error('Rack create error:', error)
    return NextResponse.json({ error: 'Failed to create rack' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description } = body

    const existing = await db.racks.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rack not found' }, { status: 404 })
    }

    const rack = await db.racks.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    })

    return NextResponse.json(rack)
  } catch (error) {
    console.error('Rack update error:', error)
    return NextResponse.json({ error: 'Failed to update rack' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.racks.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rack not found' }, { status: 404 })
    }

    await db.racks.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Rack delete error:', error)
    return NextResponse.json({ error: 'Failed to delete rack' }, { status: 500 })
  }
}
