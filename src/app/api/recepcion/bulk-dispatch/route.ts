import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertProjectDispatchWithinPlan,
  incrementProjectDispatchQuantities,
  ProjectDispatchValidationError,
} from '@/lib/server/project-dispatch'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, items, notes } = body as {
      projectId?: string
      items?: { id: string; quantity: number }[]
      notes?: string
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Debe seleccionar un proyecto' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No hay items para despachar' }, { status: 400 })
    }
    for (const it of items) {
      if (!it.id || !it.quantity || it.quantity <= 0) {
        return NextResponse.json(
          { error: 'Cada item requiere id y quantity > 0' },
          { status: 400 }
        )
      }
    }

    const project = await db.projects.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      const recepcionItems = await Promise.all(
        items.map(async (item) => {
          const recep = await tx.recepcionItem.findUnique({ where: { id: item.id } })
          if (!recep) {
            throw new ProjectDispatchValidationError(`Item de recepcion no encontrado: ${item.id}`)
          }
          const availableQuantity = Number(recep.quantity)
          if (item.quantity > availableQuantity) {
            throw new ProjectDispatchValidationError(
              `Cantidad ${item.quantity} supera lo disponible (${availableQuantity})`
            )
          }

          return {
            id: item.id,
            productId: recep.productId,
            availableQuantity,
            quantity: item.quantity,
          }
        })
      )

      const projectItems = recepcionItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))

      await assertProjectDispatchWithinPlan(tx, projectId, projectItems)

      const dispatch = await tx.dispatches.create({
        data: {
          projectId,
          dispatchDate: new Date().toISOString().split('T')[0],
          notes: notes || 'Despacho en lote desde Recepcion',
        },
      })

      for (const item of recepcionItems) {
        await tx.dispatchItems.create({
          data: {
            dispatchId: dispatch.id,
            productId: item.productId,
            shelfId: null,
            quantity: item.quantity,
          },
        })

        await tx.products.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        })

        const remaining = item.availableQuantity - item.quantity
        if (remaining === 0) {
          await tx.recepcionItem.delete({ where: { id: item.id } })
        } else {
          await tx.recepcionItem.update({
            where: { id: item.id },
            data: { quantity: remaining },
          })
        }
      }

      await incrementProjectDispatchQuantities(tx, projectId, projectItems)

      if (project.status !== 'finished' && project.status !== 'cancelled' && project.status !== 'dispatched') {
        await tx.projects.update({ where: { id: projectId }, data: { status: 'dispatched' } })
      }

      return { dispatchId: dispatch.id, count: items.length }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al despachar en lote:', error)
    const msg = error instanceof Error ? error.message : 'Error al despachar en lote'
    const status = error instanceof ProjectDispatchValidationError ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
