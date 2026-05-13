import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type ReserveRow = {
  id: string
  product_id: string
  shelf_id: string
  quantity: string | number
  reserve_quantity: string | number
  is_reserve_shelf: number
  reserve_minimum: string | number
  reserve_notes: string
  product_name: string
  product_code: string
  shelf_name: string
  rack_name: string
  warehouse_name: string
}

function fmt(r: ReserveRow) {
  const qty = Number(r.quantity)
  const reserveQty = Number(r.reserve_quantity || 0)
  const isReserveShelf = Boolean(r.is_reserve_shelf)
  return {
    id: r.id,
    productId: r.product_id,
    shelfId: r.shelf_id,
    quantity: qty,
    reserveQuantity: reserveQty,
    isReserveShelf,
    reserveMinimum: Number(r.reserve_minimum || 0),
    reserveNotes: String(r.reserve_notes || ''),
    availableQuantity: isReserveShelf ? 0 : Math.max(qty - reserveQty, 0),
    product: { name: r.product_name, code: r.product_code },
    location: `${r.warehouse_name} / ${r.rack_name} / ${r.shelf_name}`,
  }
}

// GET /api/inventory/reserve — list all shelf stocks with reserve info (optionally filter by productId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId') || ''
    const onlyReserved = searchParams.get('onlyReserved') === 'true'

    const rows = await db.$queryRaw<ReserveRow[]>`
      SELECT
        pss.id, pss.product_id, pss.shelf_id,
        pss.quantity, pss.reserve_quantity, pss.is_reserve_shelf,
        pss.reserve_minimum, pss.reserve_notes,
        p.name as product_name, p.code as product_code,
        s.name as shelf_name, r.name as rack_name, w.name as warehouse_name
      FROM product_shelf_stock pss
      JOIN products p ON pss.product_id = p.id
      JOIN shelves s ON pss.shelf_id = s.id
      JOIN racks r ON s.rack_id = r.id
      JOIN warehouses w ON r.warehouse_id = w.id
      WHERE (${productId} = '' OR pss.product_id = ${productId})
        AND (${onlyReserved ? 1 : 0} = 0 OR pss.reserve_quantity > 0 OR pss.is_reserve_shelf = 1)
      ORDER BY p.name ASC, w.name ASC, r.name ASC, s.name ASC
    `
    return NextResponse.json(rows.map(fmt))
  } catch (error) {
    console.error('[reserve GET]', error)
    return NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 })
  }
}

// PATCH /api/inventory/reserve — update reserve settings for a shelf stock entry
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { shelfStockId, reserveQuantity, isReserveShelf, reserveMinimum, reserveNotes } = body as {
      shelfStockId: string
      reserveQuantity?: number
      isReserveShelf?: boolean
      reserveMinimum?: number
      reserveNotes?: string
    }

    if (!shelfStockId) {
      return NextResponse.json({ error: 'shelfStockId es obligatorio' }, { status: 400 })
    }

    type Row = { id: string; quantity: string | number; reserve_quantity: string | number; is_reserve_shelf: number; reserve_minimum: string | number; reserve_notes: string }
    const [current] = await db.$queryRaw<Row[]>`
      SELECT id, quantity, reserve_quantity, is_reserve_shelf, reserve_minimum, reserve_notes
      FROM product_shelf_stock WHERE id = ${shelfStockId}
    `
    if (!current) {
      return NextResponse.json({ error: 'Stock no encontrado' }, { status: 404 })
    }

    const newReserveQty = reserveQuantity !== undefined ? Math.max(0, reserveQuantity) : Number(current.reserve_quantity || 0)
    const newIsReserve = isReserveShelf !== undefined ? (isReserveShelf ? 1 : 0) : Number(current.is_reserve_shelf)
    const newMinimum = reserveMinimum !== undefined ? Math.max(0, reserveMinimum) : Number(current.reserve_minimum || 0)
    const newNotes = reserveNotes !== undefined ? reserveNotes : String(current.reserve_notes || '')
    const maxQty = Number(current.quantity)

    if (newReserveQty > maxQty) {
      return NextResponse.json({ error: `La reserva (${newReserveQty}) no puede superar el stock total (${maxQty})` }, { status: 400 })
    }

    await db.$executeRaw`
      UPDATE product_shelf_stock
      SET reserve_quantity = ${newReserveQty},
          is_reserve_shelf = ${newIsReserve},
          reserve_minimum = ${newMinimum},
          reserve_notes = ${newNotes}
      WHERE id = ${shelfStockId}
    `

    type FullRow = ReserveRow
    const [updated] = await db.$queryRaw<FullRow[]>`
      SELECT
        pss.id, pss.product_id, pss.shelf_id,
        pss.quantity, pss.reserve_quantity, pss.is_reserve_shelf,
        pss.reserve_minimum, pss.reserve_notes,
        p.name as product_name, p.code as product_code,
        s.name as shelf_name, r.name as rack_name, w.name as warehouse_name
      FROM product_shelf_stock pss
      JOIN products p ON pss.product_id = p.id
      JOIN shelves s ON pss.shelf_id = s.id
      JOIN racks r ON s.rack_id = r.id
      JOIN warehouses w ON r.warehouse_id = w.id
      WHERE pss.id = ${shelfStockId}
    `
    return NextResponse.json(fmt(updated))
  } catch (error) {
    console.error('[reserve PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 })
  }
}
