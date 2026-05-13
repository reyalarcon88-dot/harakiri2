import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await db.$transaction(async (tx) => {
      // Get the project with dispatches and items
      const project = await tx.projects.findUnique({
        where: { id },
        include: {
          materials: true,
          dispatches: {
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
      })

      if (!project) {
        throw new Error('Proyecto no encontrado')
      }

      // 1. Collect all dispatched items and consolidate by product
      const productQuantities = new Map<string, number>()
      for (const dispatch of project.dispatches) {
        for (const item of dispatch.items) {
          const current = productQuantities.get(item.productId) || 0
          productQuantities.set(item.productId, current + item.quantity)
        }
      }

      // 2. Create a return order in 'pending' status (consolidated by product, no shelfId)
      const returnOrder = await tx.returns.create({
        data: {
          projectId: id,
          returnDate: new Date().toISOString().split('T')[0],
          notes: 'Devolucion automatica por cancelacion de proyecto',
          status: 'pending',
          items: {
            create: Array.from(productQuantities.entries()).map(
              ([productId, quantity]) => ({
                productId,
                shelfId: null,
                quantity,
              })
            ),
          },
        },
        include: {
          items: { include: { product: true } },
        },
      })

      // 3. Cancel all purchase orders with status 'pedido' for this project
      // (purchases are not directly linked to projects in schema, skip this step)

      // 4. Reset dispatchedQuantity on project materials to 0
      for (const material of project.materials) {
        await tx.projectMaterials.update({
          where: { id: material.id },
          data: { dispatchedQuantity: 0 },
        })
      }

      // 5. Update project status to 'cancelled'
      const updatedProject = await tx.projects.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          client: true,
          contractor: true,
          materials: { include: { product: true } },
        },
      })

      return {
        project: updatedProject,
        returnOrder,
        cancelledPurchases: [],
      }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al cancelar proyecto'
    console.error('Error al cancelar proyecto:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
