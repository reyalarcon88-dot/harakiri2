import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Project statuses that have already consumed their materials — exclude from outflows
const TERMINAL_STATUSES = ['cancelled', 'finished']

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get('date') ?? ''
    // 'all'      → include all non-terminal projects regardless of end date
    // 'by_date'  → only include projects whose endDate ≤ targetDate (or no endDate)
    const mode = (searchParams.get('mode') ?? 'all') as 'all' | 'by_date'
    const includePending = searchParams.get('includePending') !== 'false'

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const projectFilter =
      mode === 'by_date' && targetDate
        ? {
            status: { notIn: TERMINAL_STATUSES },
            OR: [{ endDate: null }, { endDate: { lte: targetDate } }],
          }
        : { status: { notIn: TERMINAL_STATUSES } }

    const [products, recepcionGroups, activeMaterials, pendingItems] = await Promise.all([
      db.products.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          unitOfMeasure: true,
          shelfStocks: { select: { quantity: true } },
        },
        orderBy: { name: 'asc' },
      }),

      // Items currently sitting in the receiving area (not yet on a shelf)
      db.recepcionItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
      }),

      // Remaining quantities required by active projects
      db.projectMaterials.findMany({
        where: { project: projectFilter },
        select: {
          productId: true,
          plannedQuantity: true,
          dispatchedQuantity: true,
          project: { select: { id: true, name: true, endDate: true } },
        },
      }),

      // Purchase orders already in the system but not yet received
      includePending
        ? db.purchaseItems.findMany({
            where: { purchase: { status: { notIn: ['received', 'cancelled'] } } },
            select: { productId: true, quantity: true },
          })
        : ([] as { productId: string; quantity: number }[]),
    ])

    // ── Build lookup maps ────────────────────────────────────────────────────
    const recepcionByProduct = new Map<string, number>()
    for (const r of recepcionGroups) {
      recepcionByProduct.set(r.productId, toNumber(r._sum.quantity))
    }

    const pendingByProduct = new Map<string, number>()
    for (const pi of pendingItems) {
      pendingByProduct.set(pi.productId, (pendingByProduct.get(pi.productId) ?? 0) + toNumber(pi.quantity))
    }

    const outflowsByProduct = new Map<string, number>()
    const projectsByProduct = new Map<
      string,
      { id: string; name: string; needed: number; endDate: string | null }[]
    >()
    for (const mat of activeMaterials) {
      const remaining = Math.max(0, toNumber(mat.plannedQuantity) - toNumber(mat.dispatchedQuantity))
      if (remaining === 0) continue
      outflowsByProduct.set(mat.productId, (outflowsByProduct.get(mat.productId) ?? 0) + remaining)
      const list = projectsByProduct.get(mat.productId) ?? []
      list.push({
        id: mat.project.id,
        name: mat.project.name,
        needed: remaining,
        endDate: mat.project.endDate ?? null,
      })
      projectsByProduct.set(mat.productId, list)
    }

    // ── Compute forecast per product ─────────────────────────────────────────
    const items = products.flatMap((product) => {
      const shelfStock = product.shelfStocks.reduce((s, ss) => s + toNumber(ss.quantity), 0)
      const recepcionStock = recepcionByProduct.get(product.id) ?? 0
      const availableNow = shelfStock + recepcionStock
      const pendingPurchases = pendingByProduct.get(product.id) ?? 0
      const committedOutflows = outflowsByProduct.get(product.id) ?? 0

      // Skip products with no current activity (nothing to forecast)
      if (availableNow === 0 && pendingPurchases === 0 && committedOutflows === 0) return []

      const projectedStock = availableNow + pendingPurchases - committedOutflows
      const shortage = Math.max(0, -projectedStock)

      return [
        {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          unitOfMeasure: product.unitOfMeasure,
          shelfStock,
          recepcionStock,
          availableNow,
          pendingPurchases,
          committedOutflows,
          projectedStock,
          shortage,
          affectedProjects: projectsByProduct.get(product.id) ?? [],
        },
      ]
    })

    // Shortages first, then alphabetical
    items.sort((a, b) => {
      if ((a.shortage > 0) !== (b.shortage > 0)) return a.shortage > 0 ? -1 : 1
      return a.productName.localeCompare(b.productName)
    })

    const shortageCount = items.filter((i) => i.shortage > 0).length

    return NextResponse.json({
      items,
      summary: {
        targetDate,
        mode,
        includePending,
        totalProducts: items.length,
        shortageCount,
        okCount: items.length - shortageCount,
      },
    })
  } catch (error) {
    console.error('GET /api/inventory/forecast error:', error)
    return NextResponse.json({ error: 'Failed to compute forecast' }, { status: 500 })
  }
}
