import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const [
      totalWarehouses,
      totalProducts,
      totalPurchases,
      pendingPurchases,
      recentTasks,
      activeProjectsList,
      lowStockProducts,
      materialPriceProducts,
    ] = await Promise.all([
      // Total counts
      db.warehouse.count(),
      db.products.count(),
      db.purchases.count(),
      db.purchases.count({ where: { status: 'pending' } }),

      // Recent pending tasks (prioritize urgent ones)
      db.tasks.findMany({
        where: { status: { in: ['pending', 'in_progress'] } },
        include: { project: { select: { id: true, name: true, poNumber: true } } },
        orderBy: [
          { alarmDate: 'asc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' }
        ],
        take: 10,
      }),

      // Active projects (not finished/cancelled) with materials
      db.projects.findMany({
        where: {
          status: { notIn: ['finished', 'cancelled'] },
        },
        include: {
          client: { select: { id: true, name: true } },
          materials: {
            select: {
              plannedQuantity: true,
              dispatchedQuantity: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Low stock products
      db.products.findMany({
        where: {
          currentStock: { lt: db.products.fields.minStock },
        },
        include: {
          shelfStocks: {
            include: {
              shelf: {
                include: {
                  rack: { include: { warehouse: true } },
                },
              },
            },
          },
        },
      }),

      // Material prices from the product catalog reference price.
      db.products.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          family: true,
          unitOfMeasure: true,
          currentStock: true,
          referencePrice: true,
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const materialPrices = materialPriceProducts.map((product) => ({
      productId: product.id,
      productName: product.name,
      code: product.code,
      family: product.family || 'Sin familia',
      unitOfMeasure: product.unitOfMeasure || 'unidad',
      currentStock: product.currentStock,
      unitPrice: product.referencePrice || 0,
    }))

    return NextResponse.json({
      totalWarehouses,
      totalProducts,
      activeProjects: activeProjectsList.length,
      pendingPurchases,
      recentTasks: recentTasks || [],
      activeProjectsList: activeProjectsList || [],
      lowStockProducts: lowStockProducts || [],
      materialPrices,
      averagePrices: materialPrices.map((product) => ({
        productName: product.productName,
        avgPrice: product.unitPrice,
        totalQuantity: product.currentStock,
      })),
    })
  } catch (error) {
    console.error('Error al obtener estadisticas:', error)
    return NextResponse.json({ error: 'Error al obtener estadisticas' }, { status: 500 })
  }
}
