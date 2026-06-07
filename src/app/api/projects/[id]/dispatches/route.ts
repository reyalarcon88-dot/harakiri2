import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertProjectDispatchWithinPlan,
  incrementProjectDispatchQuantities,
  ProjectDispatchValidationError,
} from '@/lib/server/project-dispatch'
import {
  resolvePartialRemnantProduct,
  PartialRemnantError,
} from '@/lib/server/partial-remnant'
import { getConversionFactor, packagesToBase } from '@/lib/stock-units'
import { computeCutPlan, isCuttableSourceForTarget } from '@/lib/cut-stock'

type RemainderHandling = 'short-piece' | 'reserved' | 'scrap'

function normalizeRemainderHandling(value: unknown): RemainderHandling {
  return value === 'reserved' || value === 'scrap' ? value : 'short-piece'
}

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
      // Allow no shelf when cutting from a recepción item (it lives outside shelves)
      const sourceShelf = item?.shelfId || item?.cutFromShelfId || item?.cutFromRecepcionItemId
      if (!item?.productId || !sourceShelf || !Number.isFinite(Number(item?.quantity)) || Number(item.quantity) <= 0) {
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

      const crossCutTraces: string[] = []
      const newDispatch = await tx.dispatches.create({
        data: {
          projectId: id,
          dispatchDate: dispatchDate || new Date().toISOString().split('T')[0],
          notes: notes || '',
        },
      })

      type StockRow = { id: string; quantity: string | number; reserve_quantity: string | number; is_reserve_shelf: number; base_quantity?: string | number }

      for (const item of items) {
        const productId = String(item.productId) // the product the project planned (B = 6')
        const shelfId = String(item.shelfId)
        const quantity = Number(item.quantity) // what the project receives
        const allowReserve = item.allowReserve === true
        const explicitBaseQty = item.baseQuantity != null && Number.isFinite(Number(item.baseQuantity))
          ? Number(item.baseQuantity)
          : null

        // ─── Cross-product cut path ─────────────────────────────────────
        // If cutFromProductId is set, consume from a LONGER source product (A = 24')
        // and (optionally) create/update a shorter remnant product (C = 18') for stock.
        const cutFromProductId = item.cutFromProductId ? String(item.cutFromProductId) : null
        if (cutFromProductId) {
          const cutFromShelfId = String(item.cutFromShelfId || shelfId)
          const remainderHandling = normalizeRemainderHandling(item.remainderHandling)

          const [sourceProduct, targetProduct] = await Promise.all([
            tx.products.findUnique({ where: { id: cutFromProductId } }),
            tx.products.findUnique({ where: { id: productId } }),
          ])
          if (!sourceProduct) {
            throw new ProjectDispatchValidationError(`Producto fuente para corte no encontrado`)
          }
          if (!targetProduct) {
            throw new ProjectDispatchValidationError(`Producto planificado para corte no encontrado`)
          }
          if (!isCuttableSourceForTarget(targetProduct, sourceProduct)) {
            throw new ProjectDispatchValidationError(
              `El producto ${sourceProduct.code} no es compatible para cortar ${targetProduct.code}`,
            )
          }

          const sourceCode = sourceProduct.code
          const cutPlan = computeCutPlan(quantity, targetProduct, sourceProduct)
          if (!cutPlan) {
            throw new ProjectDispatchValidationError(
              `No se pudo detectar el tamaño original del producto fuente ${sourceCode}`,
            )
          }

          const piecesNeeded = cutPlan.sourcePiecesNeeded

          // Decrement source pieces from shelf stock
          const [sourceStock] = await tx.$queryRaw<StockRow[]>`
            SELECT id, quantity, reserve_quantity, is_reserve_shelf, base_quantity
            FROM product_shelf_stock
            WHERE product_id = ${cutFromProductId} AND shelf_id = ${cutFromShelfId}
          `
          if (!sourceStock) {
            throw new ProjectDispatchValidationError(
              `No hay stock de ${sourceCode} en la ubicación seleccionada para cortar`,
            )
          }
          const sourceTotal = Number(sourceStock.quantity)
          if (sourceTotal < piecesNeeded) {
            throw new ProjectDispatchValidationError(
              `No hay suficientes piezas de ${sourceCode} para cortar (necesita ${piecesNeeded}, hay ${sourceTotal})`,
            )
          }
          const sourceNewQty = sourceTotal - piecesNeeded
          const sourceBaseQty = Number(sourceStock.base_quantity || 0)
          const sourceNewBaseQty = Math.max(sourceBaseQty - piecesNeeded, 0)
          if (sourceNewQty === 0) {
            await tx.$executeRaw`DELETE FROM product_shelf_stock WHERE id = ${sourceStock.id}`
          } else {
            await tx.$executeRaw`
              UPDATE product_shelf_stock
              SET quantity = ${sourceNewQty}, base_quantity = ${sourceNewBaseQty}
              WHERE id = ${sourceStock.id}
            `
          }
          await tx.products.update({
            where: { id: cutFromProductId },
            data: {
              currentStock: { decrement: piecesNeeded },
              currentBaseStock: { decrement: piecesNeeded },
            },
          })

          // Handle one or more remainder pieces. Example: cutting 5 pieces of 6'
          // from 24' stock consumes 2 source pieces and leaves one 18' remnant.
          const remnantLabels: string[] = []
          if (cutPlan.remnants.length > 0 && remainderHandling === 'short-piece') {
            for (const remnant of cutPlan.remnants) {
              try {
                const remnantProduct = await resolvePartialRemnantProduct(tx, cutFromProductId, remnant.length)
                remnantLabels.push(`${remnant.count}x${remnantProduct.code}`)
                await tx.products.update({
                  where: { id: remnantProduct.id },
                  data: {
                    currentStock: { increment: remnant.count },
                    currentBaseStock: { increment: remnant.count },
                  },
                })
                await tx.productShelfStock.upsert({
                  where: { productId_shelfId: { productId: remnantProduct.id, shelfId: cutFromShelfId } },
                  create: {
                    productId: remnantProduct.id,
                    shelfId: cutFromShelfId,
                    quantity: remnant.count,
                    baseQuantity: remnant.count,
                  },
                  update: {
                    quantity: { increment: remnant.count },
                    baseQuantity: { increment: remnant.count },
                  },
                })
              } catch (err) {
                if (err instanceof PartialRemnantError) {
                  throw new ProjectDispatchValidationError(err.message)
                }
                throw err
              }
            }
          }

          // Record the dispatch against the PLANNED product (B), not the source
          await tx.dispatchItems.create({
            data: {
              dispatchId: newDispatch.id,
              productId, // B (the planned product, e.g. INS-3X11-6')
              shelfId: cutFromShelfId,
              quantity, // what the project received (6)
            },
          })

          const remnantCode = remnantLabels.join(',')
          const originalSize = cutPlan.sourceLength
          const remainderLength = cutPlan.remnants.reduce((sum, remnant) => sum + remnant.length * remnant.count, 0)
          const handlingLabel: Record<RemainderHandling, string> = {
            'short-piece': remnantCode ? `→${remnantCode}` : 'sobrante→inventario',
            reserved: 'sobrante→reservado',
            scrap: 'sobrante→scrap',
          }
          crossCutTraces.push(
            `[CROSS-CUT ${sourceCode}→${productId}: dado=${quantity}, piezas=${piecesNeeded}×${originalSize}, sobrante=${remainderLength} (${handlingLabel[remainderHandling]})]`,
          )
          continue
        }

        // ─── Cross-cut from RECEPCIÓN path ──────────────────────────────
        // If cutFromRecepcionItemId is set, consume from a recepción item of a
        // LONGER source product. The remainder is stored as a new recepción
        // item (auto-creating the shorter product if needed).
        const cutFromRecepcionItemId = item.cutFromRecepcionItemId ? String(item.cutFromRecepcionItemId) : null
        if (cutFromRecepcionItemId) {
          const remainderHandling = normalizeRemainderHandling(item.remainderHandling)
          const recepItem = await tx.recepcionItem.findUnique({
            where: { id: cutFromRecepcionItemId },
            include: { product: true },
          })
          if (!recepItem) {
            throw new ProjectDispatchValidationError(`Item de recepción no encontrado`)
          }
          const sourceProduct = recepItem.product
          const targetProduct = await tx.products.findUnique({ where: { id: productId } })
          if (!targetProduct) {
            throw new ProjectDispatchValidationError(`Producto planificado no encontrado`)
          }
          if (!isCuttableSourceForTarget(targetProduct, sourceProduct)) {
            throw new ProjectDispatchValidationError(
              `El producto ${sourceProduct.code} de recepción no es compatible para cortar ${targetProduct.code}`,
            )
          }

          const cutPlan = computeCutPlan(quantity, targetProduct, sourceProduct)
          if (!cutPlan) {
            throw new ProjectDispatchValidationError(
              `No se pudo detectar el tamaño original del producto de recepción ${sourceProduct.code}`,
            )
          }
          const piecesNeeded = cutPlan.sourcePiecesNeeded

          // Validate piece count available in this recepción item
          const recepQty = Number(recepItem.quantity)
          if (recepQty < piecesNeeded) {
            throw new ProjectDispatchValidationError(
              `El item de recepción tiene ${recepQty} piezas, se necesitan ${piecesNeeded} para cortar`,
            )
          }

          // Decrement recepción item by the consumed pieces (delete if zero)
          const recepNewQty = recepQty - piecesNeeded
          if (recepNewQty <= 0) {
            await tx.recepcionItem.delete({ where: { id: recepItem.id } })
          } else {
            await tx.recepcionItem.update({
              where: { id: recepItem.id },
              data: { quantity: recepNewQty },
            })
          }

          // Decrement source product's currentStock (recepción items count toward currentStock)
          await tx.products.update({
            where: { id: sourceProduct.id },
            data: {
              currentStock: { decrement: piecesNeeded },
              currentBaseStock: { decrement: piecesNeeded },
            },
          })

          // Handle the remainder pieces
          const recepRemnantLabels: string[] = []
          if (cutPlan.remnants.length > 0 && remainderHandling === 'short-piece') {
            for (const remnant of cutPlan.remnants) {
              try {
                const remnantProduct = await resolvePartialRemnantProduct(tx, sourceProduct.id, remnant.length)
                recepRemnantLabels.push(`${remnant.count}x${remnantProduct.code}`)
                // Increment remnant product's currentStock (it will live in recepción)
                await tx.products.update({
                  where: { id: remnantProduct.id },
                  data: {
                    currentStock: { increment: remnant.count },
                    currentBaseStock: { increment: remnant.count },
                  },
                })
                // Create a new recepción item with the remnant product, inheriting the same purchase/return
                await tx.recepcionItem.create({
                  data: {
                    productId: remnantProduct.id,
                    quantity: remnant.count,
                    purchaseId: recepItem.purchaseId,
                    returnId: recepItem.returnId,
                    notes: `Sobrante de corte ${sourceProduct.code} → ${targetProduct.code}`,
                  },
                })
              } catch (err) {
                if (err instanceof PartialRemnantError) {
                  throw new ProjectDispatchValidationError(err.message)
                }
                throw err
              }
            }
          }

          // Record the dispatch against the PLANNED product (B), with no shelf
          // (the piece came from recepción, never went to a shelf)
          await tx.dispatchItems.create({
            data: {
              dispatchId: newDispatch.id,
              productId, // B (planned product)
              shelfId: null,
              quantity,
            },
          })

          const recepRemnantCode = recepRemnantLabels.join(',')
          const recepOriginalSize = cutPlan.sourceLength
          const recepRemainderLength = cutPlan.remnants.reduce(
            (sum, remnant) => sum + remnant.length * remnant.count,
            0,
          )
          const recepHandlingLabel: Record<RemainderHandling, string> = {
            'short-piece': recepRemnantCode ? `→${recepRemnantCode} (recepción)` : 'sobrante→recepción',
            reserved: 'sobrante→reservado',
            scrap: 'sobrante→scrap',
          }
          crossCutTraces.push(
            `[CROSS-CUT-RECEP ${sourceProduct.code}→${targetProduct.code}: dado=${quantity}, piezas=${piecesNeeded}×${recepOriginalSize}, sobrante=${recepRemainderLength} (${recepHandlingLabel[remainderHandling]})]`,
          )
          continue
        }

        // ─── Regular dispatch path (no cut) ─────────────────────────────
        const productInfo = await tx.products.findUnique({
          where: { id: productId },
          select: { unitOfMeasure: true, unitQuantity: true },
        })
        const factor = getConversionFactor(productInfo ?? {})
        const baseDelta = explicitBaseQty != null ? explicitBaseQty : packagesToBase(quantity, factor)

        const [stock] = await tx.$queryRaw<StockRow[]>`
          SELECT id, quantity, reserve_quantity, is_reserve_shelf, base_quantity
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
        const totalBaseQty = Number((stock as unknown as { base_quantity?: number }).base_quantity || 0)

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
        const newBaseQty = Math.max(totalBaseQty - baseDelta, 0)
        if (newQty === 0) {
          await tx.$executeRaw`DELETE FROM product_shelf_stock WHERE id = ${stock.id}`
        } else {
          const newReserve = allowReserve
            ? Math.max(reserveQty - Math.max(quantity - availableQty, 0), 0)
            : reserveQty
          await tx.$executeRaw`
            UPDATE product_shelf_stock
            SET quantity = ${newQty}, reserve_quantity = ${newReserve}, base_quantity = ${newBaseQty}
            WHERE id = ${stock.id}
          `
        }

        await tx.products.update({
          where: { id: productId },
          data: {
            currentStock: { decrement: quantity },
            currentBaseStock: { decrement: baseDelta },
          },
        })

        await tx.dispatchItems.create({
          data: {
            dispatchId: newDispatch.id,
            productId,
            shelfId,
            quantity,
            baseQuantity: baseDelta,
          },
        })
      }

      // Append cross-cut trace to dispatch notes for auditability
      if (crossCutTraces.length > 0) {
        const baseNotes = (notes || '').trim()
        const combined = baseNotes ? `${baseNotes}\n${crossCutTraces.join(' ')}` : crossCutTraces.join(' ')
        await tx.dispatches.update({
          where: { id: newDispatch.id },
          data: { notes: combined },
        })
      }

      // Project progress: dispatchedQuantity increments by `quantity` for the PLANNED product (B)
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
