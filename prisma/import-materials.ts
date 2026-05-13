import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const db = new PrismaClient()

// Parse Spanish-format number ("9,5" -> 9.5, "" -> 0)
function parseNum(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/"/g, '').replace(',', '.').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// Parse one CSV line into fields, respecting quoted fields
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  fields.push(cur)
  return fields
}

// Normalize family name: trim, collapse spaces, uppercase
function normalizeFamily(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toUpperCase()
}

// Map raw color code to display label
function colorLabel(raw: string): string {
  const c = raw.trim().toUpperCase()
  const map: Record<string, string> = {
    BRZ: 'Bronce', WHT: 'Blanco', ALM: 'Aluminio',
    ZINC: 'Zinc', BLK: 'Negro', BLUE: 'Azul',
  }
  return map[c] ?? c
}

async function main() {
  const csvPath = join(process.cwd(), 'tmp_materials.csv')
  const raw = readFileSync(csvPath, 'utf-8')
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0)
  lines.shift() // drop header

  let created = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const color = (fields[0] ?? '').trim()
    const name  = (fields[1] ?? '').replace(/\s+/g, ' ').trim()
    const family = normalizeFamily(fields[2] ?? '')
    const unitPrice = parseNum(fields[3] ?? '')   // per ft/pc/und
    const cost      = parseNum(fields[4] ?? '')   // total unit cost

    if (!name) { skipped++; continue }

    // Reference price: prefer total cost, else per-unit price
    const referencePrice = cost > 0 ? cost : unitPrice

    const code = `MAT-${String(i + 1).padStart(3, '0')}`

    const existing = await db.products.findUnique({ where: { code } })

    await db.products.upsert({
      where: { code },
      create: {
        code,
        name,
        family,
        color: colorLabel(color),
        unitOfMeasure: 'pza',
        unitQuantity: '',
        minStock: 0,
        currentStock: 0,
        referencePrice,
      },
      update: {
        name,
        family,
        color: colorLabel(color),
        referencePrice,
      },
    })

    if (existing) updated++
    else created++
  }

  console.log(`\nMaterials import complete:`)
  console.log(`  Created: ${created}`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Total processed: ${lines.length}`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
