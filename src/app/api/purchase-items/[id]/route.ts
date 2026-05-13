import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncProjectMaterialFromPurchase } from '@/lib/server/project-purchase-materials'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { quantity, unitPrice, shelfId, notes } = body

    if (quantity !== undefined && quantity < 0) {
      return NextResponse.json({ error: 'quantity must be greater than or equal to 0' }, { status: 400 })
    }

    // Get the purchase item with its parent purchase
    const item = await db.purchaseItems.findUnique({
      where: { id },
      include: { purchase: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    const result = await db.$transaction(async (tx) => {
      // If parent purchase was received, reverse old stock
      if (item.purchase.status === 'received') {
        await tx.products.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        })

        if (item.shelfId) {
          const stock = await tx.productShelfStock.findUnique({
            where: {
              productId_shelfId: {
                productId: item.productId,
                shelfId: item.shelfId,
              },
            },
          })
          if (stock) {
            const newQty = Math.max(0, stock.quantity - item.quantity)
            if (newQty === 0) {
              await tx.productShelfStock.delete({ where: { id: stock.id } })
            } else {
              await tx.productShelfStock.update({
                where: { id: stock.id },
                data: { quantity: newQty },
              })
            }
          }
        }
      }

      // Update the item
      const updated = await tx.purchaseItems.update({
        where: { id },
        data: {
          ...(quantity !== undefined && { quantity }),
          ...(unitPrice !== undefined && { unitPrice }),
          ...(shelfId !== undefined && { shelfId: shelfId || null }),
          ...(notes !== undefined && { notes: String(notes || '').trim() }),
        },
        include: {
          product: true,
          shelf: {
            include: {
              rack: { include: { warehouse: true } },
            },
          },
        },
      })

      if (item.purchase.projectId) {
        await syncProjectMaterialFromPurchase(
          tx,
          item.purchase.projectId,
          updated.productId,
          updated.quantity
        )
      }

      // If parent purchase was received, apply new stock
      if (item.purchase.status === 'received') {
        await tx.products.update({
          where: { id: updated.productId },
          data: { currentStock: { increment: updated.quantity } },
        })

        if (updated.shelfId) {
          await tx.productShelfStock.upsert({
            where: {
              productId_shelfId: {
                productId: updated.productId,
                shelfId: updated.shelfId,
              },
            },
            create: {
              productId: updated.productId,
              shelfId: updated.shelfId,
              quantity: updated.quantity,
            },
            update: {
              quantity: { increment: updated.quantity },
            },
          })
        }
      }

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al actualizar item:', error)
    return NextResponse.json({ error: 'Error al actualizar item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const item = await db.purchaseItems.findUnique({
      where: { id },
      include: { purchase: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    // Only reverse stock if parent purchase was "received"
    if (item.purchase.status === 'received') {
      await db.$transaction(async (tx) => {
        await tx.products.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        })

        if (item.shelfId) {
          const stock = await tx.productShelfStock.findUnique({
            where: {
              productId_shelfId: {
                productId: item.productId,
                shelfId: item.shelfId,
              },
            },
          })
          if (stock) {
            const newQty = Math.max(0, stock.quantity - item.quantity)
            if (newQty === 0) {
              await tx.productShelfStock.delete({ where: { id: stock.id } })
            } else {
              await tx.productShelfStock.update({
                where: { id: stock.id },
                data: { quantity: newQty },
              })
            }
          }
        }
      })
    }

    await db.purchaseItems.delete({ where: { id } })
    return NextResponse.json({ message: 'Item eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar item:', error)
    return NextResponse.json({ error: 'Error al eliminar item' }, { status: 500 })
  }
}
