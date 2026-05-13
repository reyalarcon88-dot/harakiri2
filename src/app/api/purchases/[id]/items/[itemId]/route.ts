import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { syncProjectMaterialFromPurchase } from '@/lib/server/project-purchase-materials'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const { productId, quantity, unitPrice, shelfId, priceSource, notes } = await request.json()

    if (quantity !== undefined && quantity < 0) {
      return NextResponse.json({ error: 'quantity must be greater than or equal to 0' }, { status: 400 })
    }

    const item = await db.$transaction(async (tx) => {
      const updated = await tx.purchaseItems.update({
        where: { id: itemId, purchaseId: id },
        data: {
          productId: productId || undefined,
          quantity: quantity !== undefined ? quantity : undefined,
          unitPrice: unitPrice !== undefined ? unitPrice : undefined,
          shelfId: shelfId !== undefined ? shelfId : undefined,
          priceSource: priceSource || undefined,
          notes: notes !== undefined ? String(notes || '').trim() : undefined,
        },
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
      })

      const purchase = await tx.purchases.findUnique({
        where: { id },
        select: { projectId: true },
      })
      if (purchase?.projectId) {
        await syncProjectMaterialFromPurchase(
          tx,
          purchase.projectId,
          updated.productId,
          updated.quantity
        )
      }

      return updated
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating purchase item:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    await db.purchaseItems.delete({ where: { id: itemId, purchaseId: id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting purchase item:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
