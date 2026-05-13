import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncProjectMaterialsFromPurchaseItems } from '@/lib/server/project-purchase-materials'

class PurchaseValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PurchaseValidationError'
  }
}

type SupplierReturnRow = {
  id: string
  quantity: number
  reason: string
  notes: string
  createdAt: string | Date
  productId: string
  productName: string
  productCode: string
}

async function loadSupplierReturns(client: {
  $queryRaw: typeof db.$queryRaw
}, purchaseId: string) {
  const rows = await client.$queryRaw<SupplierReturnRow[]>`
    SELECT
      sr.id AS id,
      sr.quantity AS quantity,
      sr.reason AS reason,
      sr.notes AS notes,
      sr.created_at AS createdAt,
      p.id AS productId,
      p.name AS productName,
      p.code AS productCode
    FROM supplier_returns sr
    INNER JOIN products p ON p.id = sr.product_id
    WHERE sr.purchase_id = ${purchaseId}
    ORDER BY sr.created_at DESC
  `

  return rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    reason: row.reason,
    notes: row.notes,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    product: {
      id: row.productId,
      name: row.productName,
      code: row.productCode,
    },
  }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const purchase = await db.purchases.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, referencePrice: true } },
            shelf: {
              include: {
                rack: { include: { warehouse: true } },
              },
            },
          },
        },
        documents: true,
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    const supplierReturns = await loadSupplierReturns(db, id)

    return NextResponse.json({ ...purchase, supplierReturns })
  } catch (error) {
    console.error('Error al obtener compra:', error)
    return NextResponse.json({ error: 'Error al obtener compra' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { supplierId, purchaseDate, notes, status, items, poNumber } = body

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.purchases.findUnique({
        where: { id },
        include: { items: true },
      })

      if (!existing) {
        return null
      }

      if (existing.status === 'received' && status !== undefined && status !== 'received') {
        throw new PurchaseValidationError(
          'No se puede cambiar el estado de una compra recibida'
        )
      }

      if (existing.status === 'cancelled' && status !== undefined && status !== 'cancelled') {
        throw new PurchaseValidationError(
          'No se puede cambiar el estado de una compra cancelada'
        )
      }

      const updateData: Record<string, unknown> = {
        ...(supplierId !== undefined && { supplierId }),
        ...(purchaseDate !== undefined && { purchaseDate }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        ...(poNumber !== undefined && { poNumber }),
      }

      const updateDataWithoutStatus: Record<string, unknown> = {
        ...(supplierId !== undefined && { supplierId }),
        ...(purchaseDate !== undefined && { purchaseDate }),
        ...(notes !== undefined && { notes }),
        ...(poNumber !== undefined && { poNumber }),
      }

      const isReceiving = status === 'received' && existing.status !== 'received'

      if (isReceiving) {
        const transition = await tx.purchases.updateMany({
          where: {
            id,
            status: existing.status,
          },
          data: updateData,
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
            throw new PurchaseValidationError(
              'No se pudo confirmar la recepcion de la compra. Intente de nuevo.'
            )
          }

          if (Object.keys(updateDataWithoutStatus).length > 0) {
            await tx.purchases.update({
              where: { id },
              data: updateDataWithoutStatus,
            })
          }
        } else {
          for (const item of existing.items) {
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
      } else if (Object.keys(updateData).length > 0) {
        await tx.purchases.update({
          where: { id },
          data: updateData,
        })
      }

      if (items && Array.isArray(items)) {
        if (existing.status === 'received' || status === 'received') {
          throw new PurchaseValidationError(
            'No se pueden modificar items de una compra recibida'
          )
        }

        if (items.some((item: { quantity?: number }) => item.quantity === undefined || item.quantity < 0)) {
          throw new PurchaseValidationError(
            'Cada item necesita una cantidad mayor o igual a 0'
          )
        }

        await tx.purchaseItems.deleteMany({ where: { purchaseId: id } })
        if (items.length > 0) {
          await tx.purchaseItems.createMany({
            data: items.map((item: { productId: string; shelfId?: string; quantity: number; unitPrice: number; priceSource?: string; notes?: string }) => ({
              purchaseId: id,
              productId: item.productId,
              shelfId: item.shelfId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice || 0,
              priceSource: item.priceSource || 'reference',
              notes: item.notes?.trim() || '',
            })),
          })
        }

        if (existing.projectId && items.length > 0) {
          await syncProjectMaterialsFromPurchaseItems(
            tx,
            existing.projectId,
            items as { productId: string; quantity: number }[]
          )
        }
      }

      return tx.purchases.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, code: true, referencePrice: true } },
              shelf: {
                include: {
                  rack: { include: { warehouse: true } },
                },
              },
            },
          },
          documents: true,
        },
      })
    })

    if (!result) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    const supplierReturns = await loadSupplierReturns(db, id)

    return NextResponse.json({ ...result, supplierReturns })
  } catch (error) {
    console.error('Error al actualizar compra:', error)
    if (error instanceof PurchaseValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al actualizar compra' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.purchases.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    // Reverse stock and recepcion items if status was "received"
    if (existing.status === 'received') {
      await db.$transaction(async (tx) => {
        const recepcionItems = await tx.recepcionItem.findMany({ where: { purchaseId: id } })
        for (const ri of recepcionItems) {
          await tx.products.update({
            where: { id: ri.productId },
            data: { currentStock: { decrement: ri.quantity } },
          })
        }
        await tx.recepcionItem.deleteMany({ where: { purchaseId: id } })
      })
    }

    await db.purchases.delete({ where: { id } })
    return NextResponse.json({ message: 'Compra eliminada correctamente' })
  } catch (error) {
    console.error('Error al eliminar compra:', error)
    return NextResponse.json({ error: 'Error al eliminar compra' }, { status: 500 })
  }
}
