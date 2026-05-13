import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function GET() {
  try {
    const warehouses = await db.warehouse.findMany({
      include: {
        racks: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { name: 'asc' }],
          include: {
            shelves: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { name: 'asc' }],
              include: {
                productStocks: {
                  include: {
                    product: {
                      select: { id: true, name: true, code: true, family: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(warehouses)
  } catch (error) {
    console.error('GET /api/warehouses error:', error)
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    const location = String(body?.location ?? '').trim()
    const description = String(body?.description ?? '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Warehouse name is required' }, { status: 400 })
    }

    const warehouse = await db.warehouse.create({
      data: {
        name,
        location,
        description,
      },
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    console.error('POST /api/warehouses error:', error)
    return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 })
  }
}
