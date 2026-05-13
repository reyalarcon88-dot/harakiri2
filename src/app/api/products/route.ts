import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, family, engineeringSection, color, unitOfMeasure, unitQuantity, minStock, currentStock, referencePrice, preferredShelfId } = body

    if (!code || !name) {
      return NextResponse.json({ error: 'El código y nombre son obligatorios' }, { status: 400 })
    }

    // Check for duplicate code
    const codeExists = await db.products.findUnique({ where: { code } })
    if (codeExists) {
      return NextResponse.json({ error: 'El código del producto ya existe' }, { status: 409 })
    }

    const product = await db.products.create({
      data: {
        code,
        name,
        family: family || '',
        engineeringSection: engineeringSection || '',
        color: color || '',
        unitOfMeasure: unitOfMeasure || 'unidad',
        unitQuantity: unitQuantity !== undefined ? String(unitQuantity) : '',
        minStock: minStock ?? 0,
        currentStock: currentStock ?? 0,
        referencePrice: referencePrice ?? 0,
        preferredShelfId: preferredShelfId ?? null,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const family = searchParams.get('family') || ''

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { family: { contains: search } },
        { engineeringSection: { contains: search } },
      ]
    }
    if (family) {
      where.family = family
    }

    const products = await db.products.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        shelfStocks: {
          include: {
            shelf: {
              include: {
                rack: {
                  include: { warehouse: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Augment shelfStocks with reserve fields (not in generated Prisma client yet)
    type ReserveRow = { id: string; reserve_quantity: string | number; is_reserve_shelf: number; reserve_minimum: string | number; reserve_notes: string }
    const reserveRows = await db.$queryRaw<ReserveRow[]>`SELECT id, reserve_quantity, is_reserve_shelf, reserve_minimum, reserve_notes FROM product_shelf_stock`
    const reserveMap = new Map(reserveRows.map((r) => [r.id, r]))

    const productsWithStock = products.map((p) => ({
      ...p,
      unitQuantity: p.unitQuantity ? parseInt(String(p.unitQuantity), 10) || 0 : 0,
      shelfStocks: p.shelfStocks.map((ss) => {
        const rv = reserveMap.get(ss.id)
        const reserveQuantity = Number(rv?.reserve_quantity || 0)
        const isReserveShelf = Boolean(rv?.is_reserve_shelf)
        return {
          ...ss,
          reserveQuantity,
          isReserveShelf,
          reserveMinimum: Number(rv?.reserve_minimum || 0),
          reserveNotes: String(rv?.reserve_notes || ''),
          availableQuantity: isReserveShelf ? 0 : Math.max(Number(ss.quantity) - reserveQuantity, 0),
        }
      }),
      _totalShelfStock: p.shelfStocks.reduce((sum, ss) => sum + Number(ss.quantity || 0), 0),
      _availableShelfStock: p.shelfStocks.reduce((sum, ss) => {
        const rv = reserveMap.get(ss.id)
        const reserveQty = Number(rv?.reserve_quantity || 0)
        const isReserveShelf = Boolean(rv?.is_reserve_shelf)
        return sum + (isReserveShelf ? 0 : Math.max(Number(ss.quantity) - reserveQty, 0))
      }, 0),
      _reservedShelfStock: p.shelfStocks.reduce((sum, ss) => {
        const rv = reserveMap.get(ss.id)
        const reserveQty = Number(rv?.reserve_quantity || 0)
        const isReserveShelf = Boolean(rv?.is_reserve_shelf)
        return sum + (isReserveShelf ? Number(ss.quantity) : reserveQty)
      }, 0),
    }))

    return NextResponse.json(productsWithStock)
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
