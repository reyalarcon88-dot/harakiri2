export const PACKAGED_UNITS = ['bolsa', 'caja', 'palet'] as const
export type PackagedUnit = (typeof PACKAGED_UNITS)[number]

export function isPackagedUnit(unitOfMeasure: string | null | undefined): boolean {
  if (!unitOfMeasure) return false
  return (PACKAGED_UNITS as readonly string[]).includes(unitOfMeasure)
}

export function getConversionFactor(product: {
  unitOfMeasure?: string | null
  unitQuantity?: string | number | null
}): number {
  if (!isPackagedUnit(product.unitOfMeasure ?? '')) return 1
  const raw = product.unitQuantity
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

export function packagesToBase(packages: number, factor: number): number {
  return roundTo(packages * factor, 4)
}

export function baseToPackages(base: number, factor: number): number {
  if (factor <= 0) return base
  return roundTo(base / factor, 4)
}

export interface DualQuantity {
  packages: number
  base: number
}

export function normalizeDual(
  input: { packages?: number | null; base?: number | null },
  factor: number,
): DualQuantity {
  const hasPackages = input.packages != null && Number.isFinite(input.packages)
  const hasBase = input.base != null && Number.isFinite(input.base)
  if (hasPackages && hasBase) {
    return { packages: input.packages!, base: input.base! }
  }
  if (hasPackages) {
    return { packages: input.packages!, base: packagesToBase(input.packages!, factor) }
  }
  if (hasBase) {
    return { packages: baseToPackages(input.base!, factor), base: input.base! }
  }
  return { packages: 0, base: 0 }
}

function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

export function formatDual(
  packages: number,
  base: number,
  unitOfMeasure: string,
  baseLabel = 'unidades',
): string {
  const pkg = formatNumber(packages)
  const baseStr = formatNumber(base)
  return `${pkg} ${unitOfMeasure} (${baseStr} ${baseLabel})`
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2).replace(/\.?0+$/, '')
}
