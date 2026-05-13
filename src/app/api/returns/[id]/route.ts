import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'El status es obligatorio' }, { status: 400 })
    }

    // Get existing return
    const existing = await db.returns.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Devolucion no encontrada' }, { status: 404 })
    }

    // If pending → completed: items go to Recepción
    if (existing.status === 'pending' && status === 'completed') {
      const result = await db.$transaction(async (tx) => {
        for (const item of existing.items) {
          await tx.products.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          })

          await tx.recepcionItem.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              returnId: id,
            },
          })
        }

        return tx.returns.update({
          where: { id },
          data: { status },
          include: {
            items: {
              include: {
                product: true,
                shelf: {
                  include: {
                    rack: { include: { warehouse: true } },
                  },
                },
              },
            },
          },
        })
      })

      return NextResponse.json(result)
    }

    // Simple status update for other transitions
    const updated = await db.returns.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
            shelf: {
              include: {
                rack: { include: { warehouse: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error al actualizar devolucion:', error)
    return NextResponse.json({ error: 'Error al actualizar devolucion' }, { status: 500 })
  }
}
