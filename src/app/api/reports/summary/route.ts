import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMaterialProgressTotals } from '@/lib/project-material-progress'

const LOW_STOCK_THRESHOLD = 10
const MONTH_WINDOW = 8
const USAGE_DAY_WINDOW = 14
const USAGE_WEEK_WINDOW = 12
const USAGE_MONTH_WINDOW = 12
const USAGE_YEAR_WINDOW = 5

type UsageBucket = {
  key: string
  label: string
  quantity: number
  productIds: Set<string>
  projectIds: Set<string>
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function dateFrom(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date
    ? value
    : new Date(value.includes('T') ? value : `${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function monthKey(value: string | Date | null | undefined) {
  const date = dateFrom(value)
  if (!date) return 'Sin fecha'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  if (key === 'Sin fecha') return key
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1)
  )
}

function dayKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function dayLabel(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return key
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(
    new Date(year, month - 1, day)
  )
}

function weekStart(date: Date) {
  const value = new Date(date)
  value.setHours(12, 0, 0, 0)
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + diff)
  return value
}

function weekKeyFromDate(date: Date) {
  return dayKeyFromDate(weekStart(date))
}

function weekLabel(key: string) {
  return `Sem ${dayLabel(key)}`
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function yearKeyFromDate(date: Date) {
  return String(date.getFullYear())
}

function makeUsageBucket(key: string, label: string): UsageBucket {
  return {
    key,
    label,
    quantity: 0,
    productIds: new Set<string>(),
    projectIds: new Set<string>(),
  }
}

function addUsageBucketValue(
  map: Map<string, UsageBucket>,
  key: string,
  label: string,
  quantity: number,
  productId: string,
  projectId: string
) {
  const bucket = map.get(key) || makeUsageBucket(key, label)
  bucket.quantity += quantity
  bucket.productIds.add(productId)
  bucket.projectIds.add(projectId)
  map.set(key, bucket)
}

function usageBucketToRow(bucket: UsageBucket) {
  return {
    key: bucket.key,
    label: bucket.label,
    quantity: bucket.quantity,
    products: bucket.productIds.size,
    projects: bucket.projectIds.size,
  }
}

function usageRowsForKeys(
  map: Map<string, UsageBucket>,
  keys: { key: string; label: string }[]
) {
  return keys.map(({ key, label }) => usageBucketToRow(map.get(key) || makeUsageBucket(key, label)))
}

function recentDayKeys(baseDate: Date) {
  const base = new Date(baseDate)
  return Array.from({ length: USAGE_DAY_WINDOW }, (_, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() - (USAGE_DAY_WINDOW - 1 - index))
    const key = dayKeyFromDate(date)
    return { key, label: dayLabel(key) }
  })
}

function recentWeekKeys(baseDate: Date) {
  const base = weekStart(baseDate)
  return Array.from({ length: USAGE_WEEK_WINDOW }, (_, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() - (USAGE_WEEK_WINDOW - 1 - index) * 7)
    const key = dayKeyFromDate(date)
    return { key, label: weekLabel(key) }
  })
}

function recentMonthKeys(baseDate: Date) {
  const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  return Array.from({ length: USAGE_MONTH_WINDOW }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (USAGE_MONTH_WINDOW - 1 - index), 1)
    const key = monthKeyFromDate(date)
    return { key, label: monthLabel(key) }
  })
}

function recentYearKeys(baseDate: Date) {
  const year = baseDate.getFullYear()
  return Array.from({ length: USAGE_YEAR_WINDOW }, (_, index) => {
    const key = String(year - (USAGE_YEAR_WINDOW - 1 - index))
    return { key, label: key }
  })
}

function makeMonthRecord(key: string) {
  return {
    key,
    month: monthLabel(key),
    purchases: 0,
    purchaseValue: 0,
    projects: 0,
    dispatched: 0,
  }
}

function sortMonthRecords<T extends { key: string }>(rows: T[]) {
  return rows.sort((a, b) => {
    if (a.key === 'Sin fecha') return 1
    if (b.key === 'Sin fecha') return -1
    return a.key.localeCompare(b.key)
  })
}

export async function GET() {
  try {
    const [
      products,
      projects,
      purchases,
      warehouses,
      shelfStocks,
      dispatches,
      tasks,
      returns,
    ] = await Promise.all([
      db.products.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          family: true,
          currentStock: true,
          minStock: true,
          referencePrice: true,
          createdAt: true,
        },
      }),
      db.projects.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          budget: true,
          poNumber: true,
          projectDate: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          client: { select: { id: true, name: true } },
          materials: {
            select: {
              plannedQuantity: true,
              dispatchedQuantity: true,
              product: { select: { id: true, name: true, code: true, family: true } },
            },
          },
        },
      }),
      db.purchases.findMany({
        include: {
          supplier: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, poNumber: true } },
          items: {
            select: {
              quantity: true,
              unitPrice: true,
              productId: true,
              product: { select: { id: true, name: true, code: true, family: true } },
            },
          },
        },
      }),
      db.warehouse.findMany({
        select: { id: true, name: true },
      }),
      db.productShelfStock.findMany({
        select: {
          productId: true,
          quantity: true,
          product: { select: { referencePrice: true } },
          shelf: {
            select: {
              rack: {
                select: {
                  warehouseId: true,
                  warehouse: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      db.dispatches.findMany({
        select: {
          id: true,
          dispatchDate: true,
          project: {
            select: {
              id: true,
              name: true,
              poNumber: true,
              client: { select: { name: true } },
            },
          },
          items: {
            select: {
              quantity: true,
              productId: true,
              product: { select: { id: true, name: true, code: true, family: true } },
            },
          },
        },
      }),
      db.tasks.findMany({
        select: { id: true, status: true, dueDate: true },
      }),
      db.returns.findMany({
        select: { id: true, status: true },
      }),
    ])

    const totalProducts = products.length
    const totalUnits = products.reduce((sum, p) => sum + toNumber(p.currentStock), 0)
    const inventoryValue = products.reduce(
      (sum, p) => sum + toNumber(p.currentStock) * toNumber(p.referencePrice),
      0
    )
    const outOfStock = products.filter((p) => toNumber(p.currentStock) === 0).length
    const criticalStock = products.filter(
      (p) => {
        const currentStock = toNumber(p.currentStock)
        const minStock = toNumber(p.minStock)
        return currentStock > 0 && minStock > 0 && currentStock < minStock
      }
    ).length
    const lowStock = products.filter(
      (p) => {
        const currentStock = toNumber(p.currentStock)
        const minStock = toNumber(p.minStock)
        return (
          currentStock > 0 &&
          !(minStock > 0 && currentStock < minStock) &&
          currentStock < LOW_STOCK_THRESHOLD
        )
      }
    ).length
    const healthyStock = Math.max(totalProducts - outOfStock - criticalStock - lowStock, 0)
    const stockHealthScore = totalProducts > 0 ? Math.round((healthyStock / totalProducts) * 100) : 0

    const unitsByWarehouseMap = new Map<string, { name: string; units: number; value: number }>()
    for (const warehouse of warehouses) {
      unitsByWarehouseMap.set(warehouse.id, { name: warehouse.name, units: 0, value: 0 })
    }
    for (const stock of shelfStocks) {
      const warehouseId = stock.shelf.rack.warehouseId
      const entry = unitsByWarehouseMap.get(warehouseId)
      if (!entry) continue
      const quantity = toNumber(stock.quantity)
      entry.units += quantity
      entry.value += quantity * toNumber(stock.product.referencePrice)
    }
    const unitsByWarehouse = Array.from(unitsByWarehouseMap.values()).sort((a, b) => b.units - a.units)

    const familyMap = new Map<string, { family: string; products: number; units: number; value: number }>()
    for (const product of products) {
      const family = product.family || 'Sin familia'
      const entry = familyMap.get(family) || { family, products: 0, units: 0, value: 0 }
      const currentStock = toNumber(product.currentStock)
      entry.products += 1
      entry.units += currentStock
      entry.value += currentStock * toNumber(product.referencePrice)
      familyMap.set(family, entry)
    }
    const stockByFamily = Array.from(familyMap.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 8)

    const topStockProducts = [...products]
      .sort((a, b) => toNumber(b.currentStock) - toNumber(a.currentStock))
      .slice(0, 8)
      .map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code,
        family: product.family || 'Sin familia',
        units: toNumber(product.currentStock),
      }))

    const lowStockProducts = products
      .filter((product) => {
        const currentStock = toNumber(product.currentStock)
        const minStock = toNumber(product.minStock)
        return minStock > 0 && currentStock < minStock
      })
      .map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code,
        family: product.family || 'Sin familia',
        currentStock: toNumber(product.currentStock),
        minStock: toNumber(product.minStock),
        gap: Math.max(toNumber(product.minStock) - toNumber(product.currentStock), 0),
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10)

    const projectsByStatus: Record<string, number> = {}
    let plannedUnits = 0
    let dispatchedUnits = 0
    let pendingUnits = 0
    const projectsWithPending = []
    const clientDemandMap = new Map<string, { name: string; projects: number; pending: number; budget: number }>()

    for (const project of projects) {
      projectsByStatus[project.status] = (projectsByStatus[project.status] || 0) + 1

      const materialTotals = getMaterialProgressTotals(project.materials)
      const projectPlanned = materialTotals.planned
      const projectDispatched = materialTotals.dispatched
      const projectPending = materialTotals.pending

      plannedUnits += projectPlanned
      dispatchedUnits += projectDispatched
      pendingUnits += projectPending

      const clientEntry = clientDemandMap.get(project.client.id) || {
        name: project.client.name,
        projects: 0,
        pending: 0,
        budget: 0,
      }
      clientEntry.projects += 1
      clientEntry.pending += projectPending
      clientEntry.budget += toNumber(project.budget)
      clientDemandMap.set(project.client.id, clientEntry)

      if (projectPending > 0 && project.status !== 'finished' && project.status !== 'cancelled') {
        projectsWithPending.push({
          id: project.id,
          name: project.name,
          poNumber: project.poNumber,
          clientName: project.client.name,
          pending: projectPending,
          planned: projectPlanned,
          dispatched: projectDispatched,
          progress: materialTotals.progress,
          status: project.status,
        })
      }
    }

    projectsWithPending.sort((a, b) => b.pending - a.pending)

    const totalProjects = projects.length
    const activeProjects = projects.filter((p) => p.status !== 'finished' && p.status !== 'cancelled').length
    const totalBudget = projects.reduce((sum, project) => sum + toNumber(project.budget), 0)
    const dispatchProgress = plannedUnits > 0 ? Math.round((dispatchedUnits / plannedUnits) * 100) : 0
    const clientDemand = Array.from(clientDemandMap.values())
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 8)

    const purchasesByStatus: Record<string, number> = {}
    let totalPurchaseValue = 0
    let pendingPurchaseValue = 0
    let receivedPurchaseValue = 0
    let openPurchaseValue = 0
    const supplierValueMap = new Map<string, { name: string; value: number; count: number }>()
    const productPurchasedMap = new Map<string, { productId: string; qty: number; value: number; name: string; code: string; family: string }>()
    const purchaseMonthMap = new Map<string, ReturnType<typeof makeMonthRecord>>()

    for (const purchase of purchases) {
      purchasesByStatus[purchase.status] = (purchasesByStatus[purchase.status] || 0) + 1
      const value = purchase.items.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice),
        0
      )
      totalPurchaseValue += value

      if (purchase.status === 'pedido' || purchase.status === 'pending') {
        pendingPurchaseValue += value
        openPurchaseValue += value
      }
      if (purchase.status === 'received') receivedPurchaseValue += value

      const key = monthKey(purchase.purchaseDate)
      const month = purchaseMonthMap.get(key) || makeMonthRecord(key)
      month.purchases += 1
      month.purchaseValue += value
      purchaseMonthMap.set(key, month)

      if (purchase.status !== 'cancelled') {
        const supplierEntry = supplierValueMap.get(purchase.supplier.id) || {
          name: purchase.supplier.name,
          value: 0,
          count: 0,
        }
        supplierEntry.value += value
        supplierEntry.count += 1
        supplierValueMap.set(purchase.supplier.id, supplierEntry)

        for (const item of purchase.items) {
          const quantity = toNumber(item.quantity)
          const itemValue = quantity * toNumber(item.unitPrice)
          const productEntry = productPurchasedMap.get(item.productId) || {
            productId: item.productId,
            qty: 0,
            value: 0,
            name: item.product?.name || '?',
            code: item.product?.code || '',
            family: item.product?.family || 'Sin familia',
          }
          productEntry.qty += quantity
          productEntry.value += itemValue
          productPurchasedMap.set(item.productId, productEntry)
        }
      }
    }

    for (const project of projects) {
      const key = monthKey(project.projectDate || project.createdAt)
      const month = purchaseMonthMap.get(key) || makeMonthRecord(key)
      month.projects += 1
      purchaseMonthMap.set(key, month)
    }

    const usagePeriodMaps = {
      daily: new Map<string, UsageBucket>(),
      weekly: new Map<string, UsageBucket>(),
      monthly: new Map<string, UsageBucket>(),
      annual: new Map<string, UsageBucket>(),
    }
    const productUsageMap = new Map<
      string,
      {
        productId: string
        name: string
        code: string
        family: string
        quantity: number
        projectIds: Set<string>
      }
    >()
    const productHistoryMap = new Map<
      string,
      {
        productId: string
        name: string
        code: string
        family: string
        totalUsed: number
        projects: Map<
          string,
          {
            projectId: string
            projectName: string
            poNumber: string
            clientName: string
            quantity: number
            dispatches: number
            lastDispatchDate: string
          }
        >
      }
    >()
    let latestUsageDate: Date | null = null

    for (const dispatch of dispatches) {
      const key = monthKey(dispatch.dispatchDate)
      const month = purchaseMonthMap.get(key) || makeMonthRecord(key)
      month.dispatched += dispatch.items.reduce((sum, item) => sum + toNumber(item.quantity), 0)
      purchaseMonthMap.set(key, month)

      const dispatchDate = dateFrom(dispatch.dispatchDate)
      if (dispatchDate && (!latestUsageDate || dispatchDate > latestUsageDate)) {
        latestUsageDate = dispatchDate
      }

      for (const item of dispatch.items) {
        const quantity = toNumber(item.quantity)
        if (quantity <= 0) continue

        const productId = item.productId
        const projectId = dispatch.project.id
        const productName = item.product?.name || 'Producto sin nombre'
        const productCode = item.product?.code || ''
        const productFamily = item.product?.family || 'Sin familia'

        if (dispatchDate) {
          addUsageBucketValue(
            usagePeriodMaps.daily,
            dayKeyFromDate(dispatchDate),
            dayLabel(dayKeyFromDate(dispatchDate)),
            quantity,
            productId,
            projectId
          )
          addUsageBucketValue(
            usagePeriodMaps.weekly,
            weekKeyFromDate(dispatchDate),
            weekLabel(weekKeyFromDate(dispatchDate)),
            quantity,
            productId,
            projectId
          )
          addUsageBucketValue(
            usagePeriodMaps.monthly,
            monthKeyFromDate(dispatchDate),
            monthLabel(monthKeyFromDate(dispatchDate)),
            quantity,
            productId,
            projectId
          )
          addUsageBucketValue(
            usagePeriodMaps.annual,
            yearKeyFromDate(dispatchDate),
            yearKeyFromDate(dispatchDate),
            quantity,
            productId,
            projectId
          )
        }

        const productUsage = productUsageMap.get(productId) || {
          productId,
          name: productName,
          code: productCode,
          family: productFamily,
          quantity: 0,
          projectIds: new Set<string>(),
        }
        productUsage.quantity += quantity
        productUsage.projectIds.add(projectId)
        productUsageMap.set(productId, productUsage)

        const history = productHistoryMap.get(productId) || {
          productId,
          name: productName,
          code: productCode,
          family: productFamily,
          totalUsed: 0,
          projects: new Map(),
        }
        const projectHistory = history.projects.get(projectId) || {
          projectId,
          projectName: dispatch.project.name,
          poNumber: dispatch.project.poNumber,
          clientName: dispatch.project.client.name,
          quantity: 0,
          dispatches: 0,
          lastDispatchDate: '',
        }
        projectHistory.quantity += quantity
        projectHistory.dispatches += 1
        if (
          !projectHistory.lastDispatchDate ||
          (dispatchDate && dispatchDate > (dateFrom(projectHistory.lastDispatchDate) || new Date(0)))
        ) {
          projectHistory.lastDispatchDate = dispatch.dispatchDate
        }
        history.totalUsed += quantity
        history.projects.set(projectId, projectHistory)
        productHistoryMap.set(productId, history)
      }
    }

    const monthlyTrend = sortMonthRecords(Array.from(purchaseMonthMap.values())).slice(-MONTH_WINDOW)
    const usageBaseDate = latestUsageDate || new Date()
    const usageDaily = usageRowsForKeys(usagePeriodMaps.daily, recentDayKeys(usageBaseDate))
    const usageWeekly = usageRowsForKeys(usagePeriodMaps.weekly, recentWeekKeys(usageBaseDate))
    const usageMonthly = usageRowsForKeys(usagePeriodMaps.monthly, recentMonthKeys(usageBaseDate))
    const usageAnnual = usageRowsForKeys(usagePeriodMaps.annual, recentYearKeys(usageBaseDate))
    const topUsedProducts = Array.from(productUsageMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((product) => ({
        productId: product.productId,
        name: product.name,
        code: product.code,
        family: product.family,
        quantity: product.quantity,
        projects: product.projectIds.size,
      }))
    const productHistory = Array.from(productHistoryMap.values())
      .sort((a, b) => b.totalUsed - a.totalUsed)
      .map((product) => ({
        productId: product.productId,
        name: product.name,
        code: product.code,
        family: product.family,
        totalUsed: product.totalUsed,
        projects: Array.from(product.projects.values()).sort((a, b) => b.quantity - a.quantity),
      }))
    const usageProjectIds = new Set<string>()
    for (const product of productUsageMap.values()) {
      for (const projectId of product.projectIds) {
        usageProjectIds.add(projectId)
      }
    }
    const totalUsedUnits = Array.from(productUsageMap.values()).reduce(
      (sum, product) => sum + product.quantity,
      0
    )
    const topSuppliers = Array.from(supplierValueMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
    const topPurchasedProducts = Array.from(productPurchasedMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
    const topSupplierValue = topSuppliers[0]?.value || 0
    const supplierConcentration = totalPurchaseValue > 0
      ? Math.round((topSupplierValue / totalPurchaseValue) * 100)
      : 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const inSevenDays = new Date(today)
    inSevenDays.setDate(today.getDate() + 7)

    const pendingTasks = tasks.filter((task) => task.status !== 'completed')
    const overdueTasks = pendingTasks.filter((task) => {
      const dueDate = dateFrom(task.dueDate)
      return dueDate ? dueDate < today : false
    }).length
    const dueSoonTasks = pendingTasks.filter((task) => {
      const dueDate = dateFrom(task.dueDate)
      return dueDate ? dueDate >= today && dueDate <= inSevenDays : false
    }).length
    const pendingReturns = returns.filter((item) => item.status === 'pending').length

    return NextResponse.json({
      inventory: {
        totalProducts,
        totalUnits,
        outOfStock,
        lowStock,
        criticalStock,
        healthyStock,
        stockHealthScore,
        inventoryValue,
        unitsByWarehouse,
        stockByFamily,
        topStockProducts,
        lowStockProducts,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      },
      projects: {
        totalProjects,
        activeProjects,
        totalBudget,
        plannedUnits,
        dispatchedUnits,
        pendingUnits,
        dispatchProgress,
        projectsByStatus,
        projectsWithPending: projectsWithPending.slice(0, 10),
        clientDemand,
      },
      purchases: {
        totalPurchases: purchases.length,
        totalPurchaseValue,
        pendingPurchaseValue,
        receivedPurchaseValue,
        openPurchaseValue,
        purchasesByStatus,
        topSuppliers,
        topPurchasedProducts,
        supplierConcentration,
      },
      usage: {
        totalUsedUnits,
        activeProducts: productUsageMap.size,
        activeProjects: usageProjectIds.size,
        topUsedProducts,
        productHistory,
        byPeriod: {
          daily: usageDaily,
          weekly: usageWeekly,
          monthly: usageMonthly,
          annual: usageAnnual,
        },
      },
      operations: {
        pendingTasks: pendingTasks.length,
        overdueTasks,
        dueSoonTasks,
        pendingReturns,
      },
      trends: {
        monthly: monthlyTrend,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error al generar reportes:', error)
    return NextResponse.json({ error: 'Error al generar reportes' }, { status: 500 })
  }
}
