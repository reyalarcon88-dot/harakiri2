import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const avgPrices = await db.purchaseItems.groupBy({
      by: ['productId'],
      where: { unitPrice: { gt: 0 } },
      _avg: { unitPrice: true },
      _sum: { quantity: true },
    })

    const result = await Promise.all(
      avgPrices.map(async (item) => {
        const product = await db.products.findUnique({
          where: { id: item.productId },
          select: { id: true, code: true, name: true },
        })
        return {
          productId: item.productId,
          avgPrice: item._avg.unitPrice || 0,
          totalQuantity: item._sum.quantity || 0,
          product,
        }
      })
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al obtener precios promedio:', error)
    return NextResponse.json({ error: 'Error al obtener precios promedio' }, { status: 500 })
  }
}
