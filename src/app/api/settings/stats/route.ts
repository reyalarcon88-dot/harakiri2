import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [
      warehouses,
      racks,
      shelves,
      products,
      shelfStocks,
      suppliers,
      clients,
      contractors,
      purchases,
      purchaseItems,
      projects,
      projectMaterials,
      dispatches,
      transfers,
      tasks,
      phaseTypes,
      projectPhases,
      templates,
      pendingPurchases,
      lowStockProducts,
    ] = await Promise.all([
      db.warehouse.count(),
      db.racks.count(),
      db.shelves.count(),
      db.products.count(),
      db.productShelfStock.count(),
      db.suppliers.count(),
      db.clients.count(),
      db.contractors.count(),
      db.purchases.count(),
      db.purchaseItems.count(),
      db.projects.count(),
      db.projectMaterials.count(),
      db.dispatches.count(),
      db.transfers.count(),
      db.tasks.count(),
      db.projectPhaseTypes.count(),
      db.projectPhases.count(),
      db.materialTemplates.count(),
      db.purchases.count({ where: { status: 'pending' } }),
      db.products.count({
        where: {
          currentStock: { lt: db.products.fields.minStock },
        },
      }),
    ])

    return NextResponse.json({
      warehouses,
      racks,
      shelves,
      products,
      shelfStocks,
      suppliers,
      clients,
      contractors,
      purchases,
      purchaseItems,
      projects,
      projectMaterials,
      dispatches,
      transfers,
      tasks,
      phaseTypes,
      projectPhases,
      templates,
      pendingPurchases,
      lowStockProducts,
    })
  } catch (error) {
    console.error('Error al obtener estadísticas:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
