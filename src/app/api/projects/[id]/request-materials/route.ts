import { db } from '@/lib/db'
import { generatePurchaseCode } from '@/lib/purchase-code'
import { NextResponse } from 'next/server'
import { runPurchaseOrderAutomation } from '@/lib/server/purchase-order-automation'
import { Prisma } from '@prisma/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { supplierId, productIds } = body as { supplierId?: string; productIds?: string[] }

    if (!supplierId) {
      return NextResponse.json({ error: 'Debe seleccionar un proveedor' }, { status: 400 })
    }

    const supplier = await db.suppliers.findUnique({ where: { id: supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'El proveedor seleccionado no existe' }, { status: 400 })
    }

    const project = await db.projects.findUnique({
      where: { id },
      select: { poNumber: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const materials = await db.projectMaterials.findMany({
      where: { projectId: id },
      include: { product: { select: { id: true, name: true, code: true } } },
    })

    // Per-product coverage from non-cancelled purchases of this project.
    const purchaseItems = await db.purchaseItems.findMany({
      where: {
        purchase: { projectId: id, status: { not: 'cancelled' } },
      },
      select: { productId: true, quantity: true },
    })
    const purchasedByProduct = new Map<string, number>()
    for (const pi of purchaseItems) {
      purchasedByProduct.set(pi.productId, (purchasedByProduct.get(pi.productId) || 0) + pi.quantity)
    }

    // Available shelf stock per product (total minus reserved quantity).
    const materialProductIds = materials.map((m) => m.productId)
    type StockRow = { product_id: string; available: number | string }
    const stockByProduct = new Map<string, number>()
    if (materialProductIds.length > 0) {
      const shelfStockRows = await db.$queryRaw<StockRow[]>(
        Prisma.sql`
          SELECT product_id,
                 SUM(CASE WHEN is_reserve_shelf = 1 THEN 0
                          ELSE MAX(CAST(quantity AS REAL) - CAST(reserve_quantity AS REAL), 0) END) as available
          FROM product_shelf_stock
          WHERE product_id IN (${Prisma.join(materialProductIds)})
          GROUP BY product_id
        `
      )
      for (const row of shelfStockRows) {
        stockByProduct.set(row.product_id, Number(row.available) || 0)
      }
    }

    // Remaining to order: plan - dispatched - already ordered - available warehouse stock.
    const missingMaterials: { productId: string; productName: string; productCode: string; needed: number }[] = []
    for (const mat of materials) {
      const purchased = purchasedByProduct.get(mat.productId) || 0
      const available = stockByProduct.get(mat.productId) || 0
      const needed = mat.plannedQuantity - mat.dispatchedQuantity - purchased - available
      if (needed > 0) {
        missingMaterials.push({
          productId: mat.productId,
          productName: mat.product.name,
          productCode: mat.product.code,
          needed,
        })
      }
    }

    const normalizedProductIds = Array.isArray(productIds)
      ? [...new Set(productIds.map((value) => String(value || '').trim()).filter(Boolean))]
      : []

    const selectedMaterials =
      normalizedProductIds.length > 0
        ? missingMaterials.filter((material) => normalizedProductIds.includes(material.productId))
        : missingMaterials

    if (selectedMaterials.length === 0) {
      return NextResponse.json({ message: 'No missing materials', missingMaterials: [] })
    }

    const today = new Date().toISOString().split('T')[0]
    const purchaseCode = await generatePurchaseCode(db, project.poNumber, today)

    const purchase = await db.purchases.create({
      data: {
        purchaseCode,
        poNumber: project.poNumber || '',
        supplierId: supplier.id,
        projectId: id,
        purchaseDate: today,
        notes: 'Pedido automático para proyecto: materiales faltantes',
        status: 'pedido',
        items: {
          create: selectedMaterials.map((item) => ({
            productId: item.productId,
            quantity: item.needed,
            unitPrice: 0,
          })),
        },
      },
    })

    const origin = new URL(request.url).origin
    const automation = await runPurchaseOrderAutomation(purchase.id, origin)

    return NextResponse.json({
      success: true,
      purchaseId: purchase.id,
      missingMaterials: selectedMaterials,
      automation,
    })
  } catch (error) {
    console.error('POST /api/projects/[id]/request-materials error:', error)
    return NextResponse.json({ error: 'Failed to request materials' }, { status: 500 })
  }
}
