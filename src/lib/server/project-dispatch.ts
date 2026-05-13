import type { Prisma } from '@prisma/client'

export interface ProjectDispatchItemInput {
  productId: string
  quantity: number
}

export class ProjectDispatchValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectDispatchValidationError'
  }
}

function toGroupedDispatchMap(items: ProjectDispatchItemInput[]) {
  const grouped = new Map<string, number>()

  for (const item of items) {
    const productId = String(item.productId || '').trim()
    const quantity = Number(item.quantity)
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue

    grouped.set(productId, (grouped.get(productId) || 0) + quantity)
  }

  return grouped
}

function formatProductLabel(product: { name: string; code: string } | null | undefined, productId: string) {
  if (!product) return `ID ${productId}`
  return product.code ? `${product.name} (${product.code})` : product.name
}

export async function assertProjectDispatchWithinPlan(
  tx: Prisma.TransactionClient,
  projectId: string,
  items: ProjectDispatchItemInput[]
) {
  const grouped = toGroupedDispatchMap(items)
  const productIds = [...grouped.keys()]

  if (productIds.length === 0) {
    throw new ProjectDispatchValidationError('No hay items validos para despachar')
  }

  const materials = await tx.projectMaterials.findMany({
    where: {
      projectId,
      productId: { in: productIds },
    },
    include: {
      product: {
        select: { name: true, code: true },
      },
    },
  })

  const materialByProductId = new Map(materials.map((material) => [material.productId, material]))
  const missingProductIds = productIds.filter((productId) => !materialByProductId.has(productId))

  const missingProducts = missingProductIds.length > 0
    ? await tx.products.findMany({
        where: { id: { in: missingProductIds } },
        select: { id: true, name: true, code: true },
      })
    : []
  const missingProductById = new Map(missingProducts.map((product) => [product.id, product]))

  for (const [productId, quantity] of grouped.entries()) {
    const material = materialByProductId.get(productId)
    if (!material) {
      const productLabel = formatProductLabel(missingProductById.get(productId), productId)
      throw new ProjectDispatchValidationError(
        `${productLabel} no esta en la lista de materiales del proyecto. Agregalo al proyecto o cambia el item antes de despachar.`
      )
    }

    const pending = Math.max(material.plannedQuantity - material.dispatchedQuantity, 0)
    if (quantity > pending) {
      throw new ProjectDispatchValidationError(
        `La cantidad a despachar para ${formatProductLabel(material.product, productId)} (${quantity}) supera lo pendiente (${pending})`
      )
    }
  }

  return grouped
}

export async function incrementProjectDispatchQuantities(
  tx: Prisma.TransactionClient,
  projectId: string,
  items: ProjectDispatchItemInput[]
) {
  const grouped = toGroupedDispatchMap(items)
  const productIds = [...grouped.keys()]

  if (productIds.length === 0) return

  const materials = await tx.projectMaterials.findMany({
    where: {
      projectId,
      productId: { in: productIds },
    },
    select: {
      id: true,
      productId: true,
    },
  })

  const materialByProductId = new Map(materials.map((material) => [material.productId, material]))

  for (const [productId, quantity] of grouped.entries()) {
    const material = materialByProductId.get(productId)
    if (!material) continue

    await tx.projectMaterials.update({
      where: { id: material.id },
      data: { dispatchedQuantity: { increment: quantity } },
    })
  }
}

export async function decrementProjectDispatchQuantities(
  tx: Prisma.TransactionClient,
  projectId: string,
  items: ProjectDispatchItemInput[]
) {
  const grouped = toGroupedDispatchMap(items)
  const productIds = [...grouped.keys()]

  if (productIds.length === 0) return

  const materials = await tx.projectMaterials.findMany({
    where: {
      projectId,
      productId: { in: productIds },
    },
    select: {
      id: true,
      productId: true,
      dispatchedQuantity: true,
    },
  })

  const materialByProductId = new Map(materials.map((material) => [material.productId, material]))

  for (const [productId, quantity] of grouped.entries()) {
    const material = materialByProductId.get(productId)
    if (!material) continue

    const nextDispatchedQuantity = Math.max(Number(material.dispatchedQuantity) - quantity, 0)
    await tx.projectMaterials.update({
      where: { id: material.id },
      data: { dispatchedQuantity: nextDispatchedQuantity },
    })
  }
}
