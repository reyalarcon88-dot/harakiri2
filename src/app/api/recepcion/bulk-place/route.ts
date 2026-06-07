import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getConversionFactor, packagesToBase } from '@/lib/stock-units'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = body as {
      items?: { id: string; shelfId: string; quantity: number }[]
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No hay items para acomodar' }, { status: 400 })
    }

    for (const it of items) {
      if (!it.id || !it.shelfId || !it.quantity || it.quantity <= 0) {
        return NextResponse.json(
          { error: 'Cada item requiere id, shelfId y quantity > 0' },
          { status: 400 }
        )
      }
    }

    await db.$transaction(async (tx) => {
      for (const it of items) {
        const recep = await tx.recepcionItem.findUnique({
          where: { id: it.id },
          include: { product: { select: { unitOfMeasure: true, unitQuantity: true } } },
        })
        if (!recep) {
          throw new Error(`Item de recepción no encontrado: ${it.id}`)
        }
        if (it.quantity > Number(recep.quantity)) {
          throw new Error(
            `Cantidad ${it.quantity} supera lo disponible (${recep.quantity}) para el producto`
          )
        }

        const factor = getConversionFactor(recep.product)
        const baseDelta = packagesToBase(Number(it.quantity), factor)

        await tx.productShelfStock.upsert({
          where: {
            productId_shelfId: { productId: recep.productId, shelfId: it.shelfId },
          },
          create: {
            productId: recep.productId,
            shelfId: it.shelfId,
            quantity: it.quantity,
            baseQuantity: baseDelta,
          },
          update: {
            quantity: { increment: it.quantity },
            baseQuantity: { increment: baseDelta },
          },
        })

        const remaining = Number(recep.quantity) - Number(it.quantity)
        if (remaining === 0) {
          await tx.recepcionItem.delete({ where: { id: it.id } })
        } else {
          await tx.recepcionItem.update({
            where: { id: it.id },
            data: { quantity: remaining, baseQuantity: packagesToBase(remaining, factor) },
          })
        }
      }
    })

    return NextResponse.json({ success: true, count: items.length })
  } catch (error) {
    console.error('Error al acomodar en lote:', error)
    const msg = error instanceof Error ? error.message : 'Error al acomodar en lote'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
