import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Delete in reverse dependency order
    await db.toolMovements.deleteMany()
    await db.toolKitItems.deleteMany()
    await db.toolKits.deleteMany()
    await db.inventoryTools.deleteMany()
    await db.toolInstallers.deleteMany()
    await db.dispatchItems.deleteMany()
    await db.returnItems.deleteMany()
    await db.dispatches.deleteMany()
    await db.returns.deleteMany()
    await db.projectPhases.deleteMany()
    await db.projectMaterials.deleteMany()
    await db.materialTemplateItems.deleteMany()
    await db.materialTemplates.deleteMany()
    await db.projectDocuments.deleteMany()
    await db.purchaseDocuments.deleteMany()
    await db.purchaseItems.deleteMany()
    await db.purchases.deleteMany()
    await db.productShelfStock.deleteMany()
    await db.products.deleteMany()
    await db.tasks.deleteMany()
    await db.projectPhaseTypes.deleteMany()
    await db.shelves.deleteMany()
    await db.racks.deleteMany()
    await db.warehouse.deleteMany()
    await db.suppliers.deleteMany()
    await db.clients.deleteMany()
    await db.contractors.deleteMany()

    return NextResponse.json({ message: 'Base de datos limpiada exitosamente' })
  } catch (error) {
    console.error('Error al limpiar base de datos:', error)
    return NextResponse.json(
      { error: 'Error al limpiar base de datos: ' + (error instanceof Error ? error.message : 'Desconocido') },
      { status: 500 }
    )
  }
}
