import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

type ProductField =
  | 'code'
  | 'name'
  | 'family'
  | 'color'
  | 'unitOfMeasure'
  | 'unitQuantity'
  | 'minStock'
  | 'currentStock'
  | 'referencePrice'

type ImportRow = Partial<Record<ProductField, unknown>>

type ImportError = {
  row: number
  reason: string
}

const HEADER_ALIASES: Record<string, ProductField> = {
  codigo: 'code',
  code: 'code',
  sku: 'code',
  nombre: 'name',
  producto: 'name',
  name: 'name',
  descripcion: 'name',
  familia: 'family',
  family: 'family',
  categoria: 'family',
  color: 'color',
  unidadmedida: 'unitOfMeasure',
  unidaddemedida: 'unitOfMeasure',
  unidad: 'unitOfMeasure',
  uom: 'unitOfMeasure',
  unitofmeasure: 'unitOfMeasure',
  cantidadunidad: 'unitQuantity',
  cantidadporunidad: 'unitQuantity',
  presentacion: 'unitQuantity',
  medida: 'unitQuantity',
  unitquantity: 'unitQuantity',
  stockminimo: 'minStock',
  minimo: 'minStock',
  minstock: 'minStock',
  stockactual: 'currentStock',
  stockinicial: 'currentStock',
  existencia: 'currentStock',
  currentstock: 'currentStock',
  precioreferencia: 'referencePrice',
  precio: 'referencePrice',
  costoreferencia: 'referencePrice',
  referenceprice: 'referencePrice',
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function asText(value: unknown) {
  return String(value ?? '').trim()
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const raw = asText(value)
    .replace(/[$\s]/g, '')
    .replace(/[^0-9,.-]/g, '')

  if (!raw) return 0

  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  const normalized =
    comma > -1 && dot > -1
      ? comma > dot
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '')
      : raw.replace(',', '.')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseInteger(value: unknown) {
  return Math.max(0, Math.round(parseNumber(value)))
}

function parsePrice(value: unknown) {
  return Math.max(0, parseNumber(value))
}

function mapRow(row: Record<string, unknown>): ImportRow {
  const mapped: ImportRow = {}

  for (const [header, value] of Object.entries(row)) {
    const field = HEADER_ALIASES[normalizeHeader(header)]
    if (field) mapped[field] = value
  }

  return mapped
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo Excel requerido' }, { status: 400 })
    }

    const isExcel =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls')

    if (!isExcel) {
      return NextResponse.json({ error: 'Debe subir un archivo .xlsx o .xls' }, { status: 400 })
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === 'productos') || workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    if (!sheet) {
      return NextResponse.json({ error: 'El archivo no contiene hojas legibles' }, { status: 400 })
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
      blankrows: false,
    })

    const errors: ImportError[] = []
    const seenCodes = new Set<string>()
    let created = 0
    let updated = 0
    let skipped = 0

    for (const [index, rawRow] of rawRows.entries()) {
      const rowNumber = index + 2
      const row = mapRow(rawRow)
      const code = asText(row.code)
      const name = asText(row.name)

      if (!code && !name) {
        skipped++
        continue
      }

      if (!code || !name) {
        errors.push({ row: rowNumber, reason: 'codigo y nombre son obligatorios' })
        skipped++
        continue
      }

      if (seenCodes.has(code)) {
        errors.push({ row: rowNumber, reason: `codigo duplicado en el archivo: ${code}` })
        skipped++
        continue
      }

      seenCodes.add(code)

      const existing = await db.products.findUnique({ where: { code } })

      await db.products.upsert({
        where: { code },
        create: {
          code,
          name,
          family: asText(row.family),
          color: asText(row.color),
          unitOfMeasure: asText(row.unitOfMeasure) || 'unidad',
          unitQuantity: asText(row.unitQuantity),
          minStock: parseInteger(row.minStock),
          currentStock: parseInteger(row.currentStock),
          referencePrice: parsePrice(row.referencePrice),
        },
        update: {
          name,
          family: asText(row.family),
          color: asText(row.color),
          unitOfMeasure: asText(row.unitOfMeasure) || 'unidad',
          unitQuantity: asText(row.unitQuantity),
          minStock: parseInteger(row.minStock),
          currentStock: parseInteger(row.currentStock),
          referencePrice: parsePrice(row.referencePrice),
        },
      })

      if (existing) updated++
      else created++
    }

    return NextResponse.json({
      message: `Importacion completada: ${created} creados, ${updated} actualizados, ${skipped} omitidos.`,
      created,
      updated,
      skipped,
      errors,
      totalRows: rawRows.length,
    })
  } catch (error) {
    console.error('POST /api/settings/products-import error:', error)
    return NextResponse.json({ error: 'Error al importar productos' }, { status: 500 })
  }
}
