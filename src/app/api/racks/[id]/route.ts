import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

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
