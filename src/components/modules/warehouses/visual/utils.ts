import { DEFAULT_WAREHOUSE_BLUEPRINT } from './layout-config'
import type { MessageKey } from '@/lib/i18n/messages'
import type {
  MaterialSearchHit,
  Rack,
  RackBlueprintSlot,
  RackFaceType,
  RackVisualMappingMode,
  RackShelfPlacementEntry,
  Shelf,
  ShelfPlacement,
  ShelfSide,
  VisualRackNode,
  Warehouse,
  WarehouseBlueprint,
} from './types'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sortRacksForVisualMapping(racks: Rack[]) {
  return racks
    .slice()
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name)
    })
}

export function normalizeToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
}

export function getRackNodeKey(node: VisualRackNode) {
  return node.rack?.id ?? node.slot.key
}

export function getWarehouseBlueprint(_warehouse: Warehouse | null) {
  return DEFAULT_WAREHOUSE_BLUEPRINT
}

export function getRackSlotForRack(
  rack: Rack,
  blueprint: WarehouseBlueprint,
  visualNodes?: VisualRackNode[]
): RackBlueprintSlot | null {
  const mappedNode = visualNodes?.find((node) => node.rack?.id === rack.id)
  if (mappedNode) return mappedNode.slot

  const rackToken = normalizeToken(rack.name)
  return (
    blueprint.slots.find((slot) =>
      slot.aliases.some((alias) => normalizeToken(alias) === rackToken)
    ) ?? null
  )
}

function createOverflowSlot(rack: Rack, index: number): RackBlueprintSlot {
  return {
    key: `OVERFLOW_${normalizeToken(rack.name)}_${index}`,
    displayName: rack.name,
    aliases: [rack.name],
    rackType: 'single',
    x: 930 + (index % 2) * 150,
    y: 430 + Math.floor(index / 2) * 126,
    width: 138,
    height: 104,
    tone: 'support',
  }
}

export function buildVisualRackNodes(
  warehouse: Warehouse,
  blueprint: WarehouseBlueprint,
  options?: {
    autoAssignByOrder?: boolean
  }
): VisualRackNode[] {
  const autoAssignByOrder = options?.autoAssignByOrder ?? false
  const usedRackIds = new Set<string>()
  const sortedRacks = sortRacksForVisualMapping(warehouse.racks)
  const explicitMatches = new Map<string, { rack: Rack; alias: string }>()

  blueprint.slots.forEach((slot) => {
    const match = sortedRacks.find((candidate) => {
      if (usedRackIds.has(candidate.id)) return false

      return slot.aliases.some((alias) => normalizeToken(alias) === normalizeToken(candidate.name))
    })

    if (!match) return

    const matchedAlias =
      slot.aliases.find((alias) => normalizeToken(alias) === normalizeToken(match.name)) ?? slot.aliases[0]

    usedRackIds.add(match.id)
    explicitMatches.set(slot.key, { rack: match, alias: matchedAlias })
  })

  const autoMatches = new Map<string, Rack>()

  if (autoAssignByOrder) {
    const remainingSlots = blueprint.slots.filter((slot) => !explicitMatches.has(slot.key))
    const remainingRacks = sortedRacks.filter((rack) => !usedRackIds.has(rack.id))

    remainingSlots.forEach((slot, index) => {
      const rack = remainingRacks[index]
      if (!rack) return
      usedRackIds.add(rack.id)
      autoMatches.set(slot.key, rack)
    })
  }

  const blueprintNodes = blueprint.slots.map((slot) => {
    const explicitMatch = explicitMatches.get(slot.key)
    const autoMatch = autoMatches.get(slot.key)
    const rack = explicitMatch?.rack ?? autoMatch ?? null
    const mappingMode: RackVisualMappingMode = explicitMatch ? 'alias' : autoMatch ? 'auto' : 'empty'

    const totalSkus =
      rack?.shelves.reduce((sum, shelf) => sum + shelf.productStocks.length, 0) ?? 0
    const totalUnits =
      rack?.shelves.reduce(
        (sum, shelf) =>
          sum + shelf.productStocks.reduce((stockSum, stock) => stockSum + stock.quantity, 0),
        0
      ) ?? 0
    const occupiedShelves =
      rack?.shelves.filter((shelf) => shelf.productStocks.length > 0).length ?? 0

    return {
      slot,
      rack,
      totalSkus,
      totalUnits,
      occupiedShelves,
      mappingMode,
      matchedAlias: explicitMatch?.alias ?? null,
    }
  })

  const overflowNodes = sortedRacks
    .filter((rack) => !usedRackIds.has(rack.id))
    .map((rack, index) => ({
      slot: createOverflowSlot(rack, index),
      rack,
      totalSkus: rack.shelves.reduce((sum, shelf) => sum + shelf.productStocks.length, 0),
      totalUnits: rack.shelves.reduce(
        (sum, shelf) =>
          sum + shelf.productStocks.reduce((stockSum, stock) => stockSum + stock.quantity, 0),
        0
      ),
      occupiedShelves: rack.shelves.filter((shelf) => shelf.productStocks.length > 0).length,
      mappingMode: 'overflow' as const,
      matchedAlias: null,
    }))

  return [...blueprintNodes, ...overflowNodes]
}

export function getRackTone(node: VisualRackNode) {
  if (!node.rack) return 'empty'
  if (node.totalUnits <= 0) return 'empty'
  if (node.totalUnits < 15) return 'partial'
  return 'full'
}

function parseLevel(value: string, fallbackIndex: number) {
  const match = value.match(/(\d{1,2})/)
  if (!match) return clamp(fallbackIndex + 1, 1, 7)
  return clamp(Number(match[1]), 1, 7)
}

function parseExplicitSide(value: string): ShelfSide | null {
  if (/\b(LEFT|IZQ|IZQUIERDA)\b/i.test(value) || /(\d{1,2})\s*(L|IZQ)\b/i.test(value)) {
    return 'left'
  }
  if (/\b(RIGHT|DER|DERECHA)\b/i.test(value) || /(\d{1,2})\s*(R|DER)\b/i.test(value)) {
    return 'right'
  }
  return null
}

export function parseShelfPlacement(
  shelf: Shelf,
  rackType: RackFaceType,
  fallbackIndex: number
): ShelfPlacement {
  const raw = `${shelf.name} ${shelf.description}`.toUpperCase()
  const level = parseLevel(raw, fallbackIndex)

  if (rackType === 'single') {
    return {
      level,
      side: 'single',
      source: raw.match(/(\d{1,2})/) ? 'parsed' : 'fallback',
    }
  }

  const explicitSide = parseExplicitSide(raw)
  if (explicitSide) {
    return {
      level,
      side: explicitSide,
      source: 'parsed',
    }
  }

  return {
    level,
    side: fallbackIndex < 7 ? 'left' : 'right',
    source: 'fallback',
  }
}

export function getPlacementKey(placement: ShelfPlacement) {
  return `${placement.side}-${placement.level}`
}

export function buildRackPlacementMap(
  rack: Rack,
  rackType: RackFaceType
): Map<string, RackShelfPlacementEntry[]> {
  const grouped = new Map<string, RackShelfPlacementEntry[]>()

  rack.shelves
    .slice()
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name)
    })
    .forEach((shelf, index) => {
      const placement = parseShelfPlacement(shelf, rackType, index)
      const key = getPlacementKey(placement)
      const list = grouped.get(key) ?? []
      list.push({ shelf, placement })
      grouped.set(key, list)
    })

  return grouped
}

export function getActivePlacementEntry(
  entries: RackShelfPlacementEntry[] | undefined,
  selectedShelfId: string | null
) {
  if (!entries || entries.length === 0) return null
  return entries.find((entry) => entry.shelf.id === selectedShelfId) ?? entries[0]
}

export function flattenMaterialSearchHits(
  warehouse: Warehouse,
  blueprint: WarehouseBlueprint,
  visualNodes?: VisualRackNode[]
) {
  const hits: MaterialSearchHit[] = []

  warehouse.racks.forEach((rack) => {
    const slot = getRackSlotForRack(rack, blueprint, visualNodes)
    const rackType = slot?.rackType ?? 'single'

    rack.shelves.forEach((shelf, shelfIndex) => {
      const placement = parseShelfPlacement(shelf, rackType, shelfIndex)
      shelf.productStocks.forEach((stock) => {
        hits.push({
          key: `${stock.product.id}-${shelf.id}`,
          productId: stock.product.id,
          productName: stock.product.name,
          productCode: stock.product.code,
          productFamily: stock.product.family,
          quantity: stock.quantity,
          rack,
          shelf,
          warehouse,
          placement,
        })
      })
    })
  })

  return hits
}

function getSearchScore(hit: MaterialSearchHit, query: string) {
  const q = query.trim().toUpperCase()
  const name = hit.productName.toUpperCase()
  const code = hit.productCode.toUpperCase()
  const family = hit.productFamily.toUpperCase()

  if (code === q) return 0
  if (name === q) return 1
  if (family === q) return 2
  if (code.startsWith(q)) return 3
  if (name.startsWith(q)) return 4
  if (family.startsWith(q)) return 5
  if (code.includes(q)) return 6
  if (name.includes(q)) return 7
  if (family.includes(q)) return 8
  return 12
}

export function searchMaterialHits(
  warehouse: Warehouse,
  query: string,
  blueprint: WarehouseBlueprint,
  visualNodes?: VisualRackNode[]
) {
  const normalizedQuery = query.trim().toUpperCase()
  if (!normalizedQuery) return []

  return flattenMaterialSearchHits(warehouse, blueprint, visualNodes)
    .filter((hit) => {
      const name = hit.productName.toUpperCase()
      const code = hit.productCode.toUpperCase()
      const family = hit.productFamily.toUpperCase()
      return (
        name.includes(normalizedQuery) ||
        code.includes(normalizedQuery) ||
        family.includes(normalizedQuery)
      )
    })
    .sort((a, b) => {
      const scoreDiff = getSearchScore(a, normalizedQuery) - getSearchScore(b, normalizedQuery)
      if (scoreDiff !== 0) return scoreDiff
      if (b.quantity !== a.quantity) return b.quantity - a.quantity
      return a.productName.localeCompare(b.productName)
    })
}

export function getSideLabelKey(side: ShelfSide): MessageKey {
  if (side === 'left') return 'warehouses.visual.left'
  if (side === 'right') return 'warehouses.visual.right'
  return 'warehouses.visual.front'
}
