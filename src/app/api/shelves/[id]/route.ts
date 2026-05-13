import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description } = body

    const existing = await db.shelves.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
    }

    const shelf = await db.shelves.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    })

    return NextResponse.json(shelf)
  } catch (error) {
    console.error('Shelf update error:', error)
    return NextResponse.json({ error: 'Failed to update shelf' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.shelves.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
    }

    await db.shelves.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shelf delete error:', error)
    return NextResponse.json({ error: 'Failed to delete shelf' }, { status: 500 })
  }
}
