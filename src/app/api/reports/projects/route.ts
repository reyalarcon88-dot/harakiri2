import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Reporte de proyectos por estado con el costo de materiales de cada trabajo.
// El "precio" es el costo de materiales (cantidad × precio de referencia), ya que
// el campo de precio de venta (budget) no se usa. Réplica de las fórmulas del UF
// en ProjectsModule (calculatePlannedMaterialBudget / DispatchedExpense /
// ReturnedCredit / NetProjectExpense) para que los números coincidan con la tab
// Presupuesto de cada proyecto.
function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') ?? ''
    const statuses = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const projects = await db.projects.findMany({
      where: statuses.length > 0 ? { status: { in: statuses } } : undefined,
      select: {
        id: true,
        name: true,
        poNumber: true,
        status: true,
        projectDate: true,
        startDate: true,
        endDate: true,
        client: { select: { name: true } },
        contractor: { select: { name: true } },
        materials: {
          select: {
            productId: true,
            plannedQuantity: true,
            dispatchedQuantity: true,
            product: { select: { referencePrice: true } },
          },
        },
        returns: {
          select: {
            status: true,
            items: {
              select: {
                productIdDelivered: true,
                productIdReturned: true,
                quantityDelivered: true,
                quantityReturned: true,
                returnDestination: true,
              },
            },
          },
        },
      },
      orderBy: [{ endDate: 'desc' }, { name: 'asc' }],
    })

    const items = projects.map((project) => {
      const priceByProduct = new Map<string, number>()
      let plannedCost = 0
      let dispatchedExpense = 0
      let unitsPlanned = 0
      let unitsDispatched = 0

      for (const mat of project.materials) {
        const price = toNumber(mat.product.referencePrice)
        priceByProduct.set(mat.productId, price)
        const planned = toNumber(mat.plannedQuantity)
        const dispatched = toNumber(mat.dispatchedQuantity)
        plannedCost += planned * price
        dispatchedExpense += dispatched * price
        unitsPlanned += planned
        unitsDispatched += dispatched
      }

      // Crédito por devoluciones completadas (la merma no genera crédito).
      let returnedCredit = 0
      for (const ret of project.returns) {
        if (ret.status !== 'completed') continue
        for (const item of ret.items) {
          if (item.returnDestination === 'scrap') continue
          const returnedId = item.productIdReturned || item.productIdDelivered || ''
          const quantity = toNumber(item.quantityReturned) || toNumber(item.quantityDelivered)
          const unitPrice =
            priceByProduct.get(returnedId) ?? priceByProduct.get(item.productIdDelivered) ?? 0
          returnedCredit += quantity * unitPrice
        }
      }

      const realCost = Math.max(dispatchedExpense - returnedCredit, 0)

      return {
        id: project.id,
        name: project.name,
        poNumber: project.poNumber,
        clientName: project.client?.name ?? '',
        contractorName: project.contractor?.name ?? '',
        status: project.status,
        projectDate: project.projectDate,
        startDate: project.startDate,
        endDate: project.endDate,
        plannedCost,
        realCost,
        unitsPlanned,
        unitsDispatched,
      }
    })

    const totals = items.reduce(
      (acc, it) => {
        acc.count += 1
        acc.plannedCost += it.plannedCost
        acc.realCost += it.realCost
        return acc
      },
      { count: 0, plannedCost: 0, realCost: 0 },
    )

    return NextResponse.json({ items, totals, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('GET /api/reports/projects error:', error)
    return NextResponse.json({ error: 'Failed to compute project report' }, { status: 500 })
  }
}
