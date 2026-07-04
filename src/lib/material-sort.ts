import {
  compareStructuralFrameMaterials,
  compareFastenerMaterials,
  getProductFamily,
  compareMaterialsByDimensions,
} from '@/lib/structural-frame-sort'
import { getSectionOrder } from '@/lib/engineering-sections'

export interface MaterialSortInput {
  engineeringSection?: string | null
  sortOrder?: number | null
  product?: { name?: string | null; engineeringSection?: string | null } | null
}

/**
 * Orden visual canónico de materiales: por sección de ingeniería, luego
 * comparadores especiales para Structural Frame / Fasteners, luego familia +
 * dimensiones, con anchor por grupo para mantener cohesión visual. Se usa en la
 * lista de materiales del proyecto, en "Pedir materiales faltantes" y en el PDF
 * de orden de compra para que el orden sea siempre el mismo que ve el usuario.
 *
 * Acepta cualquier objeto que exponga la sección/orden y un product con name;
 * cuando no hay `engineeringSection` propio cae al del product.
 */
export function sortMaterialsForDisplay<T extends MaterialSortInput>(materials: T[]): T[] {
  const sectionOf = (mat: T) => mat.engineeringSection || mat.product?.engineeringSection || ''
  const nameOf = (mat: T) => mat.product?.name || ''

  const groupMinOrder = new Map<string, number>()
  for (const mat of materials) {
    const key = `${sectionOf(mat)}|${getProductFamily(nameOf(mat))}`
    const cur = groupMinOrder.get(key) ?? Infinity
    groupMinOrder.set(key, Math.min(cur, mat.sortOrder ?? 0))
  }

  return materials.slice().sort((a, b) => {
    const aSection = sectionOf(a)
    const bSection = sectionOf(b)
    const sectionDiff = getSectionOrder(aSection) - getSectionOrder(bSection)
    if (sectionDiff !== 0) return sectionDiff

    if (aSection === 'Structural Frame' && bSection === 'Structural Frame') {
      return compareStructuralFrameMaterials(nameOf(a), nameOf(b))
    }

    if (aSection === 'Fasteners & Hardware' && bSection === 'Fasteners & Hardware') {
      return compareFastenerMaterials(nameOf(a), nameOf(b))
    }

    const aName = nameOf(a)
    const bName = nameOf(b)
    const aFamily = getProductFamily(aName)
    const bFamily = getProductFamily(bName)

    if (aFamily === bFamily) {
      return compareMaterialsByDimensions(aName, bName)
    }

    const aKey = `${aSection}|${aFamily}`
    const bKey = `${bSection}|${bFamily}`
    const aGroupOrder = groupMinOrder.get(aKey) ?? (a.sortOrder ?? 0)
    const bGroupOrder = groupMinOrder.get(bKey) ?? (b.sortOrder ?? 0)
    return aGroupOrder - bGroupOrder
  })
}
