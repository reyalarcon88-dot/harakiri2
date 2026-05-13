import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoPlanProjectIfNoMaterials, runProjectAutomation } from '@/lib/project-automation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id, materialId } = await params
    const { productId, plannedQuantity, engineeringSection, sortOrder } = await request.json()

    if (
      productId === undefined &&
      plannedQuantity === undefined &&
      engineeringSection === undefined &&
      sortOrder === undefined
    ) {
      return NextResponse.json({ error: 'No hay cambios para actualizar' }, { status: 400 })
    }

    const current = await db.projectMaterials.findUnique({ where: { id: materialId } })
    if (!current) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
    }

    let qty: number | undefined
    if (plannedQuantity !== undefined && plannedQuantity !== null) {
      qty = Number(plannedQuantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: 'Cantidad invalida' }, { status: 400 })
      }
      if (qty < current.dispatchedQuantity) {
        return NextResponse.json(
          { error: `No puede ser menor que lo ya despachado (${current.dispatchedQuantity})` },
          { status: 400 }
        )
      }
    }

    if (productId !== undefined && productId !== current.productId) {
      if (current.dispatchedQuantity > 0) {
        return NextResponse.json(
          { error: `No se puede cambiar un material con ${current.dispatchedQuantity} despachado(s)` },
          { status: 400 }
        )
      }

      const product = await db.products.findUnique({
        where: { id: productId },
        select: { id: true },
      })
      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
      }

      const existing = await db.projectMaterials.findFirst({
        where: {
          projectId: id,
          productId,
          id: { not: materialId },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'Este producto ya esta en los materiales del proyecto' },
          { status: 409 }
        )
      }
    }

    const updated = await db.projectMaterials.update({
      where: { id: materialId },
      data: {
        ...(productId !== undefined ? { productId } : {}),
        ...(qty !== undefined ? { plannedQuantity: qty } : {}),
        ...(engineeringSection !== undefined ? { engineeringSection } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      include: { product: true },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error al actualizar material:', error)
    return NextResponse.json({ error: 'Error al actualizar material' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id, materialId } = await params
    const current = await db.projectMaterials.findUnique({ where: { id: materialId } })
    if (!current) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
    }
    if (current.dispatchedQuantity > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar un material con ${current.dispatchedQuantity} despachado(s)` },
        { status: 400 }
      )
    }
    await db.projectMaterials.delete({ where: { id: materialId } })
    autoPlanProjectIfNoMaterials(id)
      .then((planned) => {
        if (!planned) return runProjectAutomation(id)
      })
      .catch(console.error)
    return NextResponse.json({ message: 'Material eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar material:', error)
    return NextResponse.json({ error: 'Error al eliminar material' }, { status: 500 })
  }
}
