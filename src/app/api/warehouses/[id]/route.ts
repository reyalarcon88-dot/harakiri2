import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, location, description } = body

    const existing = await db.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    const warehouse = await db.warehouse.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(location !== undefined && { location }),
        ...(description !== undefined && { description }),
      },
    })

    return NextResponse.json(warehouse)
  } catch (error) {
    console.error('Warehouse update error:', error)
    return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    await db.warehouse.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Warehouse delete error:', error)
    return NextResponse.json({ error: 'Failed to delete warehouse' }, { status: 500 })
  }
}
