import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getConversionFactor, packagesToBase } from '@/lib/stock-units'
import { decrementProjectDispatchQuantities } from '@/lib/server/project-dispatch'

// Deshacer un despacho completo: borra el Dispatches y devuelve el stock a su
// origen. Lo que salió de un estante vuelve a ese estante; lo que salió de
// recepción (shelfId null) vuelve a recepción como un ítem pendiente de colocar.
// También baja el dispatchedQuantity del plan del proyecto. Deja todo como si el
// despacho nunca hubiera pasado.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; dispatchId: string }> }
) {
  try {
    const { id, dispatchId } = await params

    const dispatch = await db.dispatches.findUnique({
      where: { id: dispatchId },
      include: {
        items: {
          include: {
            product: { select: { unitOfMeasure: true, unitQuantity: true } },
          },
        },
      },
    })

    if (!dispatch || dispatch.projectId !== id) {
      return NextResponse.json({ error: 'Despacho no encontrado' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      const adjustments: { productId: string; quantity: number }[] = []

      for (const item of dispatch.items) {
        const quantity = Number(item.quantity)
        if (!(quantity > 0)) continue

        // Recalcular el base desde la cantidad (algunas rutas de creación dejan
        // baseQuantity en 0), para restaurar currentBaseStock/base de forma correcta.
        const factor = getConversionFactor(item.product)
        const baseDelta = packagesToBase(quantity, factor)

        await tx.products.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: quantity },
            currentBaseStock: { increment: baseDelta },
          },
        })

        if (item.shelfId) {
          // Salió de un estante → vuelve a ese estante.
          await tx.productShelfStock.upsert({
            where: {
              productId_shelfId: { productId: item.productId, shelfId: item.shelfId },
            },
            create: {
              productId: item.productId,
              shelfId: item.shelfId,
              quantity,
              baseQuantity: baseDelta,
            },
            update: {
              quantity: { increment: quantity },
              baseQuantity: { increment: baseDelta },
            },
          })
        } else {
          // Salió de recepción → vuelve a recepción como ítem pendiente de colocar.
          await tx.recepcionItem.create({
            data: {
              productId: item.productId,
              quantity,
              baseQuantity: baseDelta,
            },
          })
        }

        adjustments.push({ productId: item.productId, quantity })
      }

      // Revertir el dispatchedQuantity del plan (clamp ≥ 0).
      await decrementProjectDispatchQuantities(tx, id, adjustments)

      // Borrar el despacho; los DispatchItems caen por cascade.
      await tx.dispatches.delete({ where: { id: dispatchId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al deshacer despacho:', error)
    return NextResponse.json({ error: 'Error al deshacer el despacho' }, { status: 500 })
  }
}
