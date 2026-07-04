import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'
import {
  decrementProjectDispatchQuantities,
  incrementProjectDispatchQuantities,
} from '@/lib/server/project-dispatch'
import { getConversionFactor, packagesToBase } from '@/lib/stock-units'
import type { Prisma } from '@prisma/client'

const PARTIAL_REMNANT_CHANGE_TYPE = 'partial_remnant'

class ReturnValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReturnValidationError'
  }
}

async function adjustReturnItemQuantity({
  projectId,
  returnId,
  itemId,
  returnStatus,
  quantityDelivered,
  quantityReturned,
}: {
  projectId: string
  returnId: string
  itemId: string
  returnStatus: string
  quantityDelivered: number
  quantityReturned: number
}) {
  if (!Number.isFinite(quantityDelivered) || quantityDelivered <= 0 || !Number.isFinite(quantityReturned) || quantityReturned <= 0) {
    throw new ReturnValidationError('La cantidad debe ser mayor que 0')
  }

  type RawItemForAdjust = {
    id: string
    return_id: string
    product_id_delivered: string
    product_id_returned: string | null
    quantity_delivered: number | bigint
    quantity_returned: number | bigint
    shelf_id_to: string | null
    change_type: string
    return_destination: string | null
  }

  // Lecturas y validación dentro de la transacción para que maxAllowed
  // no quede obsoleto frente a ajustes concurrentes.
  await db.$transaction(async (tx) => {
    const [item] = await tx.$queryRaw<RawItemForAdjust[]>`
      SELECT id, return_id, product_id_delivered, product_id_returned,
             quantity_delivered, quantity_returned, shelf_id_to, change_type, return_destination
      FROM return_items
      WHERE id = ${itemId} AND return_id = ${returnId}
    `
    if (!item) throw new ReturnValidationError('Item de devolucion no encontrado')
    if (item.return_destination === 'scrap') {
      throw new ReturnValidationError('La merma no se corrige desde aqui. Requiere un ajuste de inventario/gasto.')
    }

    const oldDelivered = Number(item.quantity_delivered)
    const oldReturned = Number(item.quantity_returned)
    if (returnStatus === 'completed' && (quantityDelivered < oldDelivered || quantityReturned < oldReturned)) {
      throw new ReturnValidationError('Una devolucion confirmada solo se puede aumentar. Para reducirla hace falta un ajuste de inventario.')
    }

    const [material] = await tx.projectMaterials.findMany({
      where: { projectId, productId: item.product_id_delivered },
      select: { dispatchedQuantity: true },
      take: 1,
    })
    if (!material) throw new ReturnValidationError('El material no esta en este proyecto')

    type PendingRow = { total: number | bigint | null }
    const [pendingRow] = await tx.$queryRaw<PendingRow[]>`
      SELECT COALESCE(SUM(ri.quantity_delivered), 0) as total
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE r.project_id = ${projectId}
        AND r.status = 'pending'
        AND ri.product_id_delivered = ${item.product_id_delivered}
        AND ri.id <> ${itemId}
    `

    const currentProjectDispatched = Number(material.dispatchedQuantity)
    const pendingOther = Number(pendingRow?.total ?? 0)
    const maxAllowed = returnStatus === 'completed'
      ? currentProjectDispatched + oldDelivered - pendingOther
      : currentProjectDispatched - pendingOther

    if (quantityDelivered > maxAllowed) {
      throw new ReturnValidationError(`Cantidad maxima disponible para corregir: ${Math.max(maxAllowed, 0)}`)
    }

    const deliveredDelta = quantityDelivered - oldDelivered
    const returnedDelta = quantityReturned - oldReturned
    const returnedProductId = item.product_id_returned ?? item.product_id_delivered

    await tx.$executeRaw`
      UPDATE return_items
      SET quantity_delivered = ${quantityDelivered},
          quantity_returned = ${quantityReturned},
          quantity = ${quantityReturned}
      WHERE id = ${itemId}
    `

    if (returnStatus !== 'completed') return

    if (returnedDelta > 0) {
      const returnedProduct = await tx.products.findUnique({
        where: { id: returnedProductId },
        select: { unitOfMeasure: true, unitQuantity: true },
      })
      const baseDelta = packagesToBase(returnedDelta, getConversionFactor(returnedProduct ?? {}))

      await tx.products.update({
        where: { id: returnedProductId },
        data: {
          currentStock: { increment: returnedDelta },
          currentBaseStock: { increment: baseDelta },
        },
      })

      if (item.shelf_id_to) {
        await tx.productShelfStock.upsert({
          where: { productId_shelfId: { productId: returnedProductId, shelfId: item.shelf_id_to } },
          create: { productId: returnedProductId, shelfId: item.shelf_id_to, quantity: returnedDelta, baseQuantity: baseDelta },
          update: { quantity: { increment: returnedDelta }, baseQuantity: { increment: baseDelta } },
        })
      } else {
        const existingRecepcion = await tx.recepcionItem.findFirst({
          where: { returnId, productId: returnedProductId },
          orderBy: { createdAt: 'asc' },
        })
        if (existingRecepcion) {
          await tx.recepcionItem.update({
            where: { id: existingRecepcion.id },
            data: { quantity: { increment: returnedDelta }, baseQuantity: { increment: baseDelta } },
          })
        } else {
          await tx.recepcionItem.create({
            data: { productId: returnedProductId, quantity: returnedDelta, baseQuantity: baseDelta, returnId },
          })
        }
      }
    }

    if (item.change_type !== PARTIAL_REMNANT_CHANGE_TYPE && deliveredDelta > 0) {
      await decrementProjectDispatchQuantities(tx, projectId, [
        { productId: item.product_id_delivered, quantity: deliveredDelta },
      ])
    } else if (item.change_type !== PARTIAL_REMNANT_CHANGE_TYPE && deliveredDelta < 0) {
      await incrementProjectDispatchQuantities(tx, projectId, [
        { productId: item.product_id_delivered, quantity: Math.abs(deliveredDelta) },
      ])
    }
  })
}

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
  return_destination: string
  scrap_charged: number | bigint
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
    returnDestination: r.return_destination,
    scrapCharged: Number(r.scrap_charged) === 1,
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

function firstNumber(value: unknown) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const numberValue = Number(match[0])
  return Number.isFinite(numberValue) ? numberValue : null
}

function lastDimensionalNumber(value: unknown) {
  const matches = String(value ?? '').match(/\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) return null
  const numberValue = Number(matches[matches.length - 1])
  return Number.isFinite(numberValue) ? numberValue : null
}

function detectOriginalSize(product: { unitQuantity: unknown; name: string; code: string }) {
  const unitSize = firstNumber(product.unitQuantity)
  if (unitSize && unitSize > 0) return unitSize
  return lastDimensionalNumber(product.name) ?? lastDimensionalNumber(product.code)
}

function formatSize(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, '')
}

function replaceLastSizeToken(value: string, originalSize: number, remnantSize: number) {
  const original = formatSize(originalSize)
  const remnant = formatSize(remnantSize)
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const dimensionPattern = new RegExp(`([xX])\\s*${escaped}(?=(?:['"]|\\b|\\s|$))`, 'g')

  let lastMatch: RegExpExecArray | null = null
  let match: RegExpExecArray | null
  while ((match = dimensionPattern.exec(value))) {
    lastMatch = match
  }

  if (lastMatch) {
    const start = lastMatch.index
    const end = start + lastMatch[0].length
    return `${value.slice(0, start)}${lastMatch[1]}${remnant}${value.slice(end)}`
  }

  const trailingPattern = new RegExp(`${escaped}(?=(?:['"]|\\b|\\s|$))(?!.*${escaped})`)
  if (trailingPattern.test(value)) return value.replace(trailingPattern, remnant)

  return `${value} ${remnant}'`
}

async function resolvePartialRemnantProduct(
  tx: Prisma.TransactionClient,
  productIdDelivered: string,
  partialRemnantSize: number,
) {
  const original = await tx.products.findUnique({
    where: { id: productIdDelivered },
  })

  if (!original) {
    throw new ReturnValidationError('Producto original no encontrado')
  }

  const originalSize = detectOriginalSize(original)
  if (!originalSize || originalSize <= 0) {
    throw new ReturnValidationError('No se pudo detectar el tamano original del producto')
  }

  if (!Number.isFinite(partialRemnantSize) || partialRemnantSize <= 0) {
    throw new ReturnValidationError('El tamano devuelto debe ser mayor que 0')
  }

  if (partialRemnantSize >= originalSize) {
    throw new ReturnValidationError('El tamano devuelto debe ser menor que el tamano original')
  }

  const remnantCode = replaceLastSizeToken(original.code, originalSize, partialRemnantSize)
  const existing = await tx.products.findUnique({ where: { code: remnantCode } })
  if (existing) return existing

  return tx.products.create({
    data: {
      code: remnantCode,
      name: replaceLastSizeToken(original.name, originalSize, partialRemnantSize),
      family: original.family,
      engineeringSection: original.engineeringSection,
      color: original.color,
      unitOfMeasure: 'pza',
      unitQuantity: formatSize(partialRemnantSize),
      minStock: original.minStock,
      currentStock: 0,
      referencePrice: original.referencePrice,
      preferredShelfId: original.preferredShelfId,
    },
  })
}

async function fetchItems(returnId: string) {
  const rows = await db.$queryRaw<ItemRow[]>`
    SELECT
      ri.id, ri.return_id, ri.product_id_delivered, ri.product_id_returned,
      ri.quantity_delivered, ri.quantity_returned, ri.shelf_id_from, ri.shelf_id_to,
      ri.change_type, ri.specification_delivered, ri.specification_returned, ri.notes,
      ri.return_destination, ri.scrap_charged,
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
        let productIdReturned: string | null = item.productIdReturned || null
        const quantityDelivered = Number(item.quantityDelivered ?? item.quantity ?? 0)
        const quantityReturned = Number(item.quantityReturned ?? quantityDelivered)
        const isPartialRemnant = item.isPartialRemnant === true || item.changeType === PARTIAL_REMNANT_CHANGE_TYPE
        const changeType = isPartialRemnant ? PARTIAL_REMNANT_CHANGE_TYPE : (item.changeType || 'full_return')
        let specDel = item.specificationDelivered || ''
        let specRet = item.specificationReturned || ''
        const itemNotes = item.notes || ''

        if (quantityDelivered <= 0 || quantityReturned <= 0) {
          throw new ReturnValidationError('La cantidad devuelta debe ser mayor que 0')
        }

        if (isPartialRemnant) {
          const partialRemnantSize = Number(item.partialRemnantSize)
          const remnantProduct = await resolvePartialRemnantProduct(
            tx,
            productIdDelivered,
            partialRemnantSize,
          )
          productIdReturned = remnantProduct.id
          const originalProduct = await tx.products.findUnique({ where: { id: productIdDelivered } })
          const originalSize = originalProduct ? detectOriginalSize(originalProduct) : null
          specDel = specDel || (originalSize ? `${formatSize(originalSize)} pies` : '')
          specRet = specRet || `${formatSize(partialRemnantSize)} pies`
        }

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
          const returnedProduct = await tx.products.findUnique({
            where: { id: returnedProductId },
            select: { unitOfMeasure: true, unitQuantity: true },
          })
          const baseQty = packagesToBase(quantityReturned, getConversionFactor(returnedProduct ?? {}))
          await tx.products.update({
            where: { id: returnedProductId },
            data: {
              currentStock: { increment: quantityReturned },
              currentBaseStock: { increment: baseQty },
            },
          })
          await tx.recepcionItem.create({
            data: { productId: returnedProductId, quantity: quantityReturned, baseQuantity: baseQty, returnId },
          })
          if (changeType !== PARTIAL_REMNANT_CHANGE_TYPE) {
            dispatchAdjustments.push({ productId: productIdDelivered, quantity: quantityDelivered })
          }
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
    if (error instanceof ReturnValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear devolucion' }, { status: 500 })
  }
}

// ── Helpers para Merma ────────────────────────────────────────────────────────

/**
 * Resuelve el precio unitario de un producto para calcular el costo de Merma.
 * Prioriza: PurchaseItems del proyecto (promedio ponderado) → promedio global
 * → referencePrice del producto. Mismo orden que el invoice PDF.
 */
async function resolveMermaUnitPrice(
  productId: string,
  projectId: string,
  fallbackReferencePrice: number,
): Promise<number> {
  const projectItems = await db.purchaseItems.findMany({
    where: {
      productId,
      unitPrice: { gt: 0 },
      purchase: { status: { not: 'cancelled' }, projectId },
    },
    select: { quantity: true, unitPrice: true },
  })
  let totalQty = 0
  let totalCost = 0
  for (const it of projectItems) {
    const q = Number(it.quantity)
    const p = Number(it.unitPrice)
    if (q > 0 && p > 0) { totalQty += q; totalCost += q * p }
  }
  if (totalQty > 0) return totalCost / totalQty

  const globalItems = await db.purchaseItems.findMany({
    where: { productId, unitPrice: { gt: 0 }, purchase: { status: { not: 'cancelled' } } },
    select: { quantity: true, unitPrice: true },
  })
  let gQty = 0, gCost = 0
  for (const it of globalItems) {
    const q = Number(it.quantity); const p = Number(it.unitPrice)
    if (q > 0 && p > 0) { gQty += q; gCost += q * p }
  }
  if (gQty > 0) return gCost / gQty

  return fallbackReferencePrice || 0
}

const MERMA_CATEGORY_NAME = 'Merma'

async function ensureMermaCategory(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
): Promise<string> {
  const existing = await tx.expenseCategories.findFirst({ where: { name: MERMA_CATEGORY_NAME } })
  if (existing) return existing.id
  const created = await tx.expenseCategories.create({
    data: { name: MERMA_CATEGORY_NAME, color: 'rose' },
  })
  return created.id
}

function todayLocalKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

// ── PATCH (confirm) ────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { action, returnId, itemId, quantityDelivered, quantityReturned, placements } = body as {
      action?: string
      returnId?: string
      itemId?: string
      quantityDelivered?: number
      quantityReturned?: number
      placements?: {
        itemId: string
        shelfId?: string | null
        destination?: 'shelf' | 'reception' | 'scrap'
        applyCost?: boolean
      }[]
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

    if (action === 'adjust_item_quantity') {
      if (!itemId) {
        return NextResponse.json({ error: 'itemId es obligatorio' }, { status: 400 })
      }

      await adjustReturnItemQuantity({
        projectId,
        returnId,
        itemId,
        returnStatus: ret.status,
        quantityDelivered: Number(quantityDelivered),
        quantityReturned: Number(quantityReturned ?? quantityDelivered),
      })

      const rows = await db.$queryRaw<ReturnRow[]>`
        SELECT id, project_id, return_date, notes, status, created_at
        FROM returns WHERE id = ${returnId}
      `
      return NextResponse.json(formatReturn(rows[0], await fetchItems(returnId)))
    }

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
      change_type: string
    }
    const itemRows = await db.$queryRaw<RawItem[]>`
      SELECT id, product_id_delivered, product_id_returned, quantity_delivered, quantity_returned, change_type
      FROM return_items WHERE return_id = ${returnId}
    `

    type Placement = { destination: 'shelf' | 'reception' | 'scrap'; shelfId: string | null; applyCost: boolean }
    const placementMap = new Map<string, Placement>()
    if (Array.isArray(placements)) {
      for (const p of placements) {
        if (!p?.itemId) continue
        // Compat: legacy callers solo enviaban shelfId. Si no viene destination,
        // inferimos: shelfId truthy → 'shelf', null/empty → 'reception'.
        const inferred: Placement['destination'] = p.destination
          ?? (p.shelfId ? 'shelf' : 'reception')
        placementMap.set(p.itemId, {
          destination: inferred,
          shelfId: inferred === 'shelf' ? (p.shelfId ?? null) : null,
          applyCost: inferred === 'scrap' ? !!p.applyCost : false,
        })
      }
    }

    // Pre-resolve unit prices for any items going to scrap with applyCost.
    const scrapPriceByProduct = new Map<string, number>()
    for (const item of itemRows) {
      const pl = placementMap.get(item.id)
      if (pl?.destination === 'scrap' && pl.applyCost) {
        const returnedProductId = item.product_id_returned ?? item.product_id_delivered
        if (!scrapPriceByProduct.has(returnedProductId)) {
          const product = await db.products.findUnique({
            where: { id: returnedProductId },
            select: { referencePrice: true },
          })
          const price = await resolveMermaUnitPrice(
            returnedProductId,
            projectId,
            product?.referencePrice ?? 0,
          )
          scrapPriceByProduct.set(returnedProductId, price)
        }
      }
    }

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE returns SET status = 'completed' WHERE id = ${returnId}`
      const dispatchAdjustments: { productId: string; quantity: number }[] = []
      let mermaCategoryId: string | null = null

      for (const item of itemRows) {
        const pl = placementMap.get(item.id) ?? { destination: 'reception' as const, shelfId: null, applyCost: false }
        const returnedProductId = item.product_id_returned ?? item.product_id_delivered
        const qty = Number(item.quantity_returned)
        const returnedProduct = await tx.products.findUnique({
          where: { id: returnedProductId },
          select: { unitOfMeasure: true, unitQuantity: true },
        })
        const baseQty = packagesToBase(qty, getConversionFactor(returnedProduct ?? {}))

        if (pl.destination === 'scrap') {
          // Merma: NO incrementa currentStock, NO toca shelf stock, NO crea RecepcionItem.
          // Solo marca el item y opcionalmente crea un ProjectExpense.
          await tx.$executeRaw`
            UPDATE return_items
            SET return_destination = 'scrap',
                scrap_charged = ${pl.applyCost ? 1 : 0}
            WHERE id = ${item.id}
          `

          if (pl.applyCost) {
            if (!mermaCategoryId) mermaCategoryId = await ensureMermaCategory(tx)
            const unitPrice = scrapPriceByProduct.get(returnedProductId) ?? 0
            const amount = qty * unitPrice
            const product = await tx.products.findUnique({
              where: { id: returnedProductId },
              select: { name: true, code: true },
            })
            await tx.projectExpenses.create({
              data: {
                projectId,
                categoryId: mermaCategoryId,
                description: `Merma — ${product?.name ?? returnedProductId} × ${qty}`,
                amount,
                expenseDate: todayLocalKey(),
                notes: `Auto-generado por devolución (item ${item.id})`,
              },
            })
          }
        } else if (pl.destination === 'shelf' && pl.shelfId) {
          await tx.products.update({
            where: { id: returnedProductId },
            data: {
              currentStock: { increment: qty },
              currentBaseStock: { increment: baseQty },
            },
          })
          await tx.productShelfStock.upsert({
            where: { productId_shelfId: { productId: returnedProductId, shelfId: pl.shelfId } },
            create: { productId: returnedProductId, shelfId: pl.shelfId, quantity: qty, baseQuantity: baseQty },
            update: { quantity: { increment: qty }, baseQuantity: { increment: baseQty } },
          })
          await tx.$executeRaw`
            UPDATE return_items SET shelf_id_to = ${pl.shelfId} WHERE id = ${item.id}
          `
        } else {
          // reception
          await tx.products.update({
            where: { id: returnedProductId },
            data: {
              currentStock: { increment: qty },
              currentBaseStock: { increment: baseQty },
            },
          })
          await tx.recepcionItem.create({
            data: { productId: returnedProductId, quantity: qty, baseQuantity: baseQty, returnId },
          })
        }

        if (item.change_type !== PARTIAL_REMNANT_CHANGE_TYPE) {
          dispatchAdjustments.push({
            productId: item.product_id_delivered,
            quantity: Number(item.quantity_delivered),
          })
        }
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
    if (error instanceof ReturnValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al confirmar devolucion' }, { status: 500 })
  }
}
