export interface ProductStockOnShelf {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    code: string
    family: string
  }
}

export interface Shelf {
  id: string
  name: string
  description: string
  sortOrder: number
  productStocks: ProductStockOnShelf[]
}

export interface Rack {
  id: string
  name: string
  description: string
  sortOrder: number
  shelves: Shelf[]
}

export interface Warehouse {
  id: string
  name: string
  location: string
  description: string
  racks: Rack[]
}

export type RackFaceType = 'single' | 'double'
export type ShelfSide = 'single' | 'left' | 'right'
export type RackOrientation = 'horizontal' | 'vertical'

export interface RackVisualLayout {
  x: number
  y: number
  orientation: RackOrientation
  width?: number
  height?: number
}

export interface RackBlueprintSlot {
  key: string
  displayName: string
  aliases: string[]
  rackType: RackFaceType
  x: number
  y: number
  width: number
  height: number
  tone?: 'primary' | 'support' | 'aux'
}

export interface WarehouseBlueprint {
  id: string
  canvas: {
    width: number
    height: number
  }
  slots: RackBlueprintSlot[]
  annotations?: Array<{
    label: string
    x: number
    y: number
  }>
}

export interface ShelfPlacement {
  level: number
  side: ShelfSide
  source: 'parsed' | 'fallback'
}

export interface RackShelfPlacementEntry {
  shelf: Shelf
  placement: ShelfPlacement
}

export interface MaterialSearchHit {
  key: string
  productId: string
  productName: string
  productCode: string
  productFamily: string
  quantity: number
  rack: Rack
  shelf: Shelf
  warehouse: Warehouse
  placement: ShelfPlacement
}

export type RackVisualMappingMode = 'empty' | 'alias' | 'auto' | 'overflow'

export interface VisualRackNode {
  slot: RackBlueprintSlot
  rack: Rack | null
  totalSkus: number
  totalUnits: number
  occupiedShelves: number
  mappingMode: RackVisualMappingMode
  matchedAlias: string | null
}
