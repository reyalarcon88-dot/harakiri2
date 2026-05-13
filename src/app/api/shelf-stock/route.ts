import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, quantity } = body

    if (!id || quantity === undefined) {
      return NextResponse.json({ error: 'ID and quantity are required' }, { status: 400 })
    }

    const existing = await db.productShelfStock.findUnique({
      where: { id },
      include: { product: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Stock record not found' }, { status: 404 })
    }

    const newQuantity = Math.max(0, quantity)

    const updated = await db.productShelfStock.update({
      where: { id },
      data: { quantity: newQuantity },
    })

    const oldQuantity = existing.quantity
    const diff = newQuantity - oldQuantity

    if (diff !== 0) {
      await db.products.update({
        where: { id: existing.productId },
        data: { currentStock: { increment: diff } },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Shelf stock update error:', error)
    return NextResponse.json({ error: 'Failed to update shelf stock' }, { status: 500 })
  }
}
