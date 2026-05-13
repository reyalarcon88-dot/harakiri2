import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const template = await db.materialTemplates.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error al obtener template:', error)
    return NextResponse.json({ error: 'Error al obtener template' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, projectType, description, sourceFileName, items } = body

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.materialTemplates.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(projectType !== undefined && { projectType }),
          ...(description !== undefined && { description }),
          ...(sourceFileName !== undefined && { sourceFileName }),
        },
      })

      // Replace items if provided
      if (items && Array.isArray(items)) {
        await tx.materialTemplateItems.deleteMany({ where: { templateId: id } })
        if (items.length > 0) {
          await tx.materialTemplateItems.createMany({
            data: items.map((item: { productId: string; plannedQuantity: number; section?: string; sortOrder?: number }) => ({
              templateId: id,
              productId: item.productId,
              plannedQuantity: item.plannedQuantity,
              section: item.section || '',
              sortOrder: item.sortOrder ?? 0,
            })),
          })
        }
      }

      return tx.materialTemplates.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
            orderBy: [
              { sortOrder: 'asc' },
              { createdAt: 'asc' },
            ],
          },
        },
      })
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error al actualizar template:', error)
    return NextResponse.json({ error: 'Error al actualizar template' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.materialTemplates.delete({ where: { id } })
    return NextResponse.json({ message: 'Template eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar template:', error)
    return NextResponse.json({ error: 'Error al eliminar template' }, { status: 500 })
  }
}
