import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const recepcionItem = await db.recepcionItem.findUnique({ where: { id } })

    if (!recepcionItem) {
      return NextResponse.json({ error: 'Item no encontrado en recepción' }, { status: 404 })
    }

    if (quantity > recepcionItem.quantity) {
      return NextResponse.json(
        { error: 'La cantidad supera lo disponible en recepción' },
        { status: 400 }
      )
    }

    await db.$transaction(async (tx) => {
      // Move stock to the target shelf
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
        },
        update: {
          quantity: { increment: quantity },
        },
      })

      // Reduce or remove the recepcion item
      const remaining = recepcionItem.quantity - quantity
      if (remaining === 0) {
        await tx.recepcionItem.delete({ where: { id } })
      } else {
        await tx.recepcionItem.update({
          where: { id },
          data: { quantity: remaining },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al acomodar item:', error)
    return NextResponse.json({ error: 'Error al acomodar item' }, { status: 500 })
  }
}
