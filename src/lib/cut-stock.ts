export type CutStockProduct = {
  id: string
  code: string
  name: string
  color?: string | null
  family?: string | null
  unitQuantity?: string | number | null
  shelfStocks?: Array<{
    shelfId?: string | null
    quantity?: string | number | null
    reserveQuantity?: string | number | null
    isReserveShelf?: boolean | number | null
    availableQuantity?: string | number | null
    shelf?: {
      name: string
      rack: {
        name: string
        warehouse: { name: string }
      }
    }
  }>
}

export type CuttableSource = {
  productId: string
  code: string
  name: string
  sourceLength: number
  targetLength: number
  piecesPerSourcePiece: number
  totalSourcePieces: number
  coveredTargetPieces: number
  bestShelfId: string
  shelfLabel: string
}

export type CutPlan = {
  targetLength: number
  sourceLength: number
  piecesPerSourcePiece: number
  sourcePiecesNeeded: number
  producedTargetPieces: number
  remnants: Array<{ length: number; count: number }>
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

function formatSize(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, '')
}

function normalizeColor(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeProfileText(value: string) {
  return value
    .toUpperCase()
    .replace(/['"]/g, '')
    .replace(/\b(BRZ|BRONZE|WHT|WHITE|WHIT|ALM|RMC)\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Families that NEVER produce cuttable stock. Hardware, fasteners, doors,
// screens, tools and sealants are sold per piece — proposing to cut them is
// always nonsensical. Match is case-insensitive and accent-insensitive.
const NON_CUTTABLE_FAMILIES = new Set([
  // English (current DB taxonomy)
  'FASTENER',
  'DOOR',
  'TOOL',
  'MISCELLANEOUS',
  'SCREEN',
  'NFL SCREEN',
  // Spanish equivalents (future-proofing if catalog is migrated)
  'TORNILLERIA',
  'HERRAJES',
  'PUERTAS',
  'SELLANTES',
  'CONSUMIBLES',
  'HERRAMIENTAS',
  'MALLAS',
])

function normalizeFamilyKey(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function isProductCuttable(product: { family?: string | null }): boolean {
  const family = normalizeFamilyKey(product.family)
  if (!family) return true
  return !NON_CUTTABLE_FAMILIES.has(family)
}

export function detectCutLength(product: Pick<CutStockProduct, 'unitQuantity' | 'name' | 'code'>) {
  const nameSize = lastDimensionalNumber(product.name)
  const codeSize = lastDimensionalNumber(product.code)
  const unitSize = firstNumber(product.unitQuantity)

  // In the current catalog, many linear pieces have unitQuantity = 1 while
  // the real cut length lives in the name/code (for example INSERT 3x11x24').
  if (nameSize && nameSize > 1) return nameSize
  if (codeSize && codeSize > 1) return codeSize
  if (unitSize && unitSize > 1) return unitSize
  return null
}

export function replaceLastCutLengthToken(value: string, originalLength: number, nextLength: number) {
  const original = formatSize(originalLength)
  const next = formatSize(nextLength)
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const dimensionPattern = new RegExp(`([xX])\\s*${escaped}(?=(?:['"]|\\b|\\s|$))`, 'g')

  let lastMatch: RegExpExecArray | null = null
  let match: RegExpExecArray | null
  while ((match = dimensionPattern.exec(value))) lastMatch = match

  if (lastMatch) {
    const start = lastMatch.index
    const end = start + lastMatch[0].length
    return `${value.slice(0, start)}${lastMatch[1]}${next}${value.slice(end)}`
  }

  const trailingPattern = new RegExp(`${escaped}(?=(?:['"]|\\b|\\s|$))(?!.*${escaped})`)
  if (trailingPattern.test(value)) return value.replace(trailingPattern, next)

  return `${value} ${next}'`
}

export function getCutProfileKey(product: Pick<CutStockProduct, 'unitQuantity' | 'name' | 'code'>) {
  const length = detectCutLength(product)
  const source = product.name || product.code
  if (!source) return ''
  const withoutLength = length
    ? replaceLastCutLengthToken(source, length, 0).replace(/\b0\b/g, ' ')
    : source
  return normalizeProfileText(withoutLength)
}

export function isCuttableSourceForTarget(
  target: Pick<CutStockProduct, 'id' | 'code' | 'name' | 'color' | 'unitQuantity' | 'family'>,
  source: Pick<CutStockProduct, 'id' | 'code' | 'name' | 'color' | 'unitQuantity' | 'family'>,
) {
  if (target.id === source.id) return false

  // Families like FASTENER, DOOR, SCREEN, TOOL, MISCELLANEOUS, Sellantes,
  // Herrajes are sold per piece and must never appear in cut suggestions —
  // even when their names contain numbers (e.g. "TORNILLO-3").
  if (!isProductCuttable(target)) return false
  if (!isProductCuttable(source)) return false

  const targetLength = detectCutLength(target)
  const sourceLength = detectCutLength(source)
  if (!targetLength || !sourceLength || sourceLength <= targetLength) return false

  const targetColor = normalizeColor(target.color)
  const sourceColor = normalizeColor(source.color)
  if (targetColor && sourceColor && targetColor !== sourceColor) return false

  const targetProfile = getCutProfileKey(target)
  const sourceProfile = getCutProfileKey(source)
  return Boolean(targetProfile && sourceProfile && targetProfile === sourceProfile)
}

function availableShelfPieces(
  shelfStock: NonNullable<CutStockProduct['shelfStocks']>[number],
  includeReserve = false,
) {
  const quantity = Number(shelfStock.quantity || 0)
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  if (includeReserve) return quantity
  if (shelfStock.availableQuantity !== undefined && shelfStock.availableQuantity !== null) {
    const available = Number(shelfStock.availableQuantity)
    return Number.isFinite(available) ? Math.max(available, 0) : 0
  }
  const reserve = Number(shelfStock.reserveQuantity || 0)
  const isReserveShelf = Boolean(shelfStock.isReserveShelf)
  return isReserveShelf ? 0 : Math.max(quantity - reserve, 0)
}

export function findCuttableSourcesForTarget(
  target: CutStockProduct,
  products: CutStockProduct[],
  options: { includeReserve?: boolean } = {},
): CuttableSource[] {
  if (!isProductCuttable(target)) return []
  const targetLength = detectCutLength(target)
  if (!targetLength || targetLength <= 0) return []

  const sources: CuttableSource[] = []
  for (const product of products) {
    if (!isCuttableSourceForTarget(target, product)) continue
    const sourceLength = detectCutLength(product)
    if (!sourceLength) continue

    const piecesPerSourcePiece = Math.floor(sourceLength / targetLength)
    if (piecesPerSourcePiece <= 0) continue

    let totalSourcePieces = 0
    let best: { shelfId: string; qty: number; label: string } | null = null

    for (const shelfStock of product.shelfStocks ?? []) {
      const available = availableShelfPieces(shelfStock, options.includeReserve)
      if (available <= 0) continue

      totalSourcePieces += available
      if (!best || available > best.qty) {
        best = {
          shelfId: String(shelfStock.shelfId || ''),
          qty: available,
          label: shelfStock.shelf
            ? `${shelfStock.shelf.rack.warehouse.name} / ${shelfStock.shelf.rack.name} / ${shelfStock.shelf.name}`
            : 'Warehouse',
        }
      }
    }

    if (!best || !best.shelfId || totalSourcePieces <= 0) continue
    sources.push({
      productId: product.id,
      code: product.code,
      name: product.name,
      sourceLength,
      targetLength,
      piecesPerSourcePiece,
      totalSourcePieces,
      coveredTargetPieces: totalSourcePieces * piecesPerSourcePiece,
      bestShelfId: best.shelfId,
      shelfLabel: best.label,
    })
  }

  sources.sort((a, b) => a.sourceLength - b.sourceLength || b.totalSourcePieces - a.totalSourcePieces)
  return sources
}

export function getCuttableCoverage(target: CutStockProduct, products: CutStockProduct[]) {
  const sources = findCuttableSourcesForTarget(target, products)
  return sources.reduce((total, source) => total + source.coveredTargetPieces, 0)
}

export function computeCutPlan(
  targetPieces: number,
  target: Pick<CutStockProduct, 'unitQuantity' | 'name' | 'code'>,
  source: Pick<CutStockProduct, 'unitQuantity' | 'name' | 'code'>,
): CutPlan | null {
  const targetLength = detectCutLength(target)
  const sourceLength = detectCutLength(source)
  if (!targetLength || !sourceLength || targetLength <= 0 || sourceLength <= targetLength) return null

  const piecesPerSourcePiece = Math.floor(sourceLength / targetLength)
  if (piecesPerSourcePiece <= 0) return null

  const needed = Math.ceil(Math.max(targetPieces, 0) / piecesPerSourcePiece)
  if (needed <= 0) return null

  let remainingTargetPieces = targetPieces
  const remnantCounts = new Map<number, number>()

  for (let index = 0; index < needed; index += 1) {
    const producedFromThisPiece = Math.min(piecesPerSourcePiece, remainingTargetPieces)
    remainingTargetPieces -= producedFromThisPiece
    const usedLength = producedFromThisPiece * targetLength
    const remnantLength = Math.max(sourceLength - usedLength, 0)
    if (remnantLength > 0) {
      remnantCounts.set(remnantLength, (remnantCounts.get(remnantLength) || 0) + 1)
    }
  }

  return {
    targetLength,
    sourceLength,
    piecesPerSourcePiece,
    sourcePiecesNeeded: needed,
    producedTargetPieces: targetPieces,
    remnants: [...remnantCounts.entries()].map(([length, count]) => ({ length, count })),
  }
}
