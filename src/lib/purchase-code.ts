type PurchaseCodeClient = {
  purchases: {
    findMany: (args: {
      where: { purchaseCode: { startsWith: string } }
      select: { purchaseCode: true }
    }) => Promise<{ purchaseCode: string }[]>
  }
}

const STOP_WORDS = new Set([
  'DE',
  'DEL',
  'LA',
  'LAS',
  'EL',
  'LOS',
  'Y',
  'AND',
  'THE',
  'OF',
  'PARA',
  'POR',
  'PROJECT',
  'PROYECTO',
])

function normalizeCodeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

export function buildPurchaseCodePrefix(poNumber?: string | null) {
  const normalized = normalizeCodeText(poNumber || '')
  const tokens = normalized.match(/[A-Z0-9]+/g) || []
  const wordTokens = tokens.filter((token) => /[A-Z]/.test(token) && !STOP_WORDS.has(token))

  if (wordTokens.length >= 2) {
    return wordTokens
      .slice(0, 4)
      .map((token) => token[0])
      .join('')
  }

  const compactTokens = tokens.join('').replace(/[^A-Z0-9]/g, '')
  const compact = wordTokens.length === 1 && tokens.length > 1 ? compactTokens : wordTokens[0] || compactTokens || 'OC'
  return compact.slice(0, 8) || 'OC'
}

export async function generatePurchaseCode(
  client: PurchaseCodeClient,
  poNumber?: string | null,
  purchaseDate?: string | null,
) {
  const prefix = buildPurchaseCodePrefix(poNumber)
  const date = purchaseDate ? new Date(`${purchaseDate}T00:00:00`) : new Date()
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear()
  const base = `${prefix}-OC-${year}`

  const existing = await client.purchases.findMany({
    where: { purchaseCode: { startsWith: `${base}-` } },
    select: { purchaseCode: true },
  })

  const nextNumber =
    existing.reduce((max, purchase) => {
      const match = purchase.purchaseCode.match(/-(\d+)$/)
      const value = match ? Number(match[1]) : 0
      return Number.isFinite(value) ? Math.max(max, value) : max
    }, 0) + 1

  return `${base}-${String(nextNumber).padStart(3, '0')}`
}
