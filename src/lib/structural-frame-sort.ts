// ─── Dimension utilities ─────────────────────────────────────────────────────

// Extracts all numeric values in order, resolving fractions to decimals.
// "HEX BOLT 3/8 X 4"" → [0.375, 4]   |   "3X8X24 GUTTER" → [3, 8, 24]
export function extractDimensions(name: string): number[] {
  const tokens: number[] = []
  const re = /(\d+)\/(\d+)|(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(name)) !== null) {
    if (m[1] !== undefined && m[2] !== undefined) {
      tokens.push(Number(m[1]) / Number(m[2]))
    } else if (m[3] !== undefined) {
      tokens.push(Number(m[3]))
    }
  }
  return tokens
}

// Larger dimension first (for Structural Frame)
function compareDimsDesc(aName: string, bName: string): number {
  const aDims = extractDimensions(aName)
  const bDims = extractDimensions(bName)
  const len = Math.max(aDims.length, bDims.length)
  for (let i = 0; i < len; i++) {
    const aVal = aDims[i] ?? 0
    const bVal = bDims[i] ?? 0
    if (aVal !== bVal) return bVal - aVal
  }
  return aName.localeCompare(bName)
}

// Smaller dimension first (for Fasteners & Hardware)
function compareDimsAsc(aName: string, bName: string): number {
  const aDims = extractDimensions(aName)
  const bDims = extractDimensions(bName)
  const len = Math.max(aDims.length, bDims.length)
  for (let i = 0; i < len; i++) {
    const aVal = aDims[i] ?? 0
    const bVal = bDims[i] ?? 0
    if (aVal !== bVal) return aVal - bVal
  }
  return aName.localeCompare(bName)
}

// ─── Fasteners & Hardware ────────────────────────────────────────────────────
// Type order: SMS → TEX → LDT CONCRET → BLUE TAP → HEX BOLT → NUTS → others
// Dimension order within each type: ascending (smaller first)
// BLUE TAP: same-size items grouped (size asc), white head before washer/cap

// IMPORTANT: blue tap nylon must be matched BEFORE blue tap (substring overlap),
// even though its sort order (4) is after regular blue tap (3).
const FASTENER_TYPE_KEYWORDS: [string[], number][] = [
  [['sms'], 0],
  [['tex'], 1],
  [['ldt', 'concret', 'concrete'], 2],
  [['blue tap nylon', 'bluetap nylon', 'blue nylon'], 4],
  [['blue tap', 'bluetap'], 3],
  [['hex bolt', 'hexbolt'], 5],
  [['nut', 'nuts'], 6],
]

export function getFastenerTypeOrder(name: string): number {
  const lower = name.toLowerCase()
  for (const [keywords, order] of FASTENER_TYPE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return order
  }
  return 7
}

function isBlueTapHead(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.includes('white head') ||
    lower.includes('whit head') ||
    lower.includes('w/h') ||
    // "with head" but not "with washer" — be specific
    (lower.includes('with head') && !lower.includes('washer'))
  )
}

// Within BLUE TAP: sort by size asc, then white head before washer/cap
function compareBlueTap(aName: string, bName: string): number {
  const dimDiff = compareDimsAsc(aName, bName)
  // compareDimsAsc falls through to localeCompare when dims match,
  // so we intercept before that to apply head-vs-washer ordering.
  const aDims = extractDimensions(aName)
  const bDims = extractDimensions(bName)
  const len = Math.max(aDims.length, bDims.length)
  let dimsEqual = true
  for (let i = 0; i < len; i++) {
    if ((aDims[i] ?? 0) !== (bDims[i] ?? 0)) { dimsEqual = false; break }
  }
  if (dimsEqual) {
    const aHead = isBlueTapHead(aName)
    const bHead = isBlueTapHead(bName)
    if (aHead !== bHead) return aHead ? -1 : 1
  }
  return dimDiff
}

export function compareFastenerMaterials(aName: string, bName: string): number {
  const aType = getFastenerTypeOrder(aName)
  const bType = getFastenerTypeOrder(bName)
  const typeDiff = aType - bType
  if (typeDiff !== 0) return typeDiff
  if (aType === 3) return compareBlueTap(aName, bName) // regular blue tap: size then head-vs-washer
  return compareDimsAsc(aName, bName)
}

// ─── Structural Frame ────────────────────────────────────────────────────────
// Type order: GUTTER → POST → SMB → PATIO → OB → COMPOSIFF/RECEIVER → ANGULOS → INSERT
// Dimension order within each type: descending (larger first)

const STRUCTURAL_TYPE_KEYWORDS: [string[], number][] = [
  [['gutter'], 0],
  [['post'], 1],
  [['smb'], 2],
  [['patio'], 3],
  [['ob'], 4],
  [['composiff', 'receiver', 'reciver'], 5],
  [['angulo', 'angle'], 6],
  [['insert'], 7],
]

export function getStructuralFrameTypeOrder(name: string): number {
  const lower = name.toLowerCase()
  for (const [keywords, order] of STRUCTURAL_TYPE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return order
  }
  return 8
}

export function compareStructuralFrameMaterials(aName: string, bName: string): number {
  const typeDiff = getStructuralFrameTypeOrder(aName) - getStructuralFrameTypeOrder(bName)
  if (typeDiff !== 0) return typeDiff
  return compareDimsDesc(aName, bName)
}

// ─── Generic helpers (used for all other sections) ───────────────────────────

// Strips all numeric/dimensional tokens to get the base product family.
// "HEX BOLT 3/8 X 4"" → "HEX BOLT"   |   "3X8X24 GUTTER" → "GUTTER"
export function getProductFamily(name: string): string {
  return name
    .replace(/\d+\/\d+/g, '')                   // fractions: 3/8
    .replace(/\d+[xX×]\d+(?:[xX×]\d+)*/g, '')   // NxMxP: 3X8X24
    .replace(/\d+["']/g, '')                      // numbers with unit: 4"
    .replace(/\b\d+\b/g, '')                      // remaining bare numbers
    .replace(/[xX×"'#\-]+/g, ' ')                 // leftover separators
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function compareMaterialsByDimensions(aName: string, bName: string): number {
  return compareDimsAsc(aName, bName)
}
