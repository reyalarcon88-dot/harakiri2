import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { warehouseId, orderedRackIds } = body as {
      warehouseId?: string
      orderedRackIds?: string[]
    }

    if (!warehouseId || !Array.isArray(orderedRackIds) || orderedRackIds.length === 0) {
      return NextResponse.json(
        { error: 'warehouseId and orderedRackIds are required' },
        { status: 400 }
      )
    }

    const racks = await db.racks.findMany({
      where: { warehouseId },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    if (racks.length !== orderedRackIds.length) {
      return NextResponse.json({ error: 'Rack count does not match' }, { status: 400 })
    }

    const currentIds = new Set(racks.map((rack) => rack.id))
    const incomingIds = new Set(orderedRackIds)

    if (currentIds.size !== incomingIds.size || orderedRackIds.some((id) => !currentIds.has(id))) {
      return NextResponse.json({ error: 'Invalid rack order payload' }, { status: 400 })
    }

    await db.$transaction(
      orderedRackIds.map((id, index) =>
        db.racks.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Rack reorder error:', error)
    return NextResponse.json({ error: 'Failed to reorder racks' }, { status: 500 })
  }
}
