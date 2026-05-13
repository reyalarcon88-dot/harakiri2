export type RoofType = 'hip' | 'gable' | 'flat'

export interface StructureInput {
  widthFt: number
  depthFt: number
  wallHeightFt: number
  roofType: RoofType
  bayCount: number
  roofPitchFt?: number
  color: string
}

export interface CatalogProduct {
  id: string
  code: string
  name: string
  family: string
  engineeringSection: string
  color: string
  unitOfMeasure: string
}

export interface BomLineItem {
  productId: string
  productCode: string
  productName: string
  engineeringSection: string
  quantity: number
  unit: string
  calculationNote: string
}

export interface UnmatchedRequirement {
  description: string
  family: string
  requiredFt?: number
  requiredCount?: number
}

export interface BomSummary {
  perimeter: number
  wallArea: number
  totalPosts: number
  totalBays: number
}

export interface BomResult {
  items: BomLineItem[]
  warnings: string[]
  unmatched: UnmatchedRequirement[]
  summary: BomSummary
}

export interface LinearRequirement {
  family: string
  section: string
  totalFt: number
  note: string
}

export interface CountRequirement {
  family: string
  section: string
  count: number
  note: string
}
