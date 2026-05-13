import { getProductFamily, extractDimensions } from '@/lib/structural-frame-sort'
import type { CatalogProduct, BomLineItem, UnmatchedRequirement, LinearRequirement, CountRequirement } from './types'

// Returns the last (longest) dimension from a product name — used as "length in feet"
function productLengthFt(name: string): number {
  const dims = extractDimensions(name)
  return dims[dims.length - 1] ?? 0
}

// For a linear footage requirement, picks the best product and quantity.
// Strategy: prefer the longest piece (minimizes joints/waste), then ceil(total / pieceLen).
export function matchLinear(
  req: LinearRequirement,
  catalog: CatalogProduct[],
  projectColor: string,
): BomLineItem | UnmatchedRequirement {
  const targetFamily = req.family.toUpperCase()

  const candidates = catalog.filter((p) => {
    const pFamily = getProductFamily(p.name).toUpperCase()
    const colorOk = !p.color || p.color.toLowerCase() === projectColor.toLowerCase() || p.color === ''
    const sectionOk = p.engineeringSection === req.section || req.section === ''
    return pFamily.includes(targetFamily) || targetFamily.includes(pFamily) && colorOk && sectionOk
  }).filter((p) => productLengthFt(p.name) > 0)

  if (candidates.length === 0) {
    return {
      description: `${req.family}: ${req.totalFt} pies lineales — sin producto en catálogo`,
      family: req.family,
      requiredFt: req.totalFt,
    }
  }

  // Pick the longest piece length available
  const best = candidates.reduce((a, b) => productLengthFt(a.name) >= productLengthFt(b.name) ? a : b)
  const pieceLen = productLengthFt(best.name)
  const qty = Math.ceil(req.totalFt / pieceLen)

  return {
    productId: best.id,
    productCode: best.code,
    productName: best.name,
    engineeringSection: best.engineeringSection,
    quantity: qty,
    unit: best.unitOfMeasure || 'pza',
    calculationNote: `${req.totalFt} ft ÷ ${pieceLen} ft/pza = ${qty} pzas · ${req.note}`,
  }
}

// For a count requirement, picks the exact product by family name match.
export function matchCount(
  req: CountRequirement,
  catalog: CatalogProduct[],
  projectColor: string,
): BomLineItem | UnmatchedRequirement {
  const targetFamily = req.family.toUpperCase()

  const candidates = catalog.filter((p) => {
    const pFamily = getProductFamily(p.name).toUpperCase()
    const colorOk = !p.color || p.color.toLowerCase() === projectColor.toLowerCase() || p.color === ''
    return pFamily.includes(targetFamily) || targetFamily.includes(pFamily) && colorOk
  })

  if (candidates.length === 0) {
    return {
      description: `${req.family}: ${req.count} unidades — sin producto en catálogo`,
      family: req.family,
      requiredCount: req.count,
    }
  }

  // Pick by best dimension fit (largest piece that covers the count requirement)
  const best = candidates[0]

  return {
    productId: best.id,
    productCode: best.code,
    productName: best.name,
    engineeringSection: best.engineeringSection,
    quantity: req.count,
    unit: best.unitOfMeasure || 'pza',
    calculationNote: req.note,
  }
}

export function isBomLineItem(r: BomLineItem | UnmatchedRequirement): r is BomLineItem {
  return 'productId' in r
}
