import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { rackId, orderedShelfIds } = body as {
      rackId?: string
      orderedShelfIds?: string[]
    }

    if (!rackId || !Array.isArray(orderedShelfIds) || orderedShelfIds.length === 0) {
      return NextResponse.json(
        { error: 'rackId and orderedShelfIds are required' },
        { status: 400 }
      )
    }

    const shelves = await db.shelves.findMany({
      where: { rackId },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    if (shelves.length !== orderedShelfIds.length) {
      return NextResponse.json({ error: 'Shelf count does not match' }, { status: 400 })
    }

    const currentIds = new Set(shelves.map((shelf) => shelf.id))
    const incomingIds = new Set(orderedShelfIds)

    if (currentIds.size !== incomingIds.size || orderedShelfIds.some((id) => !currentIds.has(id))) {
      return NextResponse.json({ error: 'Invalid shelf order payload' }, { status: 400 })
    }

    await db.$transaction(
      orderedShelfIds.map((id, index) =>
        db.shelves.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shelf reorder error:', error)
    return NextResponse.json({ error: 'Failed to reorder shelves' }, { status: 500 })
  }
}
