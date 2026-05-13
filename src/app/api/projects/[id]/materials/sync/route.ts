import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isProductCompatibleWithProjectColor } from '@/lib/project-color'
import { autoScheduleProject, runProjectAutomation } from '@/lib/project-automation'

interface IncomingMaterialItem {
  productId: string
  plannedQuantity: number
  engineeringSection?: string
  sortOrder?: number
}

function normalizeItems(items: IncomingMaterialItem[]) {
  const grouped = new Map<string, IncomingMaterialItem>()

  items.forEach((item, index) => {
    const productId = String(item.productId || '').trim()
    const plannedQuantity = Number(item.plannedQuantity)
    if (!productId || !Number.isFinite(plannedQuantity) || plannedQuantity <= 0) return

    const current = grouped.get(productId)
    if (!current) {
      grouped.set(productId, {
        productId,
        plannedQuantity,
        engineeringSection: item.engineeringSection || '',
        sortOrder: item.sortOrder ?? index,
      })
      return
    }

    grouped.set(productId, {
      productId,
      plannedQuantity: current.plannedQuantity + plannedQuantity,
      engineeringSection: current.engineeringSection || item.engineeringSection || '',
      sortOrder: Math.min(current.sortOrder ?? index, item.sortOrder ?? index),
    })
  })

  return [...grouped.values()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'Error al sincronizar materiales del proyecto'
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const clearMissing = body?.clearMissing !== false
    const items = normalizeItems(Array.isArray(body?.items) ? body.items : [])

    if (items.length === 0) {
      return NextResponse.json({ error: 'Debe enviar al menos un material valido' }, { status: 400 })
    }

    const project = await db.projects.findUnique({
      where: { id },
      select: { id: true, color: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const products = await db.products.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: { id: true, name: true, color: true },
    })
    const productById = new Map(products.map((product) => [product.id, product]))

    for (const item of items) {
      const product = productById.get(item.productId)
      if (!product) {
        return NextResponse.json({ error: 'Uno de los productos no existe' }, { status: 400 })
      }

      if (!isProductCompatibleWithProjectColor(project.color, product.color)) {
        return NextResponse.json(
          { error: `El producto ${product.name} no coincide con el color del proyecto` },
          { status: 400 }
        )
      }
    }

    const existing = await db.projectMaterials.findMany({
      where: { projectId: id },
      include: { product: { select: { id: true, name: true, code: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const existingByProductId = new Map(existing.map((material) => [material.productId, material]))
    const incomingProductIds = new Set(items.map((item) => item.productId))

    for (const item of items) {
      const current = existingByProductId.get(item.productId)
      if (current && item.plannedQuantity < current.dispatchedQuantity) {
        return NextResponse.json(
          {
            error: `La cantidad planificada para ${current.product.name} no puede ser menor que lo ya despachado (${current.dispatchedQuantity})`,
          },
          { status: 400 }
        )
      }
    }

    let created = 0
    let updated = 0
    let deleted = 0
    let keptWithDispatch = 0

    await db.$transaction(async (tx) => {
      for (const [index, item] of items.entries()) {
        const current = existingByProductId.get(item.productId)
        if (current) {
          await tx.projectMaterials.update({
            where: { id: current.id },
            data: {
              plannedQuantity: item.plannedQuantity,
              engineeringSection: item.engineeringSection || '',
              sortOrder: item.sortOrder ?? index,
            },
          })
          updated += 1
          continue
        }

        await tx.projectMaterials.create({
          data: {
            projectId: id,
            productId: item.productId,
            plannedQuantity: item.plannedQuantity,
            engineeringSection: item.engineeringSection || '',
            sortOrder: item.sortOrder ?? index,
          },
        })
        created += 1
      }

      if (!clearMissing) return

      for (const material of existing) {
        if (incomingProductIds.has(material.productId)) continue

        if (material.dispatchedQuantity > 0) {
          keptWithDispatch += 1
          continue
        }

        await tx.projectMaterials.delete({ where: { id: material.id } })
        deleted += 1
      }
    })

    autoScheduleProject(id)
      .then((scheduled) => {
        if (!scheduled) return runProjectAutomation(id)
      })
      .catch(console.error)
    return NextResponse.json({
      created,
      updated,
      deleted,
      keptWithDispatch,
    })
  } catch (error) {
    console.error('Error al sincronizar materiales del proyecto:', error)
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
