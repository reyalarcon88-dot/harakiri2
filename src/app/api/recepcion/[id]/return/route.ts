import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

class RecepcionReturnValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecepcionReturnValidationError'
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const qty = Number(body.quantity)
    const reason =
      typeof body.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim()
        : 'damaged'
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!qty || qty <= 0) {
      return NextResponse.json({ error: 'Cantidad invalida' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      const recepcionItem = await tx.recepcionItem.findUnique({
        where: { id },
      })

      if (!recepcionItem) {
        throw new RecepcionReturnValidationError('Item de recepcion no encontrado')
      }

      if (!recepcionItem.purchaseId) {
        throw new RecepcionReturnValidationError(
          'Solo se pueden devolver a proveedor items que vienen de una compra'
        )
      }

      if (qty > recepcionItem.quantity) {
        throw new RecepcionReturnValidationError(
          `Cantidad maxima disponible: ${recepcionItem.quantity}`
        )
      }

      await tx.products.update({
        where: { id: recepcionItem.productId },
        data: { currentStock: { decrement: qty } },
      })

      await tx.$executeRaw`
        INSERT INTO supplier_returns (
          id,
          purchase_id,
          product_id,
          quantity,
          reason,
          notes
        )
        VALUES (
          ${randomUUID()},
          ${recepcionItem.purchaseId},
          ${recepcionItem.productId},
          ${qty},
          ${reason},
          ${notes}
        )
      `

      const remaining = recepcionItem.quantity - qty
      if (remaining === 0) {
        await tx.recepcionItem.delete({ where: { id } })
      } else {
        await tx.recepcionItem.update({
          where: { id },
          data: { quantity: remaining },
        })
      }

      return { success: true, remaining }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al devolver item desde recepcion:', error)
    if (error instanceof RecepcionReturnValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al devolver item' }, { status: 500 })
  }
}
