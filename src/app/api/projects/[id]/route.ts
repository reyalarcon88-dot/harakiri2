import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { autoArchiveInvoice } from '@/lib/project-invoice'
import { autoScheduleProject, runProjectAutomation } from '@/lib/project-automation'

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result.toISOString().split('T')[0]
}

// Generate automatic tasks for project status changes
async function generateAutomaticTasks(tx: Prisma.TransactionClient, projectId: string, newStatus: string, projectName: string) {
  const existingTasks = await tx.tasks.findMany({
    where: { projectId },
    select: { title: true }
  })
  const existingTitles = new Set(existingTasks.map(t => t.title))

  const tasksToCreate: Array<{
    title: string
    description: string
    dueDate?: string
    alarmDate?: string
    projectId: string
    status: string
  }> = []

  if (newStatus === 'in_progress') {
    // Check for materials that need ordering
    const materials = await tx.projectMaterials.findMany({
      where: { projectId },
      include: { product: true }
    })

    const lowStockMaterials = materials.filter(m =>
      m.product.currentStock < m.plannedQuantity
    )

    if (lowStockMaterials.length > 0 && !existingTitles.has(`Ordenar materiales para ${projectName}`)) {
      tasksToCreate.push({
        title: `Ordenar materiales para ${projectName}`,
        description: `Materiales con stock insuficiente: ${lowStockMaterials.map(m => `${m.product.name} (${m.plannedQuantity - m.product.currentStock} faltantes)`).join(', ')}`,
        dueDate: addDays(new Date(), 7),
        alarmDate: addDays(new Date(), 3),
        projectId,
        status: 'pending'
      })
    }

    // Check for pending dispatches
    const pendingDispatches = materials.filter(m =>
      m.dispatchedQuantity < m.plannedQuantity
    )

    if (pendingDispatches.length > 0 && !existingTitles.has(`Despachar materiales para ${projectName}`)) {
      tasksToCreate.push({
        title: `Despachar materiales para ${projectName}`,
        description: `Materiales pendientes de despacho: ${pendingDispatches.map(m => `${m.product.name} (${m.plannedQuantity - m.dispatchedQuantity} pendientes)`).join(', ')}`,
        dueDate: addDays(new Date(), 5),
        alarmDate: addDays(new Date(), 2),
        projectId,
        status: 'pending'
      })
    }
  }

  for (const task of tasksToCreate) {
    await tx.tasks.create({ data: task })
  }
}

export async function autoDispatchOnFinish(
  tx: Prisma.TransactionClient,
  projectId: string
) {
  const materials = await tx.projectMaterials.findMany({
    where: { projectId },
  })

  const pending = materials.filter(
    (m) => m.plannedQuantity > m.dispatchedQuantity
  )
  if (pending.length === 0) return

  const dispatch = await tx.dispatches.create({
    data: {
      projectId,
      dispatchDate: new Date().toISOString().split('T')[0],
      notes: 'Despacho automático al finalizar el proyecto',
    },
  })

  for (const mat of pending) {
    const remaining = mat.plannedQuantity - mat.dispatchedQuantity

    // Allocate across shelves largest-first so real shelf stock is debited,
    // and only fall back to a phantom shelfId=null line for what's uncovered.
    const shelfStocks = await tx.productShelfStock.findMany({
      where: { productId: mat.productId, quantity: { gt: 0 } },
      orderBy: { quantity: 'desc' },
    })

    let leftover = remaining
    for (const s of shelfStocks) {
      if (leftover <= 0) break
      const take = Math.min(s.quantity, leftover)
      const newQty = s.quantity - take
      if (newQty === 0) {
        await tx.productShelfStock.delete({ where: { id: s.id } })
      } else {
        await tx.productShelfStock.update({
          where: { id: s.id },
          data: { quantity: newQty },
        })
      }
      await tx.dispatchItems.create({
        data: {
          dispatchId: dispatch.id,
          productId: mat.productId,
          shelfId: s.shelfId,
          quantity: take,
        },
      })
      leftover -= take
    }

    if (leftover > 0) {
      await tx.dispatchItems.create({
        data: {
          dispatchId: dispatch.id,
          productId: mat.productId,
          shelfId: null,
          quantity: leftover,
        },
      })
    }

    await tx.products.update({
      where: { id: mat.productId },
      data: { currentStock: { decrement: remaining } },
    })

    await tx.projectMaterials.update({
      where: { id: mat.id },
      data: { dispatchedQuantity: mat.plannedQuantity },
    })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await db.projects.findUnique({
      where: { id },
      include: {
        client: true,
        contractor: true,
        materials: {
          include: { product: true },
          orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        dispatches: {
          include: {
            items: {
              include: {
                product: true,
                shelf: {
                  include: {
                    rack: { include: { warehouse: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        returns: {
          include: {
            items: {
              include: {
                productDelivered: { select: { id: true, name: true, code: true } },
                productReturned: { select: { id: true, name: true, code: true } },
                shelfFrom: {
                  include: {
                    rack: { include: { warehouse: true } },
                  },
                },
                shelfTo: {
                  include: {
                    rack: { include: { warehouse: true } },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        purchases: {
          include: {
            supplier: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        phases: {
          include: { phaseType: true },
          orderBy: [{ startDate: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error al obtener proyecto:', error)
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 })
  }
}

async function updateProject(
  id: string,
  body: Record<string, unknown>
) {
  const { name, poNumber, projectType, clientId, contractorId, projectDate, startDate, endDate, status, budget, notes, color } = body as {
    name?: string
    poNumber?: string
    projectType?: string
    clientId?: string
    contractorId?: string | null
    projectDate?: string
    startDate?: string | null
    endDate?: string | null
    status?: string
    budget?: number
    notes?: string
    color?: string
  }

  const current = await db.projects.findUnique({
    where: { id },
    select: {
      status: true,
      projectDate: true,
      startDate: true,
      _count: {
        select: { materials: true },
      },
    },
  })
  if (!current) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const transitioningToFinished =
    status === 'finished' && current.status !== 'finished'

  const statusChanged = status && status !== current.status
  const nextStartDate = startDate !== undefined ? startDate || null : current.startDate

  if (status === 'scheduled') {
    const hasDate = Boolean(nextStartDate)
    const hasMaterials = current._count.materials > 0

    if (!hasDate || !hasMaterials) {
      return NextResponse.json(
        {
          error: !hasDate && !hasMaterials
            ? 'Para schedular un proyecto necesitas fecha y lista de materiales'
            : !hasDate
              ? 'Para schedular un proyecto necesitas una fecha de inicio'
              : 'Para schedular un proyecto necesitas una lista de materiales',
        },
        { status: 400 }
      )
    }
  }

  const project = await db.$transaction(async (tx) => {
    const shouldMoveBackToPlanned =
      status === undefined &&
      startDate !== undefined &&
      !nextStartDate &&
      current.status === 'scheduled'

    const updated = await tx.projects.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(poNumber !== undefined && { poNumber }),
        ...(projectType !== undefined && { projectType }),
        ...(clientId !== undefined && { clientId }),
        ...(contractorId !== undefined && { contractorId: contractorId || null }),
        ...(projectDate !== undefined && { projectDate }),
        ...(startDate !== undefined && { startDate: startDate || null }),
        ...(endDate !== undefined && { endDate: endDate || null }),
        ...(status !== undefined && { status }),
        ...(shouldMoveBackToPlanned && { status: 'planned' }),
        ...(budget !== undefined && { budget }),
        ...(notes !== undefined && { notes }),
        ...(color !== undefined && { color }),
      },
      include: {
        client: true,
        contractor: true,
        materials: { include: { product: true } },
      },
    })

    if (transitioningToFinished) {
      await autoDispatchOnFinish(tx, id)
    }

    if (statusChanged && status) {
      await generateAutomaticTasks(tx, id, status, updated.name)
    }

    return updated
  })

  if (transitioningToFinished) {
    await autoArchiveInvoice(id)
  }

  if (status === undefined && startDate !== undefined) {
    autoScheduleProject(id).catch(console.error)
  } else {
    runProjectAutomation(id).catch(console.error)
  }
  return NextResponse.json(project)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    return await updateProject(id, body)
  } catch (error) {
    console.error('Error al actualizar proyecto:', error)
    return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    return await updateProject(id, body)
  } catch (error) {
    console.error('Error al actualizar proyecto:', error)
    return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const current = await db.projects.findUnique({
      where: { id },
      select: { status: true },
    })

    if (!current) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    if (!['cancelled', 'finished'].includes(current.status)) {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar proyectos cancelados o finalizados' },
        { status: 400 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.tasks.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      })

      await tx.purchases.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      })

      await tx.projects.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error al eliminar proyecto:', error)
    return NextResponse.json({ error: 'Error al eliminar proyecto' }, { status: 500 })
  }
}
