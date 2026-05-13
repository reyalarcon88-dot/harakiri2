import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertProjectDispatchWithinPlan,
  incrementProjectDispatchQuantities,
  ProjectDispatchValidationError,
} from '@/lib/server/project-dispatch'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const dispatches = await db.dispatches.findMany({
      where: { projectId: id },
      include: {
        items: {
          include: {
            product: true,
            shelf: {
              include: {
                rack: { include: { warehouse: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(dispatches)
  } catch (error) {
    console.error('Error al listar despachos:', error)
    return NextResponse.json({ error: 'Error al listar despachos' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const items = Array.isArray(body?.items) ? body.items : []
    const dispatchDate = body?.dispatchDate
    const notes = body?.notes

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Los items son obligatorios' },
        { status: 400 }
      )
    }

    for (const item of items) {
      if (!item?.productId || !item?.shelfId || !Number.isFinite(Number(item?.quantity)) || Number(item.quantity) <= 0) {
        return NextResponse.json(
          { error: 'Cada item requiere producto, ubicacion y cantidad valida' },
          { status: 400 }
        )
      }
    }

    const dispatch = await db.$transaction(async (tx) => {
      await assertProjectDispatchWithinPlan(
        tx,
        id,
        items.map((item) => ({
          productId: String(item.productId),
          quantity: Number(item.quantity),
        }))
      )

      const newDispatch = await tx.dispatches.create({
        data: {
          projectId: id,
          dispatchDate: dispatchDate || new Date().toISOString().split('T')[0],
          notes: notes || '',
        },
      })

      for (const item of items) {
        const productId = String(item.productId)
        const shelfId = String(item.shelfId)
        const quantity = Number(item.quantity)
        const allowReserve = item.allowReserve === true

        type StockRow = { id: string; quantity: string | number; reserve_quantity: string | number; is_reserve_shelf: number }
        const [stock] = await tx.$queryRaw<StockRow[]>`
          SELECT id, quantity, reserve_quantity, is_reserve_shelf
          FROM product_shelf_stock
          WHERE product_id = ${productId} AND shelf_id = ${shelfId}
        `

        if (!stock) {
          throw new ProjectDispatchValidationError(
            `No hay stock registrado en la ubicacion seleccionada`
          )
        }

        const totalQty = Number(stock.quantity)
        const reserveQty = Number(stock.reserve_quantity || 0)
        const isReserveShelf = Boolean(stock.is_reserve_shelf)
        const availableQty = isReserveShelf ? 0 : Math.max(totalQty - reserveQty, 0)

        if (!allowReserve && availableQty < quantity) {
          throw new ProjectDispatchValidationError(
            `Stock disponible insuficiente: ${availableQty} disponibles (${reserveQty} en reserva). Para usar stock de reserva habilita la opción.`
          )
        }
        if (allowReserve && totalQty < quantity) {
          throw new ProjectDispatchValidationError(
            `No hay suficiente stock total en la ubicacion seleccionada (${totalQty} en total)`
          )
        }

        const newQty = totalQty - quantity
        if (newQty === 0) {
          await tx.$executeRaw`DELETE FROM product_shelf_stock WHERE id = ${stock.id}`
        } else {
          // If using reserve stock, reduce reserve_quantity proportionally
          const newReserve = allowReserve
            ? Math.max(reserveQty - Math.max(quantity - availableQty, 0), 0)
            : reserveQty
          await tx.$executeRaw`
            UPDATE product_shelf_stock SET quantity = ${newQty}, reserve_quantity = ${newReserve} WHERE id = ${stock.id}
          `
        }

        await tx.products.update({
          where: { id: productId },
          data: { currentStock: { decrement: quantity } },
        })

        await tx.dispatchItems.create({
          data: {
            dispatchId: newDispatch.id,
            productId,
            shelfId,
            quantity,
          },
        })
      }

      await incrementProjectDispatchQuantities(
        tx,
        id,
        items.map((item) => ({
          productId: String(item.productId),
          quantity: Number(item.quantity),
        }))
      )

      const proj = await tx.projects.findUnique({ where: { id }, select: { status: true } })
      if (proj && proj.status !== 'finished' && proj.status !== 'cancelled' && proj.status !== 'dispatched') {
        await tx.projects.update({ where: { id }, data: { status: 'dispatched' } })
      }

      return tx.dispatches.findUnique({
        where: { id: newDispatch.id },
        include: {
          items: {
            include: {
              product: true,
              shelf: {
                include: {
                  rack: { include: { warehouse: true } },
                },
              },
            },
          },
        },
      })
    })

    return NextResponse.json(dispatch, { status: 201 })
  } catch (error) {
    console.error('Error al crear despacho:', error)
    if (error instanceof ProjectDispatchValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear despacho' }, { status: 500 })
  }
}
