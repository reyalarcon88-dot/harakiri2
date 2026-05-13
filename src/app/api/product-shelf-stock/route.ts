import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const shelfId = searchParams.get('shelfId')

    if (!productId && !shelfId) {
      return NextResponse.json(
        { error: 'Se requiere productId o shelfId' },
        { status: 400 }
      )
    }

    const where: Record<string, string> = {}
    if (productId) where.productId = productId
    if (shelfId) where.shelfId = shelfId

    const stocks = await db.productShelfStock.findMany({
      where,
      include: {
        product: true,
        shelf: {
          include: {
            rack: { include: { warehouse: true } },
          },
        },
      },
    })

    return NextResponse.json(stocks)
  } catch (error) {
    console.error('Error al obtener stock:', error)
    return NextResponse.json({ error: 'Error al obtener stock' }, { status: 500 })
  }
}
