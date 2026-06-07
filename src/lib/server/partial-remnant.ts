import type { Prisma } from '@prisma/client'
import { detectCutLength, replaceLastCutLengthToken } from '@/lib/cut-stock'

// Extracts the first number from a string-like value
// e.g. "24" -> 24, "24'" -> 24, "INS-3X11-24'" -> 3 (not 24!)
// Used for unitQuantity parsing where the value is just the size.
function firstNumber(value: unknown) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

// Extracts the LAST number from a string with multiple numbers
// e.g. "INS-3X11-24'" -> 24, "Insert 3x11x24'" -> 24
function lastDimensionalNumber(value: unknown) {
  const matches = String(value ?? '').match(/\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) return null
  const n = Number(matches[matches.length - 1])
  return Number.isFinite(n) ? n : null
}

// Detects the "original size" of a product. Used to know the piece length
// of a linear product (e.g. 24' for an insert sold in 24-foot pieces).
//   1) Prefers Products.unitQuantity if set and numeric
//   2) Falls back to the last number in the name (e.g. "Insert 3x11x24'" -> 24)
//   3) Then the last number in the code (e.g. "INS-3X11-24" -> 24)
export function detectOriginalSize(product: { unitQuantity: unknown; name: string; code: string }) {
  return detectCutLength(product)
}

function formatSize(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, '')
}

// Replaces the LAST occurrence of a size token (e.g. "x24'") in a string with
// a new size (e.g. "x18'"). Used to derive the remnant code/name.
//   "INS-3X11-24'" + (24 -> 18) -> "INS-3X11-18'"
//   "Insert 3x11x24'" + (24 -> 18) -> "Insert 3x11x18'"
export function replaceLastSizeToken(value: string, originalSize: number, remnantSize: number) {
  return replaceLastCutLengthToken(value, originalSize, remnantSize)
}

export class PartialRemnantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PartialRemnantError'
  }
}

// Given a source product and a remnant size, returns (or creates) the matching
// remnant product. Inherits family/section/color/preferredShelf/etc from source.
// This is the canonical way to derive shorter-piece products from a long one.
export async function resolvePartialRemnantProduct(
  tx: Prisma.TransactionClient,
  sourceProductId: string,
  remnantSize: number,
) {
  const original = await tx.products.findUnique({ where: { id: sourceProductId } })
  if (!original) {
    throw new PartialRemnantError('Producto fuente no encontrado')
  }

  const originalSize = detectOriginalSize(original)
  if (!originalSize || originalSize <= 0) {
    throw new PartialRemnantError('No se pudo detectar el tamaño original del producto fuente')
  }

  if (!Number.isFinite(remnantSize) || remnantSize <= 0) {
    throw new PartialRemnantError('El tamaño del sobrante debe ser mayor que 0')
  }

  if (remnantSize >= originalSize) {
    throw new PartialRemnantError('El sobrante debe ser menor que el tamaño original')
  }

  const remnantCode = replaceLastSizeToken(original.code, originalSize, remnantSize)
  const existing = await tx.products.findUnique({ where: { code: remnantCode } })
  if (existing) return existing

  return tx.products.create({
    data: {
      code: remnantCode,
      name: replaceLastSizeToken(original.name, originalSize, remnantSize),
      family: original.family,
      engineeringSection: original.engineeringSection,
      color: original.color,
      unitOfMeasure: 'pza',
      unitQuantity: formatSize(remnantSize),
      minStock: original.minStock,
      currentStock: 0,
      referencePrice: original.referencePrice,
      preferredShelfId: original.preferredShelfId,
    },
  })
}
