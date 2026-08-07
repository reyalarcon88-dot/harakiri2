import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertProjectDispatchWithinPlan,
  incrementProjectDispatchQuantities,
  ProjectDispatchValidationError,
} from '@/lib/server/project-dispatch'
import { detectCutLength, isCuttableSourceForTarget } from '@/lib/cut-stock'

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
// Returns items in three groups:
//   - own:          items where productId === plannedProductId AND belong to THIS project (or unassigned)
//   - crossProject: items where productId === plannedProductId BUT from OTHER projects (opt-in)
//   - crossCut:     items where productId !== plannedProductId but the recepción product is a
//                   "longer" version of a planned product (e.g. INS-3X11-24' for INS-3X11-6').
//                   These can be cut into the planned product, with the remainder stored as a
//                   new recepción item.
// Each item includes sourceProjectId + sourceProjectName for display.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const pendingByProductId = await getPendingMaterialQuantities(id)
    const pendingProductIds = [...pendingByProductId.keys()]

    if (pendingProductIds.length === 0) {
      return NextResponse.json({ own: [], crossProject: [], crossCut: [] })
    }

    // Planned products (full info needed for cross-cut detection — code/name/unitQuantity/color)
    const plannedProducts = await db.products.findMany({
      where: { id: { in: pendingProductIds } },
      select: { id: true, code: true, name: true, color: true, unitQuantity: true, family: true },
    })

    // All recepción items with quantity > 0 (we need to scan across all products,
    // not just pendingProductIds, because cross-cut sources have different IDs)
    const items = await db.recepcionItem.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        product: {
          select: { id: true, name: true, code: true, color: true, unitQuantity: true, unitOfMeasure: true, family: true },
        },
        purchase: {
          select: {
            id: true,
            purchaseCode: true,
            poNumber: true,
            projectId: true,
            project: { select: { id: true, name: true } },
          },
        },
        return: {
          select: {
            id: true,
            projectId: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    type DecoratedItem = (typeof items)[number] & {
      quantity: number
      sourceProjectId: string | null
      sourceProjectName: string | null
    }

    const ownItems: DecoratedItem[] = []
    const crossProjectItems: DecoratedItem[] = []
    const remainingByProductId = new Map(pendingByProductId)

    const pendingProductIdSet = new Set(pendingProductIds)

    // ── Pass 1: exact-match items for THIS project (or unassigned purchases)
    for (const item of items) {
      if (!pendingProductIdSet.has(item.productId)) continue
      const sourceProjectId = item.purchase?.projectId ?? item.return?.projectId ?? null
      const sourceProjectName =
        item.purchase?.project?.name ?? item.return?.project?.name ?? null

      const belongsToThisProject = sourceProjectId === id || sourceProjectId === null
      if (!belongsToThisProject) continue

      const remaining = remainingByProductId.get(item.productId) || 0
      if (remaining <= 0) continue

      const quantity = Math.min(Number(item.quantity), remaining)
      if (quantity <= 0) continue

      ownItems.push({ ...item, quantity, sourceProjectId, sourceProjectName })
      remainingByProductId.set(item.productId, remaining - quantity)
    }

    // ── Pass 2: exact-match items from OTHER projects (opt-in)
    for (const item of items) {
      if (!pendingProductIdSet.has(item.productId)) continue
      const sourceProjectId = item.purchase?.projectId ?? item.return?.projectId ?? null
      const sourceProjectName =
        item.purchase?.project?.name ?? item.return?.project?.name ?? null

      const belongsToThisProject = sourceProjectId === id || sourceProjectId === null
      if (belongsToThisProject) continue

      const remaining = remainingByProductId.get(item.productId) || 0
      if (remaining <= 0) continue

      const quantity = Math.min(Number(item.quantity), remaining)
      if (quantity <= 0) continue

      crossProjectItems.push({ ...item, quantity, sourceProjectId, sourceProjectName })
      remainingByProductId.set(item.productId, remaining - quantity)
    }

    // ── Pass 3: cross-cut candidates — recepción items where the product is a
    // LONGER version of a planned product. The frontend will offer to cut from
    // these to cover the gap.
    type CrossCutCandidate = {
      recepcionItemId: string
      sourceProduct: { id: string; code: string; name: string; unitOfMeasure: string }
      targetProduct: { id: string; code: string; name: string }
      sourceProjectId: string | null
      sourceProjectName: string | null
      purchaseCode: string | null
      poNumber: string | null
      originalSize: number
      targetSize: number
      pieces: number
    }
    const crossCutCandidates: CrossCutCandidate[] = []

    for (const item of items) {
      // Skip if this item was already eaten by exact-match passes (item.productId in pending)
      // We still allow it as cross-cut source for OTHER planned products if applicable.
      const sourceProduct = item.product
      if (!sourceProduct) continue

      for (const target of plannedProducts) {
        if (target.id === sourceProduct.id) continue
        if (!isCuttableSourceForTarget(target, sourceProduct)) continue

        const sourceLength = detectCutLength(sourceProduct)
        const targetLength = detectCutLength(target)
        if (!sourceLength || !targetLength || sourceLength <= targetLength) continue

        const sourceProjectId = item.purchase?.projectId ?? item.return?.projectId ?? null
        const sourceProjectName =
          item.purchase?.project?.name ?? item.return?.project?.name ?? null

        crossCutCandidates.push({
          recepcionItemId: item.id,
          sourceProduct: {
            id: sourceProduct.id,
            code: sourceProduct.code,
            name: sourceProduct.name,
            unitOfMeasure: sourceProduct.unitOfMeasure,
          },
          targetProduct: {
            id: target.id,
            code: target.code,
            name: target.name,
          },
          sourceProjectId,
          sourceProjectName,
          purchaseCode: item.purchase?.purchaseCode ?? null,
          poNumber: item.purchase?.poNumber ?? null,
          originalSize: sourceLength,
          targetSize: targetLength,
          pieces: Number(item.quantity),
        })
      }
    }

    return NextResponse.json({
      own: ownItems,
      crossProject: crossProjectItems,
      crossCut: crossCutCandidates,
    })
  } catch (error) {
    console.error('Error al listar items de recepcion del proyecto:', error)
    return NextResponse.json({ error: 'Error al listar items' }, { status: 500 })
  }
}

// Dispatches recepcion items that match this project's pending material list.
//
// Body (optional):
//   { crossProjectItemIds?: string[] } — additional recepción item IDs from
//   OTHER projects that the user explicitly opted in to consume (to cover gaps).
//
// Default behavior (no body or empty crossProjectItemIds): only items from this
// project's own purchases/returns (or unassigned purchases) are eligible. Items
// belonging to other projects are NOT touched unless their IDs are passed in
// crossProjectItemIds.
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

    let crossProjectItemIds: string[] = []
    try {
      const body = await request.json()
      if (Array.isArray(body?.crossProjectItemIds)) {
        crossProjectItemIds = body.crossProjectItemIds.filter((v: unknown): v is string => typeof v === 'string')
      }
    } catch {
      // No body or invalid JSON — proceed with default (own-only) behavior
    }
    const crossProjectItemIdSet = new Set(crossProjectItemIds)

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
        include: {
          purchase: { select: { projectId: true } },
          return: { select: { projectId: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      if (pending.length === 0) {
        throw new ProjectDispatchValidationError(
          'No hay items en recepcion que coincidan con los materiales pendientes del proyecto'
        )
      }

      // Filter: own-project items OR explicitly-opted-in cross-project items
      const eligible = pending.filter((recep) => {
        const sourceProjectId = recep.purchase?.projectId ?? recep.return?.projectId ?? null
        const belongsToThisProject = sourceProjectId === id || sourceProjectId === null
        if (belongsToThisProject) return true
        return crossProjectItemIdSet.has(recep.id)
      })

      if (eligible.length === 0) {
        throw new ProjectDispatchValidationError(
          'No hay items en recepcion de este proyecto. Activa la opción "tomar de otros proyectos" si necesitas cubrir el faltante.'
        )
      }

      const remainingByProductId = new Map(pendingByProductId)
      const dispatchRecepcionItems = []

      for (const recep of eligible) {
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
        // Si el material se tomó de la recepción de OTRO proyecto (compra ajena),
        // registrar ese proyecto de origen para que descuente la cantidad desviada
        // de su cobertura y vuelva a pedirla. Solo purchase-sourced y de otro
        // proyecto; propios / no asignados / devoluciones quedan en NULL.
        const purchaseProjectId = recep.purchase?.projectId ?? null
        const sourceProjectId =
          purchaseProjectId && purchaseProjectId !== id ? purchaseProjectId : null

        await tx.dispatchItems.create({
          data: {
            dispatchId: dispatch.id,
            productId: recep.productId,
            shelfId: null,
            quantity,
            sourceProjectId,
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
