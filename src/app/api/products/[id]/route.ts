import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, name, family, engineeringSection, unitOfMeasure, unitQuantity, minStock, currentStock, referencePrice, preferredShelfId } = body

    const existing = await db.products.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (code && code !== existing.code) {
      const codeExists = await db.products.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json({ error: 'Product code already exists' }, { status: 409 })
      }
    }

    const product = await db.products.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(family !== undefined && { family }),
        ...(engineeringSection !== undefined && { engineeringSection }),
        ...(unitOfMeasure !== undefined && { unitOfMeasure }),
        ...(unitQuantity !== undefined && { unitQuantity: String(unitQuantity) }),
        ...(minStock !== undefined && { minStock }),
        ...(currentStock !== undefined && { currentStock }),
        ...(referencePrice !== undefined && { referencePrice }),
        ...('preferredShelfId' in body && { preferredShelfId: preferredShelfId ?? null }),
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Product update error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const existing = await db.products.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Count blocking references (tables with Restrict delete behavior)
    const [purchases, projects, dispatches, returns, supplierReturns, transfers, templates, recepcion] = await Promise.all([
      db.purchaseItems.count({ where: { productId: id } }),
      db.projectMaterials.count({ where: { productId: id } }),
      db.dispatchItems.count({ where: { productId: id } }),
      db.returnItems.count({
        where: {
          OR: [
            { productIdDelivered: id },
            { productIdReturned: id },
          ],
        },
      }),
      db.supplierReturns.count({ where: { productId: id } }),
      db.transfers.count({ where: { productId: id } }),
      db.materialTemplateItems.count({ where: { productId: id } }),
      db.recepcionItem.count({ where: { productId: id } }),
    ])

    const blockers: { label: string; count: number }[] = []
    if (purchases) blockers.push({ label: 'compras', count: purchases })
    if (projects) blockers.push({ label: 'proyectos', count: projects })
    if (dispatches) blockers.push({ label: 'despachos', count: dispatches })
    if (returns) blockers.push({ label: 'devoluciones', count: returns })
    if (supplierReturns) blockers.push({ label: 'devoluciones a suplidor', count: supplierReturns })
    if (transfers) blockers.push({ label: 'transferencias', count: transfers })
    if (templates) blockers.push({ label: 'plantillas', count: templates })
    if (recepcion) blockers.push({ label: 'recepción', count: recepcion })

    if (blockers.length > 0 && !force) {
      const summary = blockers.map((b) => `${b.count} ${b.label}`).join(', ')
      return NextResponse.json(
        {
          error: `No se puede eliminar "${existing.name}" porque está siendo usado en: ${summary}. Usa force=true para eliminar junto con su historial.`,
          blockers,
          canForce: true,
        },
        { status: 409 },
      )
    }

    if (force && blockers.length > 0) {
      await db.$transaction([
        db.recepcionItem.deleteMany({ where: { productId: id } }),
        db.materialTemplateItems.deleteMany({ where: { productId: id } }),
        db.transfers.deleteMany({ where: { productId: id } }),
        db.supplierReturns.deleteMany({ where: { productId: id } }),
        db.returnItems.deleteMany({
          where: {
            OR: [
              { productIdDelivered: id },
              { productIdReturned: id },
            ],
          },
        }),
        db.dispatchItems.deleteMany({ where: { productId: id } }),
        db.projectMaterials.deleteMany({ where: { productId: id } }),
        db.purchaseItems.deleteMany({ where: { productId: id } }),
        db.products.delete({ where: { id } }),
      ])
    } else {
      await db.products.delete({ where: { id } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Product delete error:', error)
    return NextResponse.json({ error: 'Error al eliminar producto' }, { status: 500 })
  }
}
