import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function toNumber(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function inRange(value: string | null | undefined, start: string, end: string) {
  if (!value) return false
  const key = value.includes('T') ? value.slice(0, 10) : value
  return key >= start && key <= end
}

function shiftToPrevRange(start: string, end: string): { start: string; end: string } {
  const startDate = parseISODate(start)
  const endDate = parseISODate(end)
  if (!startDate || !endDate) return { start, end }
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
  const prevEnd = new Date(startDate)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (days - 1))
  return { start: toDateKey(prevStart), end: toDateKey(prevEnd) }
}

function deltaPct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 100)
}

type DispatchWithRelations = Awaited<ReturnType<typeof loadDispatches>>[number]
type ReturnWithRelations = Awaited<ReturnType<typeof loadReturns>>[number]

async function loadDispatches(start: string, end: string, projectId?: string) {
  return db.dispatches.findMany({
    where: {
      dispatchDate: { gte: start, lte: end },
      ...(projectId ? { projectId } : {}),
    },
    select: {
      id: true,
      dispatchDate: true,
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          poNumber: true,
          startDate: true,
          endDate: true,
          projectDate: true,
          client: { select: { id: true, name: true } },
        },
      },
      items: {
        select: {
          quantity: true,
          productId: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              family: true,
              referencePrice: true,
            },
          },
        },
      },
    },
  })
}

async function loadReturns(start: string, end: string, projectId?: string) {
  return db.returns.findMany({
    where: {
      returnDate: { gte: start, lte: end },
      ...(projectId ? { projectId } : {}),
    },
    select: {
      id: true,
      returnDate: true,
      projectId: true,
      items: {
        select: {
          quantityReturned: true,
          productIdDelivered: true,
          productDelivered: {
            select: { id: true, code: true, name: true, family: true },
          },
        },
      },
    },
  })
}

function aggregateTotals(
  dispatches: DispatchWithRelations[],
  returns: ReturnWithRelations[],
  filters: { family?: string; productIdSet?: Set<string> | null }
) {
  let totalUnits = 0
  let totalCost = 0
  const distinctProductIds = new Set<string>()

  for (const dispatch of dispatches) {
    for (const item of dispatch.items) {
      if (filters.productIdSet && !filters.productIdSet.has(item.productId)) continue
      if (filters.family && (item.product.family || '') !== filters.family) continue
      const qty = toNumber(item.quantity)
      totalUnits += qty
      totalCost += qty * toNumber(item.product.referencePrice)
      distinctProductIds.add(item.productId)
    }
  }

  let returnedUnits = 0
  for (const ret of returns) {
    for (const item of ret.items) {
      if (filters.productIdSet && !filters.productIdSet.has(item.productIdDelivered)) continue
      if (
        filters.family &&
        (item.productDelivered?.family || '') !== filters.family
      )
        continue
      returnedUnits += toNumber(item.quantityReturned)
    }
  }

  return {
    totalUnits,
    totalCost,
    distinctItems: distinctProductIds.size,
    returnedUnits,
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const start = params.get('start')
    const end = params.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end query params are required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }
    if (!parseISODate(start) || !parseISODate(end) || start > end) {
      return NextResponse.json({ error: 'invalid date range' }, { status: 400 })
    }

    const projectId = params.get('projectId') || undefined
    const family = params.get('family') || undefined
    // productIds=a,b,c (multi) con compat para el legacy productId=a (single)
    const productIdsParam = params.get('productIds') || ''
    const legacyProductId = params.get('productId') || ''
    const productIdList = [
      ...productIdsParam.split(',').map((value) => value.trim()).filter(Boolean),
      ...(legacyProductId ? [legacyProductId] : []),
    ]
    const productIdSet = productIdList.length > 0 ? new Set(productIdList) : null
    const compare = params.get('compare') === 'prev'

    const [dispatches, returns] = await Promise.all([
      loadDispatches(start, end, projectId),
      loadReturns(start, end, projectId),
    ])

    const startDate = parseISODate(start)!
    const endDate = parseISODate(end)!
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1

    // Aggregate returned quantity per product (across the range, respecting filters)
    const returnedByProduct = new Map<string, number>()
    for (const ret of returns) {
      for (const item of ret.items) {
        if (productIdSet && !productIdSet.has(item.productIdDelivered)) continue
        if (
          family &&
          (item.productDelivered?.family || '') !== family
        )
          continue
        const current = returnedByProduct.get(item.productIdDelivered) || 0
        returnedByProduct.set(item.productIdDelivered, current + toNumber(item.quantityReturned))
      }
    }

    // Aggregate per material
    type MaterialAgg = {
      productId: string
      code: string
      name: string
      family: string
      quantity: number
      cost: number
      returned: number
      projectIds: Set<string>
    }
    const materialAgg = new Map<string, MaterialAgg>()

    // Aggregate per project
    type ProjectProductAgg = { code: string; name: string; quantity: number; returned: number }
    type ProjectAgg = {
      projectId: string
      name: string
      poNumber: string
      clientName: string
      status: string
      startDate: string | null
      endDate: string | null
      projectDate: string
      productIds: Set<string>
      units: number
      cost: number
      returned: number
      products: Map<string, ProjectProductAgg>
    }
    const projectAgg = new Map<string, ProjectAgg>()

    for (const dispatch of dispatches) {
      if (!inRange(dispatch.dispatchDate, start, end)) continue
      const proj = dispatch.project
      let pAgg = projectAgg.get(proj.id)
      if (!pAgg) {
        pAgg = {
          projectId: proj.id,
          name: proj.name,
          poNumber: proj.poNumber,
          clientName: proj.client?.name || '',
          status: proj.status,
          startDate: proj.startDate || null,
          endDate: proj.endDate || null,
          projectDate: proj.projectDate || '',
          productIds: new Set<string>(),
          units: 0,
          cost: 0,
          returned: 0,
          products: new Map<string, ProjectProductAgg>(),
        }
        projectAgg.set(proj.id, pAgg)
      }

      for (const item of dispatch.items) {
        if (productIdSet && !productIdSet.has(item.productId)) continue
        if (family && (item.product.family || '') !== family) continue

        const qty = toNumber(item.quantity)
        const cost = qty * toNumber(item.product.referencePrice)

        pAgg.units += qty
        pAgg.cost += cost
        pAgg.productIds.add(item.productId)

        if (productIdSet) {
          let pProd = pAgg.products.get(item.productId)
          if (!pProd) {
            pProd = { code: item.product.code, name: item.product.name, quantity: 0, returned: 0 }
            pAgg.products.set(item.productId, pProd)
          }
          pProd.quantity += qty
        }

        let mAgg = materialAgg.get(item.productId)
        if (!mAgg) {
          mAgg = {
            productId: item.productId,
            code: item.product.code,
            name: item.product.name,
            family: item.product.family || 'Sin familia',
            quantity: 0,
            cost: 0,
            returned: 0,
            projectIds: new Set<string>(),
          }
          materialAgg.set(item.productId, mAgg)
        }
        mAgg.quantity += qty
        mAgg.cost += cost
        mAgg.projectIds.add(proj.id)
      }
    }

    // Attach returned counts to materials + projects
    for (const [pid, retQty] of returnedByProduct.entries()) {
      const mAgg = materialAgg.get(pid)
      if (mAgg) mAgg.returned += retQty
    }
    for (const ret of returns) {
      const pAgg = projectAgg.get(ret.projectId)
      if (!pAgg) continue
      for (const item of ret.items) {
        if (productIdSet && !productIdSet.has(item.productIdDelivered)) continue
        if (
          family &&
          (item.productDelivered?.family || '') !== family
        )
          continue
        const retQty = toNumber(item.quantityReturned)
        pAgg.returned += retQty

        if (productIdSet) {
          let pProd = pAgg.products.get(item.productIdDelivered)
          if (!pProd) {
            pProd = {
              code: item.productDelivered?.code || '',
              name: item.productDelivered?.name || '',
              quantity: 0,
              returned: 0,
            }
            pAgg.products.set(item.productIdDelivered, pProd)
          }
          pProd.returned += retQty
        }
      }
    }

    // Build byFamily groupings
    type FamilyGroup = {
      family: string
      items: Array<{
        productId: string
        code: string
        name: string
        quantity: number
        cost: number
        returned: number
      }>
      subtotalUnits: number
      subtotalCost: number
      subtotalReturned: number
    }
    const byFamilyMap = new Map<string, FamilyGroup>()
    for (const m of materialAgg.values()) {
      let group = byFamilyMap.get(m.family)
      if (!group) {
        group = {
          family: m.family,
          items: [],
          subtotalUnits: 0,
          subtotalCost: 0,
          subtotalReturned: 0,
        }
        byFamilyMap.set(m.family, group)
      }
      group.items.push({
        productId: m.productId,
        code: m.code,
        name: m.name,
        quantity: m.quantity,
        cost: m.cost,
        returned: m.returned,
      })
      group.subtotalUnits += m.quantity
      group.subtotalCost += m.cost
      group.subtotalReturned += m.returned
    }
    const byFamily = Array.from(byFamilyMap.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => b.quantity - a.quantity),
      }))
      .sort((a, b) => b.subtotalUnits - a.subtotalUnits)

    const byProject = Array.from(projectAgg.values())
      // Con filtros activos, los proyectos sin movimiento de esos materiales no aportan nada.
      .filter((p) => p.units > 0 || p.returned > 0)
      .map((p) => ({
        projectId: p.projectId,
        name: p.name,
        poNumber: p.poNumber,
        clientName: p.clientName,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        projectDate: p.projectDate,
        items: p.productIds.size,
        units: p.units,
        cost: p.cost,
        returned: p.returned,
        ...(productIdSet
          ? {
              products: Array.from(p.products.entries())
                .map(([pid, prod]) => ({ productId: pid, ...prod }))
                .sort((a, b) => b.quantity - a.quantity),
            }
          : {}),
      }))
      .sort((a, b) => b.units - a.units)

    const kpis = aggregateTotals(dispatches, returns, { family, productIdSet })

    // Distinct families present (for the filter dropdown)
    const allFamilies = new Set<string>()
    for (const dispatch of dispatches) {
      for (const item of dispatch.items) {
        if (item.product.family) allFamilies.add(item.product.family)
      }
    }

    // Period-over-period comparison
    let delta: { units: number; cost: number; items: number; returned: number } | undefined
    let topMovers:
      | {
          up: Array<{ productId: string; code: string; name: string; quantity: number; previous: number; deltaPct: number }>
          down: Array<{ productId: string; code: string; name: string; quantity: number; previous: number; deltaPct: number }>
        }
      | undefined

    if (compare) {
      const prev = shiftToPrevRange(start, end)
      const [prevDispatches, prevReturns] = await Promise.all([
        loadDispatches(prev.start, prev.end, projectId),
        loadReturns(prev.start, prev.end, projectId),
      ])
      const prevKpis = aggregateTotals(prevDispatches, prevReturns, { family, productIdSet })
      delta = {
        units: deltaPct(kpis.totalUnits, prevKpis.totalUnits),
        cost: deltaPct(kpis.totalCost, prevKpis.totalCost),
        items: deltaPct(kpis.distinctItems, prevKpis.distinctItems),
        returned: deltaPct(kpis.returnedUnits, prevKpis.returnedUnits),
      }

      // Per-product previous quantities for top movers
      const prevByProduct = new Map<string, { code: string; name: string; quantity: number }>()
      for (const dispatch of prevDispatches) {
        for (const item of dispatch.items) {
          if (productIdSet && !productIdSet.has(item.productId)) continue
          if (family && (item.product.family || '') !== family) continue
          const existing = prevByProduct.get(item.productId) || {
            code: item.product.code,
            name: item.product.name,
            quantity: 0,
          }
          existing.quantity += toNumber(item.quantity)
          prevByProduct.set(item.productId, existing)
        }
      }

      const allProductIds = new Set<string>([
        ...materialAgg.keys(),
        ...prevByProduct.keys(),
      ])
      const movers: Array<{
        productId: string
        code: string
        name: string
        quantity: number
        previous: number
        deltaPct: number
      }> = []
      for (const pid of allProductIds) {
        const current = materialAgg.get(pid)
        const previous = prevByProduct.get(pid)
        const currentQty = current?.quantity || 0
        const previousQty = previous?.quantity || 0
        if (currentQty === 0 && previousQty === 0) continue
        movers.push({
          productId: pid,
          code: current?.code || previous?.code || '',
          name: current?.name || previous?.name || '',
          quantity: currentQty,
          previous: previousQty,
          deltaPct: deltaPct(currentQty, previousQty),
        })
      }
      topMovers = {
        up: [...movers].sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 5),
        down: [...movers].sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 5),
      }
    }

    return NextResponse.json({
      range: { start, end, days },
      filters: { projectId, family, productIds: productIdList, compare },
      kpis: {
        ...kpis,
        delta,
      },
      byFamily,
      byProject,
      topMovers,
      availableFamilies: Array.from(allFamilies).sort(),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('material-report error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 }
    )
  }
}
