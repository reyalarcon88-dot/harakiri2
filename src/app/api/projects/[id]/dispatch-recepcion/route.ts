import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertProjectDispatchWithinPlan,
  incrementProjectDispatchQuantities,
  ProjectDispatchValidationError,
} from '@/lib/server/project-dispatch'

async function getPendingMaterialQuantities(projectId: string, tx: typeof db = db) {
  const materials = await tx.projectMaterials.findMany({
    where: { projectId },
    select: {
      productId: true,
      plannedQuantity: true,
      dispatchedQuantity: true,
    },
  })

  const pendingByProductId = new Map<string, number>()
  for (const material of materials) {
    const pending = Math.max(Number(material.plannedQuantity) - Number(material.dispatchedQuantity), 0)
    if (pending > 0) {
      pendingByProductId.set(material.productId, (pendingByProductId.get(material.productId) || 0) + pending)
    }
  }

  return pendingByProductId
}

// Lists pending recepcion items that can cover this project's material list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const pendingByProductId = await getPendingMaterialQuantities(id)
    const productIds = [...pendingByProductId.keys()]

    if (productIds.length === 0) {
      return NextResponse.json([])
    }

    const items = await db.recepcionItem.findMany({
      where: {
        quantity: { gt: 0 },
        productId: { in: productIds },
      },
      include: {
        product: {
          select: { id: true, name: true, code: true, unitOfMeasure: true },
        },
        purchase: {
          select: { id: true, purchaseCode: true, poNumber: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const visibleItems = []
    const remainingByProductId = new Map(pendingByProductId)
    for (const item of items) {
      const remaining = remainingByProductId.get(item.productId) || 0
      if (remaining <= 0) continue

      const quantity = Math.min(Number(item.quantity), remaining)
      if (quantity <= 0) continue

      visibleItems.push({
        ...item,
        quantity,
      })
      remainingByProductId.set(item.productId, remaining - quantity)
    }

    return NextResponse.json(visibleItems)
  } catch (error) {
    console.error('Error al listar items de recepcion del proyecto:', error)
    return NextResponse.json({ error: 'Error al listar items' }, { status: 500 })
  }
}

// Dispatches recepcion items that match this project's pending material list
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await db.projects.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const result = await db.$transaction(async (tx) => {
      const pendingByProductId = await getPendingMaterialQuantities(id, tx)
      const productIds = [...pendingByProductId.keys()]

      if (productIds.length === 0) {
        throw new ProjectDispatchValidationError(
          'No hay materiales pendientes para despachar en este proyecto'
        )
      }

      const pending = await tx.recepcionItem.findMany({
        where: {
          quantity: { gt: 0 },
          productId: { in: productIds },
        },
        orderBy: { createdAt: 'asc' },
      })

      if (pending.length === 0) {
        throw new ProjectDispatchValidationError(
          'No hay items en recepcion que coincidan con los materiales pendientes del proyecto'
        )
      }

      const remainingByProductId = new Map(pendingByProductId)
      const dispatchRecepcionItems = []

      for (const recep of pending) {
        const remaining = remainingByProductId.get(recep.productId) || 0
        if (remaining <= 0) continue

        const quantity = Math.min(Number(recep.quantity), remaining)
        if (quantity <= 0) continue

        dispatchRecepcionItems.push({ recep, quantity })
        remainingByProductId.set(recep.productId, remaining - quantity)
      }

      if (dispatchRecepcionItems.length === 0) {
        throw new ProjectDispatchValidationError(
          'No hay cantidades disponibles en recepcion para cubrir este proyecto'
        )
      }

      const projectItems = dispatchRecepcionItems.map(({ recep, quantity }) => ({
        productId: recep.productId,
        quantity,
      }))

      await assertProjectDispatchWithinPlan(tx, id, projectItems)

      const dispatch = await tx.dispatches.create({
        data: {
          projectId: id,
          dispatchDate: new Date().toISOString().split('T')[0],
          notes: 'Despacho completo desde Recepcion',
        },
      })

      for (const { recep, quantity } of dispatchRecepcionItems) {
        await tx.dispatchItems.create({
          data: {
            dispatchId: dispatch.id,
            productId: recep.productId,
            shelfId: null,
            quantity,
          },
        })

        await tx.products.update({
          where: { id: recep.productId },
          data: { currentStock: { decrement: quantity } },
        })

        const remaining = Number(recep.quantity) - quantity
        if (remaining <= 0) {
          await tx.recepcionItem.delete({ where: { id: recep.id } })
        } else {
          await tx.recepcionItem.update({
            where: { id: recep.id },
            data: { quantity: remaining },
          })
        }
      }

      await incrementProjectDispatchQuantities(tx, id, projectItems)

      if (project.status !== 'finished' && project.status !== 'cancelled' && project.status !== 'dispatched') {
        await tx.projects.update({ where: { id }, data: { status: 'dispatched' } })
      }

      return { dispatchId: dispatch.id, count: dispatchRecepcionItems.length }
    }, { timeout: 30000 })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al despachar recepcion del proyecto:', error)
    if (error instanceof ProjectDispatchValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al despachar' }, { status: 500 })
  }
}
