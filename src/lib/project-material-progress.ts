export interface MaterialProgressEntry {
  plannedQuantity: number
  dispatchedQuantity: number
}

function normalizeQuantity(value: number | string | null | undefined): number {
  const quantity = Number(value ?? 0)
  return Number.isFinite(quantity) ? Math.max(quantity, 0) : 0
}

export function getEffectiveDispatchedQuantity(
  plannedQuantity: number,
  dispatchedQuantity: number
): number {
  const planned = normalizeQuantity(plannedQuantity)
  const dispatched = normalizeQuantity(dispatchedQuantity)
  return Math.min(dispatched, planned)
}

export function getMaterialPendingQuantity(
  plannedQuantity: number,
  dispatchedQuantity: number
): number {
  const planned = normalizeQuantity(plannedQuantity)
  const dispatched = getEffectiveDispatchedQuantity(planned, dispatchedQuantity)
  return Math.max(planned - dispatched, 0)
}

export function getMaterialProgressPercentage(
  plannedQuantity: number,
  dispatchedQuantity: number
): number {
  const planned = normalizeQuantity(plannedQuantity)
  if (planned <= 0) return 0
  const dispatched = getEffectiveDispatchedQuantity(planned, dispatchedQuantity)
  return Math.min(Math.round((dispatched / planned) * 100), 100)
}

export function getMaterialProgressTotals<T extends MaterialProgressEntry>(materials: T[]) {
  const totals = materials.reduce(
    (acc, material) => {
      const planned = normalizeQuantity(material.plannedQuantity)
      const dispatched = getEffectiveDispatchedQuantity(planned, material.dispatchedQuantity)

      acc.planned += planned
      acc.dispatched += dispatched
      acc.pending += Math.max(planned - dispatched, 0)

      return acc
    },
    { planned: 0, dispatched: 0, pending: 0 }
  )

  return {
    ...totals,
    progress: totals.planned > 0 ? Math.min(Math.round((totals.dispatched / totals.planned) * 100), 100) : 0,
  }
}
