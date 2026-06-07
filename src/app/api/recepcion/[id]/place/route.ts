import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getConversionFactor, packagesToBase } from '@/lib/stock-units'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { shelfId, quantity } = body

    if (!shelfId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'shelfId y quantity son obligatorios' },
        { status: 400 }
      )
    }

    const recepcionItem = await db.recepcionItem.findUnique({
      where: { id },
      include: { product: { select: { unitOfMeasure: true, unitQuantity: true } } },
    })

    if (!recepcionItem) {
      return NextResponse.json({ error: 'Item no encontrado en recepción' }, { status: 404 })
    }

    if (quantity > Number(recepcionItem.quantity)) {
      return NextResponse.json(
        { error: 'La cantidad supera lo disponible en recepción' },
        { status: 400 }
      )
    }

    const factor = getConversionFactor(recepcionItem.product)
    const baseDelta = packagesToBase(Number(quantity), factor)

    await db.$transaction(async (tx) => {
      await tx.productShelfStock.upsert({
        where: {
          productId_shelfId: {
            productId: recepcionItem.productId,
            shelfId,
          },
        },
        create: {
          productId: recepcionItem.productId,
          shelfId,
          quantity,
          baseQuantity: baseDelta,
        },
        update: {
          quantity: { increment: quantity },
          baseQuantity: { increment: baseDelta },
        },
      })

      const remaining = Number(recepcionItem.quantity) - Number(quantity)
      if (remaining === 0) {
        await tx.recepcionItem.delete({ where: { id } })
      } else {
        const remainingBase = packagesToBase(remaining, factor)
        await tx.recepcionItem.update({
          where: { id },
          data: { quantity: remaining, baseQuantity: remainingBase },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al acomodar item:', error)
    return NextResponse.json({ error: 'Error al acomodar item' }, { status: 500 })
  }
}
