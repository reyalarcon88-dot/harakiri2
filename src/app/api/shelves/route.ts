import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    const shelves = await db.shelves.findMany({
      include: {
        rack: { include: { warehouse: true } },
        productStocks: productId
          ? {
              where: { productId },
              select: { quantity: true },
            }
          : false,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { name: 'asc' }],
    })

    const shelvesWithStock = shelves.map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      description: shelf.description,
      rackId: shelf.rackId,
      rack: shelf.rack,
      createdAt: shelf.createdAt,
      _stock: productId && shelf.productStocks ? shelf.productStocks[0]?.quantity || 0 : undefined,
    }))

    return NextResponse.json(shelvesWithStock)
  } catch (error) {
    console.error('Shelf list error:', error)
    return NextResponse.json({ error: 'Failed to list shelves' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rackId, name, description } = body

    if (!rackId || !name) {
      return NextResponse.json({ error: 'Rack ID and name are required' }, { status: 400 })
    }

    const rack = await db.racks.findUnique({ where: { id: rackId } })
    if (!rack) {
      return NextResponse.json({ error: 'Rack not found' }, { status: 404 })
    }

    const lastShelf = await db.shelves.findFirst({
      where: { rackId },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      select: { sortOrder: true },
    })

    const shelf = await db.shelves.create({
      data: {
        rackId,
        name,
        description: description ?? '',
        sortOrder: (lastShelf?.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json(shelf, { status: 201 })
  } catch (error) {
    console.error('Shelf create error:', error)
    return NextResponse.json({ error: 'Failed to create shelf' }, { status: 500 })
  }
}

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
