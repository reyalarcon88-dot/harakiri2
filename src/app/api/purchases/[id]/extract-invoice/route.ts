import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function hashSeed(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h
}

function seededVariation(seed: number, range: number): number {
  const normalized = (seed % 10000) / 10000
  return 1 + (normalized - 0.5) * 2 * range
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const purchase = await db.purchases.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, referencePrice: true } },
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    const invoiceLines = purchase.items.map((item, idx) => {
      const seed = hashSeed(`${id}-${item.id}-${idx}`)
      const variation = seededVariation(seed, 0.15)
      const rawPrice = item.product.referencePrice > 0
        ? item.product.referencePrice * variation
        : item.unitPrice * variation
      const unitPrice = Math.round(rawPrice * 100) / 100

      return {
        id: `mock-line-${idx + 1}`,
        description: item.product.name,
        sku: item.product.code || null,
        quantity: item.quantity,
        unitPrice,
        lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
      }
    })

    invoiceLines.push({
      id: 'mock-line-extra-1',
      description: 'Flete y manejo',
      sku: null,
      quantity: 1,
      unitPrice: 350,
      lineTotal: 350,
    })

    invoiceLines.push({
      id: 'mock-line-extra-2',
      description: 'Descuento especial proveedor',
      sku: null,
      quantity: 1,
      unitPrice: -150,
      lineTotal: -150,
    })

    const invoiceNumber = `INV-${purchase.purchaseCode}-MOCK`
    const today = new Date().toISOString().slice(0, 10)

    return NextResponse.json({
      vendor: purchase.supplier.name,
      invoiceNumber,
      invoiceDate: today,
      currency: 'USD',
      lines: invoiceLines,
      _mock: true,
    })
  } catch (error) {
    console.error('Error extracting invoice (mock):', error)
    return NextResponse.json({ error: 'Error al extraer factura' }, { status: 500 })
  }
}
