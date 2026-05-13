import { matchLinear, matchCount, isBomLineItem } from './product-matcher'
import { calcStructural } from './calculators/structural'
import { calcFasteners } from './calculators/fasteners'
import { calcScreen } from './calculators/screen'
import type { StructureInput, CatalogProduct, BomResult, BomLineItem, UnmatchedRequirement } from './types'

export function generateBom(input: StructureInput, catalog: CatalogProduct[]): BomResult {
  const { widthFt, depthFt, wallHeightFt, bayCount, color } = input

  const perimeter = 2 * (widthFt + depthFt)
  const longSide = Math.max(widthFt, depthFt)
  const shortSide = Math.min(widthFt, depthFt)
  const bayWidthFt = longSide / bayCount
  const baysShortSide = Math.ceil(shortSide / bayWidthFt)
  const totalBays = bayCount * 2 + baysShortSide * 2
  const totalPosts = 4 + (bayCount - 1) * 2 + (baysShortSide - 1) * 2
  const wallArea = perimeter * wallHeightFt

  const derived = { perimeter, totalBays, totalPosts, bayWidthFt }

  const { linear: structLinear, count: structCount } = calcStructural(input)
  const fastenerCount = calcFasteners(input, { totalPosts, totalBays, perimeter })
  const { linear: screenLinear, count: screenCount } = calcScreen(input, { totalBays, perimeter, bayWidthFt })

  const items: BomLineItem[] = []
  const unmatched: UnmatchedRequirement[] = []
  const warnings: string[] = []

  // Accumulate same-product quantities from multiple linear requirements
  const accumulator = new Map<string, BomLineItem>()

  const processResult = (result: BomLineItem | UnmatchedRequirement) => {
    if (isBomLineItem(result)) {
      const existing = accumulator.get(result.productId)
      if (existing) {
        accumulator.set(result.productId, {
          ...existing,
          quantity: existing.quantity + result.quantity,
          calculationNote: `${existing.calculationNote} + ${result.calculationNote}`,
        })
      } else {
        accumulator.set(result.productId, { ...result })
      }
    } else {
      unmatched.push(result)
    }
  }

  for (const req of structLinear) {
    processResult(matchLinear(req, catalog, color))
  }
  for (const req of structCount) {
    processResult(matchCount(req, catalog, color))
  }
  for (const req of fastenerCount) {
    processResult(matchCount(req, catalog, color))
  }
  for (const req of screenLinear) {
    processResult(matchLinear(req, catalog, color))
  }
  for (const req of screenCount) {
    processResult(matchCount(req, catalog, color))
  }

  items.push(...accumulator.values())

  if (unmatched.length > 0) {
    warnings.push(`${unmatched.length} requerimiento(s) sin producto en el catálogo — revisa la sección "Sin match".`)
  }

  return {
    items,
    warnings,
    unmatched,
    summary: {
      perimeter,
      wallArea,
      totalPosts,
      totalBays,
    },
  }
}

export type { StructureInput, CatalogProduct, BomResult, BomLineItem } from './types'
