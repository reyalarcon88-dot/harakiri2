import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertProjectDispatchWithinPlan,
  incrementProjectDispatchQuantities,
  ProjectDispatchValidationError,
} from '@/lib/server/project-dispatch'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { projectId, quantity, notes } = body as {
      projectId?: string
      quantity?: number
      notes?: string
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Debe seleccionar un proyecto' }, { status: 400 })
    }

    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      return NextResponse.json({ error: 'Cantidad invalida' }, { status: 400 })
    }

    const recep = await db.recepcionItem.findUnique({ where: { id } })
    if (!recep) {
      return NextResponse.json({ error: 'Item de recepcion no encontrado' }, { status: 404 })
    }
    const availableQuantity = Number(recep.quantity)
    if (qty > availableQuantity) {
      return NextResponse.json(
        { error: `Cantidad maxima disponible: ${availableQuantity}` },
        { status: 400 }
      )
    }

    const project = await db.projects.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      const projectItems = [{ productId: recep.productId, quantity: qty }]
      await assertProjectDispatchWithinPlan(tx, projectId, projectItems)

      const dispatch = await tx.dispatches.create({
        data: {
          projectId,
          dispatchDate: new Date().toISOString().split('T')[0],
          notes: notes || 'Despacho directo desde Recepcion',
        },
      })

      await tx.dispatchItems.create({
        data: {
          dispatchId: dispatch.id,
          productId: recep.productId,
          shelfId: null,
          quantity: qty,
        },
      })

      await tx.products.update({
        where: { id: recep.productId },
        data: { currentStock: { decrement: qty } },
      })

      const remaining = availableQuantity - qty
      if (remaining === 0) {
        await tx.recepcionItem.delete({ where: { id } })
      } else {
        await tx.recepcionItem.update({
          where: { id },
          data: { quantity: remaining },
        })
      }

      await incrementProjectDispatchQuantities(tx, projectId, projectItems)

      if (project.status !== 'finished' && project.status !== 'cancelled' && project.status !== 'dispatched') {
        await tx.projects.update({ where: { id: projectId }, data: { status: 'dispatched' } })
      }

      return { dispatchId: dispatch.id, remaining }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al despachar desde recepcion:', error)
    if (error instanceof ProjectDispatchValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al despachar' }, { status: 500 })
  }
}
