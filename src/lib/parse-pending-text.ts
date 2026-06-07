interface Material {
  productId: string
  product: { id: string; name: string; code: string }
}

type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

const DAYS: Record<string, DayIndex> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
}

function todayLocal(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function plusDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function nextWeekday(from: Date, target: DayIndex): Date {
  const diff = ((target - from.getDay()) + 7) % 7 || 7
  return plusDays(from, diff)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function parseDate(text: string): { title: string; dueDate: string | null } {
  const today = todayLocal()

  const patterns: Array<[RegExp, (m: RegExpMatchArray) => Date | null]> = [
    [/\bma[ñn]ana\b/i, () => plusDays(today, 1)],
    [/\bhoy\b/i, () => today],
    [/\bpr[oó]xim[ao]\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i, (m) => {
      const day = DAYS[norm(m[1])]
      return day !== undefined ? plusDays(nextWeekday(today, day), 7) : null
    }],
    [/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i, (m) => {
      const day = DAYS[norm(m[1])]
      return day !== undefined ? nextWeekday(today, day) : null
    }],
    [/\bel\s+(\d{1,2})\b/i, (m) => {
      const d = parseInt(m[1])
      if (d < 1 || d > 31) return null
      const c = new Date(today.getFullYear(), today.getMonth(), d)
      if (c <= today) c.setMonth(c.getMonth() + 1)
      return c
    }],
    [/\b(\d{1,2})\/(\d{1,2})\b/, (m) => {
      const d = parseInt(m[1]), mo = parseInt(m[2])
      const c = new Date(today.getFullYear(), mo - 1, d)
      if (c <= today) c.setFullYear(c.getFullYear() + 1)
      return c
    }],
  ]

  for (const [rx, fn] of patterns) {
    const match = text.match(rx)
    if (match) {
      const date = fn(match)
      if (date) {
        return {
          title: text.replace(rx, ' ').replace(/\s{2,}/g, ' ').trim(),
          dueDate: toISO(date),
        }
      }
    }
  }

  return { title: text, dueDate: null }
}

export function parsePendingText(
  input: string,
  projectMaterials: Material[] = [],
): {
  title: string
  dueDate: string | null
  priority: number
  linkedMaterial: { productId: string; code: string; name: string } | null
} {
  let text = input.trim()
  let priority = 2
  let linkedMaterial: { productId: string; code: string; name: string } | null = null

  if (/^!!\s*/.test(text)) {
    priority = 1
    text = text.replace(/^!!\s*/, '').trim()
  } else if (/^urgente\b/i.test(text)) {
    priority = 1
    text = text.replace(/^urgente\b\s*/i, '').trim()
  }

  const lower = text.toLowerCase()
  for (const mat of projectMaterials) {
    if (lower.includes(mat.product.code.toLowerCase())) {
      linkedMaterial = { productId: mat.productId, code: mat.product.code, name: mat.product.name }
      break
    }
  }

  const { title, dueDate } = parseDate(text)
  return { title, dueDate, priority, linkedMaterial }
}
