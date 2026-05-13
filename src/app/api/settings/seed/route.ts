import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Check if data already exists
    const existingProducts = await db.products.count()
    if (existingProducts > 0) {
      return NextResponse.json(
        { error: 'La base de datos ya contiene datos. Límpiela primero antes de cargar datos de prueba.' },
        { status: 400 }
      )
    }

    // ── 1. Warehouses → Racks → Shelves ──
    const wh1 = await db.warehouse.create({ data: { name: 'Almacén Central', location: 'Zona Industrial Norte', description: 'Almacén principal de la empresa' } })
    const wh2 = await db.warehouse.create({ data: { name: 'Almacén Sur', location: 'Zona Industrial Sur', description: 'Almacén secundario para materiales de construcción' } })
    const wh3 = await db.warehouse.create({ data: { name: 'Bodega Auxiliar', location: 'Centro de Distribución', description: 'Bodega para materiales en tránsito' } })

    const r1 = await db.racks.create({ data: { warehouseId: wh1.id, name: 'Rack A-01' } })
    const r2 = await db.racks.create({ data: { warehouseId: wh1.id, name: 'Rack A-02' } })
    const r3 = await db.racks.create({ data: { warehouseId: wh1.id, name: 'Rack B-01' } })
    const r4 = await db.racks.create({ data: { warehouseId: wh2.id, name: 'Rack C-01' } })
    const r5 = await db.racks.create({ data: { warehouseId: wh2.id, name: 'Rack C-02' } })
    const r6 = await db.racks.create({ data: { warehouseId: wh3.id, name: 'Rack D-01' } })

    const s1 = await db.shelves.create({ data: { rackId: r1.id, name: 'Anaquel 1' } })
    const s2 = await db.shelves.create({ data: { rackId: r1.id, name: 'Anaquel 2' } })
    const s3 = await db.shelves.create({ data: { rackId: r2.id, name: 'Anaquel 3' } })
    const s4 = await db.shelves.create({ data: { rackId: r2.id, name: 'Anaquel 4' } })
    const s5 = await db.shelves.create({ data: { rackId: r3.id, name: 'Anaquel 5' } })
    const s6 = await db.shelves.create({ data: { rackId: r4.id, name: 'Anaquel 6' } })
    const s7 = await db.shelves.create({ data: { rackId: r5.id, name: 'Anaquel 7' } })
    const s8 = await db.shelves.create({ data: { rackId: r6.id, name: 'Anaquel 8' } })

    // ── 2. Products ──
    const products = await Promise.all([
      db.products.create({ data: { code: 'CEM-001', name: 'Cemento Portland', family: 'Materiales de Construcción', unitOfMeasure: 'saco', unitQuantity: '42.5 kg', minStock: 50, currentStock: 0 } }),
      db.products.create({ data: { code: 'ARE-001', name: 'Arena Gruesa', family: 'Agregados', unitOfMeasure: 'm³', unitQuantity: 'm³', minStock: 20, currentStock: 0 } }),
      db.products.create({ data: { code: 'GRA-001', name: 'Grava 3/4"', family: 'Agregados', unitOfMeasure: 'm³', unitQuantity: 'm³', minStock: 15, currentStock: 0 } }),
      db.products.create({ data: { code: 'BLO-001', name: 'Bloque de Concreto 10cm', family: 'Mampostería', unitOfMeasure: 'unidad', unitQuantity: 'unidad', minStock: 500, currentStock: 0 } }),
      db.products.create({ data: { code: 'BLO-002', name: 'Bloque de Concreto 15cm', family: 'Mampostería', unitOfMeasure: 'unidad', unitQuantity: 'unidad', minStock: 400, currentStock: 0 } }),
      db.products.create({ data: { code: 'VAR-001', name: 'Varilla Corrugada 3/8"', family: 'Acero', unitOfMeasure: 'varilla', unitQuantity: '6m', minStock: 100, currentStock: 0 } }),
      db.products.create({ data: { code: 'VAR-002', name: 'Varilla Corrugada 1/2"', family: 'Acero', unitOfMeasure: 'varilla', unitQuantity: '6m', minStock: 80, currentStock: 0 } }),
      db.products.create({ data: { code: 'LAM-001', name: 'Lámina de Acero Cal. 26', family: 'Acero', unitOfMeasure: 'plancha', unitQuantity: '1.22x2.44m', minStock: 30, currentStock: 0 } }),
      db.products.create({ data: { code: 'PIN-001', name: 'Pino Aserrado 2x4', family: 'Madera', unitOfMeasure: 'tabla', unitQuantity: '3m', minStock: 100, currentStock: 0 } }),
      db.products.create({ data: { code: 'PLY-001', name: 'Plywood 3/4"', family: 'Madera', unitOfMeasure: 'plancha', unitQuantity: '1.22x2.44m', minStock: 25, currentStock: 0 } }),
      db.products.create({ data: { code: 'AGU-001', name: 'Adhesivo Cerámico', family: 'Químicos', unitOfMeasure: 'saco', unitQuantity: '25 kg', minStock: 20, currentStock: 0 } }),
      db.products.create({ data: { code: 'PUR-001', name: 'Pintura Vinílica Blanca', family: 'Químicos', unitOfMeasure: 'galón', unitQuantity: '4L', minStock: 30, currentStock: 0 } }),
      db.products.create({ data: { code: 'TUB-001', name: 'Tubo PVC 4"', family: 'Plomería', unitOfMeasure: 'metro', unitQuantity: '3m', minStock: 40, currentStock: 0 } }),
      db.products.create({ data: { code: 'CAB-001', name: 'Cable THW 12 AWG', family: 'Eléctrico', unitOfMeasure: 'metro', unitQuantity: '100m rollo', minStock: 15, currentStock: 0 } }),
      db.products.create({ data: { code: 'HIE-001', name: 'Hierro Angular 1x1/8"', family: 'Acero', unitOfMeasure: 'barra', unitQuantity: '6m', minStock: 50, currentStock: 0 } }),
    ])

    // ── 3. Product Shelf Stock (simulate inventory) ──
    await Promise.all([
      // Cemento distribuido en varios anaqueles
      db.productShelfStock.create({ data: { productId: products[0].id, shelfId: s1.id, quantity: 120 } }),
      db.productShelfStock.create({ data: { productId: products[0].id, shelfId: s6.id, quantity: 80 } }),
      // Arena
      db.productShelfStock.create({ data: { productId: products[1].id, shelfId: s5.id, quantity: 25 } }),
      // Grava
      db.productShelfStock.create({ data: { productId: products[2].id, shelfId: s5.id, quantity: 18 } }),
      // Bloques
      db.productShelfStock.create({ data: { productId: products[3].id, shelfId: s2.id, quantity: 600 } }),
      db.productShelfStock.create({ data: { productId: products[4].id, shelfId: s3.id, quantity: 350 } }),
      // Varillas
      db.productShelfStock.create({ data: { productId: products[5].id, shelfId: s4.id, quantity: 150 } }),
      db.productShelfStock.create({ data: { productId: products[6].id, shelfId: s4.id, quantity: 95 } }),
      // Láminas
      db.productShelfStock.create({ data: { productId: products[7].id, shelfId: s7.id, quantity: 45 } }),
      // Madera
      db.productShelfStock.create({ data: { productId: products[8].id, shelfId: s8.id, quantity: 120 } }),
      db.productShelfStock.create({ data: { productId: products[9].id, shelfId: s8.id, quantity: 30 } }),
      // Químicos
      db.productShelfStock.create({ data: { productId: products[10].id, shelfId: s1.id, quantity: 25 } }),
      db.productShelfStock.create({ data: { productId: products[11].id, shelfId: s2.id, quantity: 40 } }),
      // Plomería / Eléctrico
      db.productShelfStock.create({ data: { productId: products[12].id, shelfId: s3.id, quantity: 55 } }),
      db.productShelfStock.create({ data: { productId: products[13].id, shelfId: s4.id, quantity: 20 } }),
      // Hierro angular
      db.productShelfStock.create({ data: { productId: products[14].id, shelfId: s7.id, quantity: 60 } }),
    ])

    // Update currentStock on products based on shelf stock
    for (const p of products) {
      const totalOnShelves = await db.productShelfStock.aggregate({
        where: { productId: p.id },
        _sum: { quantity: true },
      })
      await db.products.update({
        where: { id: p.id },
        data: { currentStock: totalOnShelves._sum.quantity || 0 },
      })
    }

    // ── 4. Suppliers ──
    const suppliers = await Promise.all([
      db.suppliers.create({ data: { name: 'Cementos del Norte S.A.', contactName: 'Carlos Méndez', email: 'ventas@cementosnorte.com', phone: '+53 5555-0101', address: 'Carretera Central Km 5' } }),
      db.suppliers.create({ data: { name: 'Aceros del Caribe', contactName: 'Ana Rodríguez', email: 'pedidos@aceroscaribe.com', phone: '+53 5555-0202', address: 'Zona Industrial Puerto' } }),
      db.suppliers.create({ data: { name: 'Maderas y Materiales S.A.', contactName: 'Luis Fernández', email: 'info@maderasysa.com', phone: '+53 5555-0303', address: 'Autopista Sur Km 12' } }),
      db.suppliers.create({ data: { name: 'Distribuidora Química Industrial', contactName: 'María García', email: 'comercial@quimind.com', phone: '+53 5555-0404', address: 'Parque Industrial Oeste' } }),
    ])

    // ── 5. Clients ──
    const clients = await Promise.all([
      db.clients.create({ data: { name: 'Constructora Havana Real Estate', contactName: 'Roberto Díaz', email: 'compras@havanareal.com', phone: '+53 5555-1001', address: 'Miramar, La Habana' } }),
      db.clients.create({ data: { name: 'Grupo Inmobiliario del Sol', contactName: 'Patricia Hernández', email: 'proyectos@inmosol.com', phone: '+53 5555-1002', address: 'Playa, La Habana' } }),
      db.clients.create({ data: { name: 'Hotel Paradiso', contactName: 'Jorge Martínez', email: 'mantenimiento@paradiso.com', phone: '+53 5555-1003', address: 'Varadero, Matanzas' } }),
    ])

    // ── 6. Contractors ──
    const contractors = await Promise.all([
      db.contractors.create({ data: { name: 'Maestros Constructores S.A.', contactName: 'Fernando López', email: 'obras@maestrosconstruct.com', phone: '+53 5555-2001', specialty: 'Construcción general' } }),
      db.contractors.create({ data: { name: 'ElectricPro Instalaciones', contactName: 'Raúl Torres', email: 'servicios@electricpro.com', phone: '+53 5555-2002', specialty: 'Instalaciones eléctricas' } }),
      db.contractors.create({ data: { name: 'HidroServicios Cubanos', contactName: 'Ileana Castro', email: 'info@hidroservicios.cu', phone: '+53 5555-2003', specialty: 'Plomería y fontanería' } }),
    ])

    // ── 7. Purchases ──
    const purchases = await Promise.all([
      db.purchases.create({ data: { purchaseCode: 'COMP-2024-001', supplierId: suppliers[0].id, purchaseDate: '2024-11-15', notes: 'Compra mensual de cemento', status: 'received' } }),
      db.purchases.create({ data: { purchaseCode: 'COMP-2024-002', supplierId: suppliers[1].id, purchaseDate: '2024-11-20', notes: 'Pedido de acero para proyecto Havana Real', status: 'received' } }),
      db.purchases.create({ data: { purchaseCode: 'COMP-2024-003', supplierId: suppliers[2].id, purchaseDate: '2024-12-01', notes: 'Madera para encofrado', status: 'received' } }),
      db.purchases.create({ data: { purchaseCode: 'COMP-2024-004', supplierId: suppliers[0].id, purchaseDate: '2024-12-10', notes: 'Reposición urgente de cemento', status: 'pending' } }),
      db.purchases.create({ data: { purchaseCode: 'COMP-2025-001', supplierId: suppliers[3].id, purchaseDate: '2025-01-05', notes: 'Adhesivos y pintura para Hotel Paradiso', status: 'pending' } }),
    ])

    // ── 8. Purchase Items ──
    await Promise.all([
      // COMP-2024-001 items
      db.purchaseItems.create({ data: { purchaseId: purchases[0].id, productId: products[0].id, shelfId: s1.id, quantity: 100, unitPrice: 15.50 } }),
      db.purchaseItems.create({ data: { purchaseId: purchases[0].id, productId: products[1].id, shelfId: s5.id, quantity: 15, unitPrice: 180.00 } }),
      // COMP-2024-002 items
      db.purchaseItems.create({ data: { purchaseId: purchases[1].id, productId: products[5].id, shelfId: s4.id, quantity: 120, unitPrice: 8.75 } }),
      db.purchaseItems.create({ data: { purchaseId: purchases[1].id, productId: products[6].id, shelfId: s4.id, quantity: 80, unitPrice: 12.30 } }),
      db.purchaseItems.create({ data: { purchaseId: purchases[1].id, productId: products[14].id, shelfId: s7.id, quantity: 40, unitPrice: 22.00 } }),
      // COMP-2024-003 items
      db.purchaseItems.create({ data: { purchaseId: purchases[2].id, productId: products[8].id, shelfId: s8.id, quantity: 100, unitPrice: 5.25 } }),
      db.purchaseItems.create({ data: { purchaseId: purchases[2].id, productId: products[9].id, shelfId: s8.id, quantity: 30, unitPrice: 28.50 } }),
      // COMP-2024-004 items
      db.purchaseItems.create({ data: { purchaseId: purchases[3].id, productId: products[0].id, quantity: 200, unitPrice: 16.00 } }),
      // COMP-2025-001 items
      db.purchaseItems.create({ data: { purchaseId: purchases[4].id, productId: products[10].id, quantity: 20, unitPrice: 12.80 } }),
      db.purchaseItems.create({ data: { purchaseId: purchases[4].id, productId: products[11].id, quantity: 40, unitPrice: 18.50 } }),
    ])

    // ── 9. Projects ──
    const projects = await Promise.all([
      db.projects.create({ data: { name: 'Residencial Miramar Torre A', clientId: clients[0].id, contractorId: contractors[0].id, projectDate: '2024-10-01', status: 'in_progress', budget: 850000 } }),
      db.projects.create({ data: { name: 'Hotel Paradiso Renovación', clientId: clients[2].id, contractorId: contractors[1].id, projectDate: '2024-11-15', status: 'in_progress', budget: 1200000 } }),
      db.projects.create({ data: { name: 'Centro Comercial del Sol', clientId: clients[1].id, contractorId: contractors[0].id, projectDate: '2025-01-10', status: 'planned', budget: 2500000 } }),
    ])

    // ── 10. Project Materials ──
    await Promise.all([
      // Residencial Miramar
      db.projectMaterials.create({ data: { projectId: projects[0].id, productId: products[0].id, plannedQuantity: 500, dispatchedQuantity: 280 } }),
      db.projectMaterials.create({ data: { projectId: projects[0].id, productId: products[1].id, plannedQuantity: 30, dispatchedQuantity: 18 } }),
      db.projectMaterials.create({ data: { projectId: projects[0].id, productId: products[2].id, plannedQuantity: 25, dispatchedQuantity: 10 } }),
      db.projectMaterials.create({ data: { projectId: projects[0].id, productId: products[3].id, plannedQuantity: 3000, dispatchedQuantity: 1200 } }),
      db.projectMaterials.create({ data: { projectId: projects[0].id, productId: products[4].id, plannedQuantity: 2000, dispatchedQuantity: 800 } }),
      db.projectMaterials.create({ data: { projectId: projects[0].id, productId: products[5].id, plannedQuantity: 400, dispatchedQuantity: 200 } }),
      // Hotel Paradiso
      db.projectMaterials.create({ data: { projectId: projects[1].id, productId: products[7].id, plannedQuantity: 200, dispatchedQuantity: 90 } }),
      db.projectMaterials.create({ data: { projectId: projects[1].id, productId: products[8].id, plannedQuantity: 150, dispatchedQuantity: 60 } }),
      db.projectMaterials.create({ data: { projectId: projects[1].id, productId: products[10].id, plannedQuantity: 50, dispatchedQuantity: 25 } }),
      db.projectMaterials.create({ data: { projectId: projects[1].id, productId: products[11].id, plannedQuantity: 80, dispatchedQuantity: 35 } }),
      db.projectMaterials.create({ data: { projectId: projects[1].id, productId: products[12].id, plannedQuantity: 60, dispatchedQuantity: 30 } }),
      db.projectMaterials.create({ data: { projectId: projects[1].id, productId: products[13].id, plannedQuantity: 20, dispatchedQuantity: 10 } }),
      // Centro Comercial
      db.projectMaterials.create({ data: { projectId: projects[2].id, productId: products[0].id, plannedQuantity: 800 } }),
      db.projectMaterials.create({ data: { projectId: projects[2].id, productId: products[5].id, plannedQuantity: 600 } }),
      db.projectMaterials.create({ data: { projectId: projects[2].id, productId: products[6].id, plannedQuantity: 400 } }),
      db.projectMaterials.create({ data: { projectId: projects[2].id, productId: products[14].id, plannedQuantity: 200 } }),
    ])

    // ── 11. Dispatches ──
    const dispatches = await Promise.all([
      db.dispatches.create({ data: { projectId: projects[0].id, dispatchDate: '2024-11-02', notes: 'Despacho inicial de materiales' } }),
      db.dispatches.create({ data: { projectId: projects[0].id, dispatchDate: '2024-11-20', notes: 'Segundo despacho para cimentación' } }),
      db.dispatches.create({ data: { projectId: projects[1].id, dispatchDate: '2024-12-01', notes: 'Materiales para renovación de habitaciones' } }),
    ])

    await Promise.all([
      // Dispatch 1 items
      db.dispatchItems.create({ data: { dispatchId: dispatches[0].id, productId: products[0].id, shelfId: s1.id, quantity: 150 } }),
      db.dispatchItems.create({ data: { dispatchId: dispatches[0].id, productId: products[1].id, shelfId: s5.id, quantity: 10 } }),
      db.dispatchItems.create({ data: { dispatchId: dispatches[0].id, productId: products[3].id, shelfId: s2.id, quantity: 700 } }),
      // Dispatch 2 items
      db.dispatchItems.create({ data: { dispatchId: dispatches[1].id, productId: products[0].id, shelfId: s1.id, quantity: 130 } }),
      db.dispatchItems.create({ data: { dispatchId: dispatches[1].id, productId: products[2].id, shelfId: s5.id, quantity: 10 } }),
      db.dispatchItems.create({ data: { dispatchId: dispatches[1].id, productId: products[5].id, shelfId: s4.id, quantity: 200 } }),
      // Dispatch 3 items
      db.dispatchItems.create({ data: { dispatchId: dispatches[2].id, productId: products[7].id, shelfId: s7.id, quantity: 90 } }),
      db.dispatchItems.create({ data: { dispatchId: dispatches[2].id, productId: products[8].id, shelfId: s8.id, quantity: 60 } }),
      db.dispatchItems.create({ data: { dispatchId: dispatches[2].id, productId: products[10].id, shelfId: s1.id, quantity: 25 } }),
    ])

    // ── 12. Transfers ──
    await Promise.all([
      db.transfers.create({ data: { fromShelfId: s1.id, toShelfId: s6.id, productId: products[0].id, quantity: 30, transferDate: '2024-11-25', notes: 'Traslado de cemento a almacén sur' } }),
      db.transfers.create({ data: { fromShelfId: s4.id, toShelfId: s3.id, productId: products[5].id, quantity: 20, transferDate: '2024-12-05', notes: 'Reubicación de varillas' } }),
    ])

    // ── 13. Tasks ──
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    await Promise.all([
      db.tasks.create({ data: { title: 'Revisión de inventario mensual', description: 'Verificar stock de todos los productos y actualizar cantidades', dueDate: nextWeek.toISOString(), status: 'pending' } }),
      db.tasks.create({ data: { title: 'Recibir pedido COMP-2024-004', description: 'Confirmar entrega de cemento con Cementos del Norte', dueDate: nextWeek.toISOString(), status: 'pending' } }),
      db.tasks.create({ data: { title: 'Preparar materiales Centro Comercial del Sol', description: 'Reunir acero y cemento para inicio de obra', dueDate: nextMonth.toISOString(), status: 'pending' } }),
      db.tasks.create({ data: { title: 'Inspección eléctrica Hotel Paradiso', description: 'Coordinar con ElectricPro la instalación eléctrica del piso 3', dueDate: nextWeek.toISOString(), status: 'pending' } }),
      db.tasks.create({ data: { title: 'Pago a proveedores', description: 'Liquidar facturas de noviembre 2024', dueDate: yesterday.toISOString(), status: 'pending' } }),
      db.tasks.create({ data: { title: 'Mantenimiento de estanterías', description: 'Revisar estado de racks en Almacén Central', dueDate: nextMonth.toISOString(), status: 'pending' } }),
    ])

    // ── 14. Material Templates ──
    const template1 = await db.materialTemplates.create({ data: { name: 'Plantilla Residencial Estándar', description: 'Materiales base para construcción de vivienda de 2 plantas' } })
    const template2 = await db.materialTemplates.create({ data: { name: 'Plantilla Hotel Renovación', description: 'Materiales para renovación de hotel' } })

    await Promise.all([
      db.materialTemplateItems.create({ data: { templateId: template1.id, productId: products[0].id, plannedQuantity: 300 } }),
      db.materialTemplateItems.create({ data: { templateId: template1.id, productId: products[3].id, plannedQuantity: 2000 } }),
      db.materialTemplateItems.create({ data: { templateId: template1.id, productId: products[5].id, plannedQuantity: 200 } }),
      db.materialTemplateItems.create({ data: { templateId: template1.id, productId: products[8].id, plannedQuantity: 80 } }),
      db.materialTemplateItems.create({ data: { templateId: template2.id, productId: products[7].id, plannedQuantity: 150 } }),
      db.materialTemplateItems.create({ data: { templateId: template2.id, productId: products[10].id, plannedQuantity: 40 } }),
      db.materialTemplateItems.create({ data: { templateId: template2.id, productId: products[11].id, plannedQuantity: 60 } }),
    ])

    // Count results
    const counts = {
      warehouses: await db.warehouse.count(),
      racks: await db.racks.count(),
      shelves: await db.shelves.count(),
      products: await db.products.count(),
      shelfStocks: await db.productShelfStock.count(),
      suppliers: await db.suppliers.count(),
      clients: await db.clients.count(),
      contractors: await db.contractors.count(),
      purchases: await db.purchases.count(),
      purchaseItems: await db.purchaseItems.count(),
      projects: await db.projects.count(),
      projectMaterials: await db.projectMaterials.count(),
      dispatches: await db.dispatches.count(),
      transfers: await db.transfers.count(),
      tasks: await db.tasks.count(),
      templates: await db.materialTemplates.count(),
    }

    return NextResponse.json({
      message: 'Datos de prueba cargados exitosamente',
      counts,
    })
  } catch (error) {
    console.error('Error al cargar datos de prueba:', error)
    return NextResponse.json(
      { error: 'Error al cargar datos de prueba: ' + (error instanceof Error ? error.message : 'Desconocido') },
      { status: 500 }
    )
  }
}
