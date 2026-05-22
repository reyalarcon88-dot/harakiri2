import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Project statuses that have already consumed their materials — exclude from outflows
const TERMINAL_STATUSES = ['cancelled', 'finished']
const FAVORITE_RESERVE_MINIMUM = 10
const LOOKAHEAD_PROJECTS = 25
const REORDER_CYCLE_DAYS = 15

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
    const favoriteIds = searchParams
      .get('favoriteIds')
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? []
    const favoriteIdSet = new Set(favoriteIds)

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const projectFilter =
      mode === 'by_date' && targetDate
        ? {
            status: { notIn: TERMINAL_STATUSES },
            OR: [{ endDate: null }, { endDate: { lte: targetDate } }],
          }
        : { status: { notIn: TERMINAL_STATUSES } }

    const [products, recepcionGroups, activeMaterials, pendingItems, lookaheadProjects] = await Promise.all([
      db.products.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          family: true,
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

      db.projects.findMany({
        where: { status: { notIn: TERMINAL_STATUSES } },
        select: {
          id: true,
          name: true,
          projectDate: true,
          startDate: true,
          endDate: true,
          materials: {
            select: {
              productId: true,
              plannedQuantity: true,
              dispatchedQuantity: true,
            },
          },
        },
        orderBy: [
          { endDate: 'asc' },
          { startDate: 'asc' },
          { projectDate: 'asc' },
          { createdAt: 'asc' },
        ],
        take: LOOKAHEAD_PROJECTS,
      }),
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

    const lookaheadDemandByProduct = new Map<string, number>()
    const lookaheadProjectsByProduct = new Map<
      string,
      { id: string; name: string; needed: number; date: string | null }[]
    >()
    for (const project of lookaheadProjects) {
      const projectDate = project.startDate || project.endDate || project.projectDate || null
      for (const mat of project.materials) {
        const remaining = Math.max(0, toNumber(mat.plannedQuantity) - toNumber(mat.dispatchedQuantity))
        if (remaining === 0) continue
        lookaheadDemandByProduct.set(
          mat.productId,
          (lookaheadDemandByProduct.get(mat.productId) ?? 0) + remaining,
        )
        const list = lookaheadProjectsByProduct.get(mat.productId) ?? []
        list.push({
          id: project.id,
          name: project.name,
          needed: remaining,
          date: projectDate,
        })
        lookaheadProjectsByProduct.set(mat.productId, list)
      }
    }

    // ── Compute forecast per product ─────────────────────────────────────────
    const items = products.flatMap((product) => {
      const shelfStock = product.shelfStocks.reduce((s, ss) => s + toNumber(ss.quantity), 0)
      const recepcionStock = recepcionByProduct.get(product.id) ?? 0
      const availableNow = shelfStock + recepcionStock
      const pendingPurchases = pendingByProduct.get(product.id) ?? 0
      const committedOutflows = outflowsByProduct.get(product.id) ?? 0
      const isFavorite = favoriteIdSet.has(product.id)
      const nextProjectsDemand = lookaheadDemandByProduct.get(product.id) ?? 0
      const favoriteReserveMinimum = isFavorite ? FAVORITE_RESERVE_MINIMUM : 0

      // Skip products with no current activity (nothing to forecast)
      if (!isFavorite && availableNow === 0 && pendingPurchases === 0 && committedOutflows === 0) return []

      const projectedStock = availableNow + pendingPurchases - committedOutflows
      const shortage = Math.max(0, -projectedStock)
      const favoriteRecommendedOrder = isFavorite
        ? Math.max(0, nextProjectsDemand + favoriteReserveMinimum - availableNow - pendingPurchases)
        : 0
      const recommendedOrder = Math.max(shortage, favoriteRecommendedOrder)

      return [
        {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          family: product.family,
          unitOfMeasure: product.unitOfMeasure,
          shelfStock,
          recepcionStock,
          availableNow,
          pendingPurchases,
          committedOutflows,
          nextProjectsDemand,
          nextProjectsCount: lookaheadProjectsByProduct.get(product.id)?.length ?? 0,
          favoriteReserveMinimum,
          projectedStock,
          shortage,
          recommendedOrder,
          projectedAfterLookahead: availableNow + pendingPurchases - nextProjectsDemand,
          projectedAfterReserve: availableNow + pendingPurchases - nextProjectsDemand - favoriteReserveMinimum,
          affectedProjects: projectsByProduct.get(product.id) ?? [],
          lookaheadProjects: lookaheadProjectsByProduct.get(product.id) ?? [],
        },
      ]
    })

    // Shortages first, then alphabetical
    items.sort((a, b) => {
      if ((a.shortage > 0) !== (b.shortage > 0)) return a.shortage > 0 ? -1 : 1
      return a.productName.localeCompare(b.productName)
    })

    const shortageCount = items.filter((i) => i.shortage > 0).length
    const favoriteRecommendations = items
      .filter((item) => favoriteIdSet.has(item.productId))
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        family: item.family,
        unitOfMeasure: item.unitOfMeasure,
        availableNow: item.availableNow,
        pendingPurchases: item.pendingPurchases,
        nextProjectsDemand: item.nextProjectsDemand,
        nextProjectsCount: item.nextProjectsCount,
        reserveMinimum: item.favoriteReserveMinimum,
        projectedAfterReserve: item.projectedAfterReserve,
        recommendedOrder: item.recommendedOrder,
        projects: item.lookaheadProjects,
        reason:
          item.recommendedOrder > 0
            ? `Order ${item.recommendedOrder} to cover the next ${LOOKAHEAD_PROJECTS} projects and keep ${FAVORITE_RESERVE_MINIMUM} reserved.`
            : `Covered for the next ${LOOKAHEAD_PROJECTS} projects with ${FAVORITE_RESERVE_MINIMUM} reserved.`,
      }))
      .sort((a, b) => {
        if ((a.recommendedOrder > 0) !== (b.recommendedOrder > 0)) return a.recommendedOrder > 0 ? -1 : 1
        if (a.recommendedOrder !== b.recommendedOrder) return b.recommendedOrder - a.recommendedOrder
        return a.productName.localeCompare(b.productName)
      })

    return NextResponse.json({
      items,
      recommendations: {
        rules: {
          favoriteReserveMinimum: FAVORITE_RESERVE_MINIMUM,
          lookaheadProjects: LOOKAHEAD_PROJECTS,
          reorderCycleDays: REORDER_CYCLE_DAYS,
        },
        projectsEvaluated: lookaheadProjects.length,
        nextReviewDate: new Date(Date.now() + REORDER_CYCLE_DAYS * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        favoriteCount: favoriteIds.length,
        orderCount: favoriteRecommendations.filter((item) => item.recommendedOrder > 0).length,
        totalRecommendedUnits: favoriteRecommendations.reduce((sum, item) => sum + item.recommendedOrder, 0),
        items: favoriteRecommendations,
      },
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
