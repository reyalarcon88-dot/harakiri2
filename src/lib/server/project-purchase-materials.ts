import type { Prisma } from '@prisma/client'

async function getPurchasedQuantityForProjectProduct(
  tx: Prisma.TransactionClient,
  projectId: string,
  productId: string
) {
  const items = await tx.purchaseItems.findMany({
    where: {
      productId,
      purchase: {
        projectId,
        status: { not: 'cancelled' },
      },
    },
    select: {
      quantity: true,
    },
  })

  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export async function syncProjectMaterialFromPurchase(
  tx: Prisma.TransactionClient,
  projectId: string,
  productId: string,
  fallbackQuantity = 0
) {
  const current = await tx.projectMaterials.findFirst({
    where: { projectId, productId },
    select: {
      id: true,
      plannedQuantity: true,
      dispatchedQuantity: true,
    },
  })

  const purchasedQuantity = await getPurchasedQuantityForProjectProduct(tx, projectId, productId)
  const desiredPlannedQuantity = Math.max(
    purchasedQuantity,
    fallbackQuantity,
    current?.plannedQuantity ?? 0,
    current?.dispatchedQuantity ?? 0
  )

  if (desiredPlannedQuantity <= 0) {
    return null
  }

  if (!current) {
    return tx.projectMaterials.create({
      data: {
        projectId,
        productId,
        plannedQuantity: desiredPlannedQuantity,
        dispatchedQuantity: 0,
      },
    })
  }

  if (desiredPlannedQuantity > current.plannedQuantity) {
    return tx.projectMaterials.update({
      where: { id: current.id },
      data: { plannedQuantity: desiredPlannedQuantity },
    })
  }

  return current
}

export async function syncProjectMaterialsFromPurchaseItems(
  tx: Prisma.TransactionClient,
  projectId: string,
  items: { productId: string; quantity?: number }[]
) {
  const grouped = new Map<string, number>()

  for (const item of items) {
    const productId = String(item.productId || '').trim()
    const quantity = Number(item.quantity) || 0
    if (!productId) continue
    grouped.set(productId, (grouped.get(productId) || 0) + Math.max(quantity, 0))
  }

  for (const [productId, quantity] of grouped.entries()) {
    await syncProjectMaterialFromPurchase(tx, projectId, productId, quantity)
  }
}
