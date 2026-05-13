import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { runPurchaseOrderAutomation } from '@/lib/server/purchase-order-automation'

class PurchaseStatusValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PurchaseStatusValidationError'
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status } = await request.json()

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const updated = await db.$transaction(async (tx) => {
      const purchase = await tx.purchases.findUnique({
        where: { id },
        include: {
          items: true,
        },
      })

      if (!purchase) {
        return null
      }

      if (purchase.status === 'received' && status !== 'received') {
        throw new PurchaseStatusValidationError(
          'No se puede cambiar el estado de una compra recibida'
        )
      }

      if (purchase.status === 'cancelled' && status !== 'cancelled') {
        throw new PurchaseStatusValidationError(
          'No se puede cambiar el estado de una compra cancelada'
        )
      }

      if (status === 'received' && purchase.status !== 'received') {
        const transition = await tx.purchases.updateMany({
          where: {
            id,
            status: purchase.status,
          },
          data: { status },
        })

        if (transition.count === 0) {
          const latest = await tx.purchases.findUnique({
            where: { id },
            select: { status: true },
          })

          if (!latest) {
            return null
          }

          if (latest.status !== 'received') {
            throw new PurchaseStatusValidationError(
              'No se pudo confirmar la recepcion de la compra. Intente de nuevo.'
            )
          }
        } else {
          for (const item of purchase.items) {
            if (item.quantity <= 0) continue

            await tx.products.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.quantity } },
            })
            await tx.recepcionItem.create({
              data: {
                productId: item.productId,
                quantity: item.quantity,
                purchaseId: id,
              },
            })
          }
        }
      } else if (purchase.status !== status) {
        await tx.purchases.update({
          where: { id },
          data: { status },
        })
      }

      return tx.purchases.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
              shelf: {
                select: {
                  id: true,
                  name: true,
                  rack: { select: { name: true, warehouse: { select: { name: true } } } },
                },
              },
            },
          },
          documents: true,
        },
      })
    })

    if (!updated) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    let automation = null
    if (updated.status === 'pedido') {
      const origin = new URL(request.url).origin
      automation = await runPurchaseOrderAutomation(updated.id, origin)
    }

    return NextResponse.json({ ...updated, automation })
  } catch (error) {
    console.error('Error updating purchase status:', error)
    if (error instanceof PurchaseStatusValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
