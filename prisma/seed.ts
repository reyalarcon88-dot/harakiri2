import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // Clean existing data
  await db.recepcionItem.deleteMany()
  await db.projectDocuments.deleteMany()
  await db.purchaseDocuments.deleteMany()
  await db.dispatchItems.deleteMany()
  await db.dispatches.deleteMany()
  await db.returnItems.deleteMany()
  await db.returns.deleteMany()
  await db.projectPhases.deleteMany()
  await db.projectMaterials.deleteMany()
  await db.projects.deleteMany()
  await db.purchaseItems.deleteMany()
  await db.purchases.deleteMany()
  await db.productShelfStock.deleteMany()
  await db.products.deleteMany()
  await db.shelves.deleteMany()
  await db.racks.deleteMany()
  await db.warehouse.deleteMany()
  await db.suppliers.deleteMany()
  await db.clients.deleteMany()
  await db.contractors.deleteMany()
  await db.projectPhaseTypes.deleteMany()

  const phaseTypes = await Promise.all([
    db.projectPhaseTypes.create({ data: { name: 'Removal', color: 'rose', sortOrder: 10 } }),
    db.projectPhaseTypes.create({ data: { name: 'Concrete', color: 'amber', sortOrder: 20 } }),
    db.projectPhaseTypes.create({ data: { name: 'Prefab', color: 'sky', sortOrder: 30 } }),
    db.projectPhaseTypes.create({ data: { name: 'Install', color: 'emerald', sortOrder: 40 } }),
    db.projectPhaseTypes.create({ data: { name: 'Build', color: 'violet', sortOrder: 50 } }),
  ])
  const phaseType = (name: string) => phaseTypes.find((item) => item.name === name)!

  // ─── Warehouse ────────────────────────────────────────────────────────────
  const warehouse = await db.warehouse.create({
    data: {
      name: 'Almacén Principal',
      location: 'Nave 1',
      description: 'Almacén central de materiales',
      racks: {
        create: [
          {
            name: 'Rack ALU',
            description: 'Aluminio estructural',
            shelves: {
              create: [
                { name: 'ALU-01', description: 'Perfiles largos' },
                { name: 'ALU-02', description: 'Perfiles medianos' },
                { name: 'ALU-03', description: 'Tubos y canales' },
              ],
            },
          },
          {
            name: 'Rack HRJ',
            description: 'Herrajes y fijaciones',
            shelves: {
              create: [
                { name: 'HRJ-01', description: 'Tornillería' },
                { name: 'HRJ-02', description: 'Ángulos y clips' },
                { name: 'HRJ-03', description: 'Canalones y bajantes' },
              ],
            },
          },
          {
            name: 'Rack MIS',
            description: 'Misceláneos',
            shelves: {
              create: [
                { name: 'MIS-01', description: 'Puertas y kits' },
                { name: 'MIS-02', description: 'Mallas y sellantes' },
                { name: 'MIS-03', description: 'Pinturas y consumibles' },
              ],
            },
          },
        ],
      },
    },
  })

  // ─── Products (from Project Scott invoice) ────────────────────────────────
  const products = await Promise.all([
    // Aluminio estructural
    db.products.create({ data: { code: 'ALU-SGU7',  name: 'Super Gutter 7"',            family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "36'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-SMB24', name: 'SMB 2x10x24\'',              family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "24'",   minStock: 10, currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-SMB40', name: 'SMB 2x10x40\'',              family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "40'",   minStock: 5,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-TUB44', name: 'Sc Tube 3 SLP 4x4x24\'',    family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "24'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-OB30',  name: 'OB 1x2x30\'',               family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "30'",   minStock: 5,  currentStock: 0 } }),
    db.products.create({ data: { code: 'PAT-2230',  name: 'Patio 2x2x30\'',             family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "30'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'PAT-2220',  name: 'Patio 2x2x20\'',             family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "20'",   minStock: 1,  currentStock: 0 } }),
    db.products.create({ data: { code: 'PAT-2330',  name: 'Patio 2x3x30\'',             family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "30'",   minStock: 5,  currentStock: 0 } }),
    db.products.create({ data: { code: 'PAT-2430',  name: 'Patio 2x4x30\'',             family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "30'",   minStock: 5,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-DJ224', name: 'DJ 2x2x24\'',                family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "24'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-DJ424', name: 'DJ 2x4x24\'',                family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "24'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-RCV15', name: 'Receiver Channel 2x2x15\'',  family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "15'",   minStock: 1,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-ANG20', name: 'Angle 2x2x20\'',             family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "20'",   minStock: 1,  currentStock: 0 } }),
    db.products.create({ data: { code: 'ALU-POST6', name: '6x6 Post Spline Groove Bronze', family: 'Aluminio Estructural', unitOfMeasure: 'pza', unitQuantity: "1",  minStock: 1,  currentStock: 0 } }),
    // Herrajes y fijaciones
    db.products.create({ data: { code: 'HRJ-GUS3',  name: 'Gusset Plate 3/16"',         family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "10'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-ANG3',  name: 'Angle Click 3 Hole 2x2',     family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "1",     minStock: 20, currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-BUT',   name: 'Butterfly Hinge',             family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "1",     minStock: 4,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-BSW36', name: 'Bugsweep x36"',              family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "36'",   minStock: 4,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-PCT24', name: 'Pool Cable Tie 24"',          family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "24'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-PCT22', name: 'Pool Cable Tie 22"',          family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "22'",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-GST',   name: 'Gutter Strap',               family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "1",     minStock: 4,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-ECS7',  name: 'End Cap Super Gutter 7"',    family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "7\"",   minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-DRP34', name: 'Drop Outlet Aluminum 3x4',   family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "3x4'",  minStock: 1,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-ELA34', name: 'Elbow A 3x4"',              family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "3x4\"", minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'HRJ-ELB34', name: 'Elbow B 3x4"',              family: 'Herrajes',             unitOfMeasure: 'pza', unitQuantity: "3x4\"", minStock: 1,  currentStock: 0 } }),
    // Tornillería
    db.products.create({ data: { code: 'TOR-SMS10', name: 'Screw SMS 10x2"',            family: 'Tornillería',          unitOfMeasure: 'pza', unitQuantity: "10x2'", minStock: 500, currentStock: 0 } }),
    db.products.create({ data: { code: 'TOR-TAP14', name: 'Tapcon 5/16" Head 14x5',    family: 'Tornillería',          unitOfMeasure: 'pza', unitQuantity: "14x5",  minStock: 50,  currentStock: 0 } }),
    db.products.create({ data: { code: 'TOR-TEX1',  name: 'Tex Screw 14x1"',           family: 'Tornillería',          unitOfMeasure: 'pza', unitQuantity: "14x1",  minStock: 500, currentStock: 0 } }),
    db.products.create({ data: { code: 'TOR-TEX3',  name: 'Tex Screw 14x3"',           family: 'Tornillería',          unitOfMeasure: 'pza', unitQuantity: "14x3'", minStock: 50,  currentStock: 0 } }),
    // Bajantes y canalones
    db.products.create({ data: { code: 'CAN-DSP34', name: 'Downspout 3x4x10\'',         family: 'Canalones',            unitOfMeasure: 'pza', unitQuantity: "10'",   minStock: 2,  currentStock: 0 } }),
    // Puertas
    db.products.create({ data: { code: 'PRT-RGL36', name: 'Regular Door 36x80',         family: 'Puertas',              unitOfMeasure: 'pza', unitQuantity: "36x80", minStock: 1,  currentStock: 0 } }),
    db.products.create({ data: { code: 'PRT-KIT',   name: 'Door Kit',                   family: 'Puertas',              unitOfMeasure: 'kit', unitQuantity: "1",     minStock: 1,  currentStock: 0 } }),
    // Mallas
    db.products.create({ data: { code: 'MLL-ADF84', name: 'Screen Adfors 18x14x84"',    family: 'Mallas',               unitOfMeasure: 'pza', unitQuantity: "84\"",  minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'MLL-ADF96', name: 'Screen Adfors 18x14x96"',    family: 'Mallas',               unitOfMeasure: 'pza', unitQuantity: "96\"",  minStock: 2,  currentStock: 0 } }),
    // Sellantes y pinturas
    db.products.create({ data: { code: 'SEL-PNT',   name: 'Structural Spray Paint M Bronze', family: 'Sellantes',      unitOfMeasure: 'lta', unitQuantity: "1",     minStock: 1,  currentStock: 0 } }),
    db.products.create({ data: { code: 'SEL-CAU',   name: 'Caulking',                   family: 'Sellantes',            unitOfMeasure: 'tbo', unitQuantity: "1",     minStock: 2,  currentStock: 0 } }),
    db.products.create({ data: { code: 'SEL-PRM',   name: 'Permanent Sealer',            family: 'Sellantes',            unitOfMeasure: 'gal', unitQuantity: "1",     minStock: 1,  currentStock: 0 } }),
    db.products.create({ data: { code: 'SEL-FLT',   name: 'Flat Sealant 310 American',   family: 'Sellantes',            unitOfMeasure: 'tbo', unitQuantity: "1",     minStock: 2,  currentStock: 0 } }),
  ])

  // Helper: find product by code
  const p = (code: string) => products.find(x => x.code === code)!

  // ─── Supplier ────────────────────────────────────────────────────────────
  const supplier = await db.suppliers.create({
    data: {
      name: 'Scott Materials Supply',
      contactName: 'Scott',
      email: 'scott@materials.com',
      phone: '555-7001',
      address: 'Industrial District',
    },
  })

  // ─── Client ──────────────────────────────────────────────────────────────
  const client = await db.clients.create({
    data: {
      name: 'Reynaldo Layout',
      contactName: 'Reynaldo',
      email: 'reynaldo@layout.com',
      phone: '555-8001',
    },
  })

  // ─── Contractor ──────────────────────────────────────────────────────────
  const contractor = await db.contractors.create({
    data: {
      name: 'Aluminum Structures Pro',
      contactName: 'James',
      email: 'james@alumstructs.com',
      phone: '555-9001',
      specialty: 'Estructuras de aluminio y celosías',
    },
  })

  // ─── Project ─────────────────────────────────────────────────────────────
  const project = await db.projects.create({
    data: {
      name: 'Project Scott - Patio Enclosure',
      clientId: client.id,
      contractorId: contractor.id,
      projectDate: '2026-04-18',
      startDate: '2026-04-20',
      status: 'planned',
      budget: 12000,
      phases: {
        create: [
          { phaseTypeId: phaseType('Removal').id, startDate: '2026-04-20', endDate: '2026-04-20', sortOrder: 0 },
          { phaseTypeId: phaseType('Concrete').id, startDate: '2026-04-21', endDate: '2026-04-22', sortOrder: 1 },
          { phaseTypeId: phaseType('Prefab').id, startDate: '2026-04-23', endDate: '2026-04-24', sortOrder: 2 },
          { phaseTypeId: phaseType('Install').id, startDate: '2026-04-25', endDate: '2026-04-25', sortOrder: 3 },
        ],
      },
      materials: {
        create: [
          { productId: p('ALU-SGU7').id,  plannedQuantity: 1   },
          { productId: p('ALU-SMB24').id, plannedQuantity: 34  },
          { productId: p('ALU-SMB40').id, plannedQuantity: 14  },
          { productId: p('ALU-TUB44').id, plannedQuantity: 2   },
          { productId: p('ALU-OB30').id,  plannedQuantity: 12  },
          { productId: p('PAT-2230').id,  plannedQuantity: 4   },
          { productId: p('PAT-2220').id,  plannedQuantity: 1   },
          { productId: p('PAT-2330').id,  plannedQuantity: 10  },
          { productId: p('PAT-2430').id,  plannedQuantity: 19  },
          { productId: p('ALU-DJ224').id, plannedQuantity: 2   },
          { productId: p('ALU-DJ424').id, plannedQuantity: 2   },
          { productId: p('ALU-RCV15').id, plannedQuantity: 1   },
          { productId: p('ALU-ANG20').id, plannedQuantity: 3   },
          { productId: p('HRJ-GUS3').id,  plannedQuantity: 3   },
          { productId: p('HRJ-ANG3').id,  plannedQuantity: 60  },
          { productId: p('HRJ-BUT').id,   plannedQuantity: 6   },
          { productId: p('HRJ-BSW36').id, plannedQuantity: 8   },
          { productId: p('HRJ-PCT24').id, plannedQuantity: 4   },
          { productId: p('HRJ-PCT22').id, plannedQuantity: 4   },
          { productId: p('HRJ-GST').id,   plannedQuantity: 7   },
          { productId: p('HRJ-ECS7').id,  plannedQuantity: 4   },
          { productId: p('HRJ-DRP34').id, plannedQuantity: 2   },
          { productId: p('HRJ-ELA34').id, plannedQuantity: 3   },
          { productId: p('HRJ-ELB34').id, plannedQuantity: 2   },
          { productId: p('TOR-SMS10').id, plannedQuantity: 1150 },
          { productId: p('TOR-TAP14').id, plannedQuantity: 120 },
          { productId: p('TOR-TEX1').id,  plannedQuantity: 1500 },
          { productId: p('TOR-TEX3').id,  plannedQuantity: 150 },
          { productId: p('CAN-DSP34').id, plannedQuantity: 5   },
          { productId: p('PRT-RGL36').id, plannedQuantity: 2   },
          { productId: p('PRT-KIT').id,   plannedQuantity: 2   },
          { productId: p('MLL-ADF84').id, plannedQuantity: 5   },
          { productId: p('MLL-ADF96').id, plannedQuantity: 3   },
          { productId: p('SEL-PNT').id,   plannedQuantity: 3   },
          { productId: p('SEL-CAU').id,   plannedQuantity: 1   },
          { productId: p('SEL-PRM').id,   plannedQuantity: 2   },
          { productId: p('SEL-FLT').id,   plannedQuantity: 4   },
        ],
      },
    },
  })

  // ─── Purchase (Scott's invoice) ──────────────────────────────────────────
  await db.purchases.create({
    data: {
      purchaseCode: 'OC-SCOTT-001',
      supplierId: supplier.id,
      projectId: project.id,
      purchaseDate: '2026-04-18',
      status: 'pending',
      notes: "Scott's invoice - Project Patio Enclosure (Reynaldo Layout)",
      items: {
        create: [
          { productId: p('ALU-SGU7').id,  quantity: 1,    unitPrice: 0 },
          { productId: p('ALU-SMB24').id, quantity: 34,   unitPrice: 0 },
          { productId: p('ALU-SMB40').id, quantity: 14,   unitPrice: 0 },
          { productId: p('ALU-TUB44').id, quantity: 2,    unitPrice: 0 },
          { productId: p('ALU-OB30').id,  quantity: 12,   unitPrice: 0 },
          { productId: p('PAT-2230').id,  quantity: 4,    unitPrice: 0 },
          { productId: p('PAT-2220').id,  quantity: 1,    unitPrice: 0 },
          { productId: p('PAT-2330').id,  quantity: 10,   unitPrice: 0 },
          { productId: p('PAT-2430').id,  quantity: 19,   unitPrice: 0 },
          { productId: p('ALU-DJ224').id, quantity: 2,    unitPrice: 0 },
          { productId: p('ALU-DJ424').id, quantity: 2,    unitPrice: 0 },
          { productId: p('ALU-RCV15').id, quantity: 1,    unitPrice: 0 },
          { productId: p('ALU-ANG20').id, quantity: 3,    unitPrice: 0 },
          { productId: p('HRJ-GUS3').id,  quantity: 3,    unitPrice: 0 },
          { productId: p('HRJ-ANG3').id,  quantity: 60,   unitPrice: 0 },
          { productId: p('HRJ-BUT').id,   quantity: 6,    unitPrice: 0 },
          { productId: p('HRJ-BSW36').id, quantity: 8,    unitPrice: 0 },
          { productId: p('HRJ-PCT24').id, quantity: 4,    unitPrice: 0 },
          { productId: p('HRJ-PCT22').id, quantity: 4,    unitPrice: 0 },
          { productId: p('HRJ-GST').id,   quantity: 7,    unitPrice: 0 },
          { productId: p('HRJ-ECS7').id,  quantity: 4,    unitPrice: 0 },
          { productId: p('HRJ-DRP34').id, quantity: 2,    unitPrice: 0 },
          { productId: p('HRJ-ELA34').id, quantity: 3,    unitPrice: 0 },
          { productId: p('HRJ-ELB34').id, quantity: 2,    unitPrice: 0 },
          { productId: p('TOR-SMS10').id, quantity: 1150, unitPrice: 0 },
          { productId: p('TOR-TAP14').id, quantity: 120,  unitPrice: 0 },
          { productId: p('TOR-TEX1').id,  quantity: 1500, unitPrice: 0 },
          { productId: p('TOR-TEX3').id,  quantity: 150,  unitPrice: 0 },
          { productId: p('CAN-DSP34').id, quantity: 5,    unitPrice: 0 },
          { productId: p('PRT-RGL36').id, quantity: 2,    unitPrice: 0 },
          { productId: p('PRT-KIT').id,   quantity: 2,    unitPrice: 0 },
          { productId: p('MLL-ADF84').id, quantity: 5,    unitPrice: 0 },
          { productId: p('MLL-ADF96').id, quantity: 3,    unitPrice: 0 },
          { productId: p('SEL-PNT').id,   quantity: 3,    unitPrice: 0 },
          { productId: p('SEL-CAU').id,   quantity: 1,    unitPrice: 0 },
          { productId: p('SEL-PRM').id,   quantity: 2,    unitPrice: 0 },
          { productId: p('SEL-FLT').id,   quantity: 4,    unitPrice: 0 },
        ],
      },
    },
  })

  console.log('✅ Seed completado - Project Scott')
  console.log(`   ${products.length} productos`)
  console.log(`   1 almacén (3 racks, 9 estanterías)`)
  console.log(`   1 proveedor: Scott Materials Supply`)
  console.log(`   1 cliente: Reynaldo Layout`)
  console.log(`   1 proyecto: Project Scott - Patio Enclosure`)
  console.log(`   1 compra: OC-SCOTT-001 (${products.length - 1} ítems)`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
