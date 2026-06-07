import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getConversionFactor, packagesToBase } from '@/lib/stock-units'

export async function GET(request: NextRequest) {
  try {
    const transfers = await db.transfers.findMany({
      include: {
        product: true,
        fromShelf: {
          include: {
            rack: { include: { warehouse: true } },
          },
        },
        toShelf: {
          include: {
            rack: { include: { warehouse: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      transfers.map((transfer) => ({
        ...transfer,
        quantity: Number(transfer.quantity),
      }))
    )
  } catch (error) {
    console.error('Error al listar transferencias:', error)
    return NextResponse.json({ error: 'Error al listar transferencias' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fromShelfId, toShelfId, productId, quantity, transferDate, notes } = body

    if (!fromShelfId || !toShelfId || !productId || !quantity) {
      return NextResponse.json(
        { error: 'Los campos fromShelfId, toShelfId, productId y quantity son obligatorios' },
        { status: 400 }
      )
    }

    if (fromShelfId === toShelfId) {
      return NextResponse.json(
        { error: 'La estanteria de origen y destino no pueden ser iguales' },
        { status: 400 }
      )
    }

    const transfer = await db.$transaction(async (tx) => {
      const product = await tx.products.findUnique({
        where: { id: productId },
        select: { unitOfMeasure: true, unitQuantity: true },
      })
      const factor = getConversionFactor(product ?? {})
      const baseDelta = packagesToBase(Number(quantity), factor)

      // Decrement stock from source shelf
      const fromStock = await tx.productShelfStock.findUnique({
        where: {
          productId_shelfId: {
            productId,
            shelfId: fromShelfId,
          },
        },
      })

      if (!fromStock || Number(fromStock.quantity) < Number(quantity)) {
        throw new Error('Stock insuficiente en la estanteria de origen')
      }

      const newFromQty = Number(fromStock.quantity) - Number(quantity)
      const newFromBase = Math.max(Number(fromStock.baseQuantity || 0) - baseDelta, 0)
      if (newFromQty === 0) {
        await tx.productShelfStock.delete({ where: { id: fromStock.id } })
      } else {
        await tx.productShelfStock.update({
          where: { id: fromStock.id },
          data: { quantity: newFromQty, baseQuantity: newFromBase },
        })
      }

      // Increment stock at destination shelf
      await tx.productShelfStock.upsert({
        where: {
          productId_shelfId: {
            productId,
            shelfId: toShelfId,
          },
        },
        create: {
          productId,
          shelfId: toShelfId,
          quantity,
          baseQuantity: baseDelta,
        },
        update: {
          quantity: { increment: quantity },
          baseQuantity: { increment: baseDelta },
        },
      })

      // Create transfer record
      return tx.transfers.create({
        data: {
          fromShelfId,
          toShelfId,
          productId,
          quantity,
          baseQuantity: baseDelta,
          transferDate: transferDate || new Date().toISOString().split('T')[0],
          notes: notes || '',
        },
        include: {
          product: true,
          fromShelf: {
            include: { rack: { include: { warehouse: true } } },
          },
          toShelf: {
            include: { rack: { include: { warehouse: true } } },
          },
        },
      })
    })

    return NextResponse.json(transfer, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al crear transferencia'
    console.error('Error al crear transferencia:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
