import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'
import { decrementProjectDispatchQuantities } from '@/lib/server/project-dispatch'

// ── Raw row types from SQLite ──────────────────────────────────────────────────

type ReturnRow = {
  id: string
  project_id: string
  return_date: string
  notes: string
  status: string
  created_at: string
}

type ItemRow = {
  id: string
  return_id: string
  product_id_delivered: string
  product_id_returned: string | null
  quantity_delivered: number | bigint
  quantity_returned: number | bigint
  shelf_id_from: string | null
  shelf_id_to: string | null
  change_type: string
  specification_delivered: string
  specification_returned: string
  notes: string
  pd_id: string; pd_name: string; pd_code: string
  pr_id: string | null; pr_name: string | null; pr_code: string | null
  sf_id: string | null; sf_name: string | null
  sfr_id: string | null; sfr_name: string | null
  sfw_id: string | null; sfw_name: string | null
  st_id: string | null; st_name: string | null
  str_id: string | null; str_name: string | null
  stw_id: string | null; stw_name: string | null
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function formatItem(r: ItemRow) {
  return {
    id: r.id,
    returnId: r.return_id,
    productIdDelivered: r.product_id_delivered,
    productIdReturned: r.product_id_returned,
    quantityDelivered: Number(r.quantity_delivered),
    quantityReturned: Number(r.quantity_returned),
    shelfIdFrom: r.shelf_id_from,
    shelfIdTo: r.shelf_id_to,
    changeType: r.change_type,
    specificationDelivered: r.specification_delivered,
    specificationReturned: r.specification_returned,
    notes: r.notes,
    productDelivered: { id: r.pd_id, name: r.pd_name, code: r.pd_code },
    productReturned: r.pr_id ? { id: r.pr_id, name: r.pr_name!, code: r.pr_code! } : null,
    shelfFrom: r.sf_id ? {
      id: r.sf_id, name: r.sf_name!,
      rack: { id: r.sfr_id!, name: r.sfr_name!, warehouse: { id: r.sfw_id!, name: r.sfw_name! } },
    } : null,
    shelfTo: r.st_id ? {
      id: r.st_id, name: r.st_name!,
      rack: { id: r.str_id!, name: r.str_name!, warehouse: { id: r.stw_id!, name: r.stw_name! } },
    } : null,
  }
}

function formatReturn(r: ReturnRow, items: ReturnType<typeof formatItem>[]) {
  return {
    id: r.id,
    projectId: r.project_id,
    returnDate: r.return_date,
    notes: r.notes,
    status: r.status,
    items,
  }
}

async function fetchItems(returnId: string) {
  const rows = await db.$queryRaw<ItemRow[]>`
    SELECT
      ri.id, ri.return_id, ri.product_id_delivered, ri.product_id_returned,
      ri.quantity_delivered, ri.quantity_returned, ri.shelf_id_from, ri.shelf_id_to,
      ri.change_type, ri.specification_delivered, ri.specification_returned, ri.notes,
      pd.id as pd_id, pd.name as pd_name, pd.code as pd_code,
      pr.id as pr_id, pr.name as pr_name, pr.code as pr_code,
      sf.id as sf_id, sf.name as sf_name,
      sfr.id as sfr_id, sfr.name as sfr_name,
      sfw.id as sfw_id, sfw.name as sfw_name,
      st.id as st_id, st.name as st_name,
      str2.id as str_id, str2.name as str_name,
      stw.id as stw_id, stw.name as stw_name
    FROM return_items ri
    JOIN products pd ON ri.product_id_delivered = pd.id
    LEFT JOIN products pr ON ri.product_id_returned = pr.id
    LEFT JOIN shelves sf ON ri.shelf_id_from = sf.id
    LEFT JOIN racks sfr ON sf.rack_id = sfr.id
    LEFT JOIN warehouses sfw ON sfr.warehouse_id = sfw.id
    LEFT JOIN shelves st ON ri.shelf_id_to = st.id
    LEFT JOIN racks str2 ON st.rack_id = str2.id
    LEFT JOIN warehouses stw ON str2.warehouse_id = stw.id
    WHERE ri.return_id = ${returnId}
    ORDER BY ri.created_at ASC
  `
  return rows.map(formatItem)
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await db.$queryRaw<ReturnRow[]>`
      SELECT id, project_id, return_date, notes, status, created_at
      FROM returns WHERE project_id = ${id}
      ORDER BY created_at DESC
    `
    const returns = await Promise.all(
      rows.map(async (r) => formatReturn(r, await fetchItems(r.id)))
    )
    return NextResponse.json(returns)
  } catch (error) {
    console.error('[returns GET]', error)
    return NextResponse.json({ error: 'Error al listar devoluciones' }, { status: 500 })
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { returnDate, notes, status, items } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Los items son obligatorios' }, { status: 400 })
    }

    const returnId = randomUUID()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()
    const effectiveStatus = status || 'pending'

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO returns (id, project_id, return_date, notes, status, created_at)
        VALUES (${returnId}, ${id}, ${returnDate || today}, ${notes || ''}, ${effectiveStatus}, ${now})
      `

      const dispatchAdjustments: { productId: string; quantity: number }[] = []

      for (const item of items) {
        const itemId = randomUUID()
        const productIdDelivered = String(item.productIdDelivered || item.productId)
        const productIdReturned: string | null = item.productIdReturned || null
        const quantityDelivered = Number(item.quantityDelivered ?? item.quantity ?? 0)
        const quantityReturned = Number(item.quantityReturned ?? quantityDelivered)
        const changeType = item.changeType || 'full_return'
        const specDel = item.specificationDelivered || ''
        const specRet = item.specificationReturned || ''
        const itemNotes = item.notes || ''

        await tx.$executeRaw`
          INSERT INTO return_items (
            id, return_id, product_id, shelf_id, quantity,
            product_id_delivered, product_id_returned,
            quantity_delivered, quantity_returned, change_type,
            specification_delivered, specification_returned, notes, created_at
          ) VALUES (
            ${itemId}, ${returnId}, ${productIdDelivered}, ${null}, ${quantityReturned},
            ${productIdDelivered}, ${productIdReturned},
            ${quantityDelivered}, ${quantityReturned}, ${changeType},
            ${specDel}, ${specRet}, ${itemNotes}, ${now}
          )
        `

        if (effectiveStatus === 'completed') {
          const returnedProductId = productIdReturned ?? productIdDelivered
          await tx.products.update({
            where: { id: returnedProductId },
            data: { currentStock: { increment: quantityReturned } },
          })
          await tx.recepcionItem.create({
            data: { productId: returnedProductId, quantity: quantityReturned, returnId },
          })
          dispatchAdjustments.push({ productId: productIdDelivered, quantity: quantityDelivered })
        }
      }

      if (effectiveStatus === 'completed') {
        await decrementProjectDispatchQuantities(tx, id, dispatchAdjustments)
      }
    })

    const rows = await db.$queryRaw<ReturnRow[]>`
      SELECT id, project_id, return_date, notes, status, created_at
      FROM returns WHERE id = ${returnId}
    `
    return NextResponse.json(formatReturn(rows[0], await fetchItems(returnId)), { status: 201 })
  } catch (error) {
    console.error('[returns POST]', error)
    return NextResponse.json({ error: 'Error al crear devolucion' }, { status: 500 })
  }
}

// ── PATCH (confirm) ────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { returnId, placements } = body as {
      returnId?: string
      placements?: { itemId: string; shelfId?: string | null }[]
    }

    if (!returnId) {
      return NextResponse.json({ error: 'returnId es obligatorio' }, { status: 400 })
    }

    type CheckRow = { id: string; project_id: string; status: string }
    const [ret] = await db.$queryRaw<CheckRow[]>`
      SELECT id, project_id, status FROM returns WHERE id = ${returnId}
    `
    if (!ret) return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })
    if (ret.project_id !== projectId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    if (ret.status === 'completed') {
      const rows = await db.$queryRaw<ReturnRow[]>`
        SELECT id, project_id, return_date, notes, status, created_at
        FROM returns WHERE id = ${returnId}
      `
      return NextResponse.json(formatReturn(rows[0], await fetchItems(returnId)))
    }

    type RawItem = {
      id: string
      product_id_delivered: string
      product_id_returned: string | null
      quantity_delivered: number | bigint
      quantity_returned: number | bigint
    }
    const itemRows = await db.$queryRaw<RawItem[]>`
      SELECT id, product_id_delivered, product_id_returned, quantity_delivered, quantity_returned
      FROM return_items WHERE return_id = ${returnId}
    `

    const placementMap = new Map<string, string | null>()
    if (Array.isArray(placements)) {
      for (const p of placements) {
        if (p?.itemId) placementMap.set(p.itemId, p.shelfId ?? null)
      }
    }

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE returns SET status = 'completed' WHERE id = ${returnId}`
      const dispatchAdjustments: { productId: string; quantity: number }[] = []

      for (const item of itemRows) {
        const destShelfId = placementMap.get(item.id) ?? null
        const returnedProductId = item.product_id_returned ?? item.product_id_delivered
        const qty = Number(item.quantity_returned)

        await tx.products.update({
          where: { id: returnedProductId },
          data: { currentStock: { increment: qty } },
        })

        if (destShelfId) {
          await tx.productShelfStock.upsert({
            where: { productId_shelfId: { productId: returnedProductId, shelfId: destShelfId } },
            create: { productId: returnedProductId, shelfId: destShelfId, quantity: qty },
            update: { quantity: { increment: qty } },
          })
          await tx.$executeRaw`
            UPDATE return_items SET shelf_id_to = ${destShelfId} WHERE id = ${item.id}
          `
        } else {
          await tx.recepcionItem.create({
            data: { productId: returnedProductId, quantity: qty, returnId },
          })
        }

        dispatchAdjustments.push({
          productId: item.product_id_delivered,
          quantity: Number(item.quantity_delivered),
        })
      }

      await decrementProjectDispatchQuantities(tx, projectId, dispatchAdjustments)
    })

    const rows = await db.$queryRaw<ReturnRow[]>`
      SELECT id, project_id, return_date, notes, status, created_at
      FROM returns WHERE id = ${returnId}
    `
    return NextResponse.json(formatReturn(rows[0], await fetchItems(returnId)))
  } catch (error) {
    console.error('[returns PATCH]', error)
    return NextResponse.json({ error: 'Error al confirmar devolucion' }, { status: 500 })
  }
}
