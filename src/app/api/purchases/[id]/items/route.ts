import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { syncProjectMaterialFromPurchase } from '@/lib/server/project-purchase-materials'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { productId, quantity, unitPrice = 0, shelfId = null, priceSource = 'reference', notes = '' } = await request.json()

    if (!productId || quantity === undefined || quantity === null || quantity < 0) {
      return NextResponse.json({ error: 'productId and quantity >= 0 are required' }, { status: 400 })
    }

    const item = await db.$transaction(async (tx) => {
      const created = await tx.purchaseItems.create({
        data: {
          purchaseId: id,
          productId,
          quantity,
          unitPrice,
          shelfId,
          priceSource,
          notes: String(notes || '').trim(),
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
        await syncProjectMaterialFromPurchase(tx, purchase.projectId, productId, quantity)
      }

      return created
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error adding purchase item:', error)
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }
}
