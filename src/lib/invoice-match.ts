export type MatchMethod = 'sku' | 'exact_name' | 'token' | 'none'

export interface ExtractedLine {
  id: string
  description: string
  sku: string | null
  quantity: number
  unitPrice: number
  lineTotal: number | null
}

export interface InvoiceMatchResult {
  invoiceLine: ExtractedLine
  purchaseItemId: string | null
  confidence: number
  matchMethod: MatchMethod
}

interface PurchaseItemForMatch {
  id: string
  quantity: number
  product: { name: string; code: string }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenJaccard(a: string, b: string): number {
  const tokA = new Set(normalize(a).split(' ').filter(Boolean))
  const tokB = new Set(normalize(b).split(' ').filter(Boolean))
  if (tokA.size === 0 || tokB.size === 0) return 0
  let intersection = 0
  tokA.forEach((t) => { if (tokB.has(t)) intersection++ })
  const union = new Set([...tokA, ...tokB]).size
  return intersection / union
}

export function matchInvoiceLines(
  lines: ExtractedLine[],
  items: PurchaseItemForMatch[]
): InvoiceMatchResult[] {
  const usedItemIds = new Set<string>()

  return lines.map((line): InvoiceMatchResult => {
    let best: { id: string; confidence: number; method: MatchMethod } | null = null

    for (const item of items) {
      if (usedItemIds.has(item.id)) continue

      let confidence = 0
      let method: MatchMethod = 'none'

      if (line.sku && normalize(line.sku) === normalize(item.product.code)) {
        confidence = 0.98
        method = 'sku'
      } else if (normalize(line.description) === normalize(item.product.name)) {
        confidence = 0.92
        method = 'exact_name'
      } else {
        const j = tokenJaccard(line.description, item.product.name)
        if (j >= 0.5) {
          // maps [0.5, 1.0] → [0.725, 0.95]
          confidence = 0.5 + j * 0.45
          method = 'token'
        }
      }

      if (confidence > 0) {
        const qtyRatio =
          Math.abs(line.quantity - item.quantity) /
          Math.max(line.quantity, item.quantity, 1)
        if (qtyRatio <= 0.05) confidence = Math.min(1, confidence + 0.05)
      }

      if (confidence > (best?.confidence ?? 0)) {
        best = { id: item.id, confidence, method }
      }
    }

    if (best && best.confidence >= 0.30) {
      usedItemIds.add(best.id)
      return {
        invoiceLine: line,
        purchaseItemId: best.id,
        confidence: best.confidence,
        matchMethod: best.method,
      }
    }

    return { invoiceLine: line, purchaseItemId: null, confidence: 0, matchMethod: 'none' }
  })
}
