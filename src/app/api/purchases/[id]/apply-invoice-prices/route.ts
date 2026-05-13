import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { items } = body as { items: { purchaseItemId: string; unitPrice: number }[] }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un ítem' }, { status: 400 })
    }

    const purchase = await db.purchases.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!purchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    if (purchase.status === 'cancelled') {
      return NextResponse.json({ error: 'No se puede modificar una compra cancelada' }, { status: 409 })
    }

    await db.$transaction(
      items.map(({ purchaseItemId, unitPrice }) =>
        db.purchaseItems.update({
          where: { id: purchaseItemId },
          data: { unitPrice, priceSource: 'invoice' },
        })
      )
    )

    return NextResponse.json({ updated: items.length })
  } catch (error) {
    console.error('Error applying invoice prices:', error)
    return NextResponse.json({ error: 'Error al aplicar precios de factura' }, { status: 500 })
  }
}
