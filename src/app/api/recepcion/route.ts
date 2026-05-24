import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const items = await db.recepcionItem.findMany({
      orderBy: [
        { purchase: { createdAt: 'desc' } },
        { return: { createdAt: 'desc' } },
        { createdAt: 'asc' },
      ],
      include: {
        product: {
          select: { id: true, name: true, code: true, unitOfMeasure: true, unitQuantity: true, preferredShelfId: true },
        },
        purchase: {
          select: {
            id: true,
            purchaseCode: true,
            poNumber: true,
            supplier: { select: { id: true, name: true } },
            project: { select: { id: true, name: true, poNumber: true } },
          },
        },
        return: {
          select: {
            id: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
    })))
  } catch (error) {
    console.error('Error al obtener items de recepción:', error)
    return NextResponse.json({ error: 'Error al obtener recepción' }, { status: 500 })
  }
}
