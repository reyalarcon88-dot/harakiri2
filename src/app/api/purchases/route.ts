import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generatePurchaseCode } from '@/lib/purchase-code'
import { syncProjectMaterialsFromPurchaseItems } from '@/lib/server/project-purchase-materials'
import { runPurchaseOrderAutomation } from '@/lib/server/purchase-order-automation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')

    let where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { purchaseCode: { contains: search } },
        { poNumber: { contains: search } },
        { notes: { contains: search } },
        { supplier: { name: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (supplierId) {
      where.supplierId = supplierId
    }

    const [purchases, allPurchases] = await Promise.all([
      db.purchases.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: {
          supplier: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
              shelf: {
                include: {
                  rack: { include: { warehouse: true } },
                },
              },
            },
          },
          documents: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchases.findMany({
        select: { status: true },
      }),
    ])

    // Build status counts from all purchases
    const statusCounts: Record<string, number> = {}
    for (const p of allPurchases) {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1
    }

    return NextResponse.json({ purchases, statusCounts })
  } catch (error) {
    console.error('Error al listar compras:', error)
    return NextResponse.json({ error: 'Error al listar compras' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { supplierId, purchaseDate, notes, status, items, projectId, poNumber } = body

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'El proveedor y los items son obligatorios' },
        { status: 400 }
      )
    }

    if (items.some((item: { quantity?: number }) => item.quantity === undefined || item.quantity < 0)) {
      return NextResponse.json(
        { error: 'Cada item necesita una cantidad mayor o igual a 0' },
        { status: 400 }
      )
    }

    const purchase = await db.$transaction(async (tx) => {
      const normalizedPoNumber = typeof poNumber === 'string' ? poNumber.trim() : ''
      const purchaseCode =
        typeof body.purchaseCode === 'string' && body.purchaseCode.trim()
          ? body.purchaseCode.trim()
          : await generatePurchaseCode(tx, normalizedPoNumber, purchaseDate)

      const created = await tx.purchases.create({
        data: {
          purchaseCode,
          poNumber: normalizedPoNumber,
          supplierId,
          projectId: projectId || null,
          purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
          notes: notes || '',
          status: status || 'pending',
          items: {
            createMany: {
              data: items.map((item: { productId: string; shelfId?: string; quantity: number; unitPrice: number; priceSource?: string; notes?: string }) => ({
                productId: item.productId,
                shelfId: item.shelfId || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice || 0,
                priceSource: item.priceSource || 'reference',
                notes: item.notes?.trim() || '',
              })),
            },
          },
        },
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
      })

      // If items have shelfId, create/update ProductShelfStock (reserve stock)
      for (const item of items) {
        if (item.shelfId) {
          await tx.productShelfStock.upsert({
            where: {
              productId_shelfId: {
                productId: item.productId,
                shelfId: item.shelfId,
              },
            },
            create: {
              productId: item.productId,
              shelfId: item.shelfId,
              quantity: item.quantity,
            },
            update: {
              quantity: { increment: item.quantity },
            },
          })
        }
      }

      // If purchase is tied to a project, ensure each purchased product exists
      // in projectMaterials. Add-if-missing only — NEVER inflate plannedQuantity
      // from a purchase. Planned is the target the user set; purchases fill it.
      if (projectId) {
        await syncProjectMaterialsFromPurchaseItems(
          tx,
          projectId,
          items.map((item: { productId: string; quantity: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
          }))
        )
      }

      return created
    })

    let automation = null
    if (purchase.status === 'pedido') {
      const origin = new URL(request.url).origin
      automation = await runPurchaseOrderAutomation(purchase.id, origin)
    }

    return NextResponse.json({ ...purchase, automation }, { status: 201 })
  } catch (error) {
    console.error('Error al crear compra:', error)
    return NextResponse.json({ error: 'Error al crear compra' }, { status: 500 })
  }
}
