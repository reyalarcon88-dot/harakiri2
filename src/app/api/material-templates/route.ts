import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeItems = searchParams.get('includeItems')

    const templates = await db.materialTemplates.findMany({
      include: includeItems === 'true'
        ? {
            items: {
              include: { product: true },
              orderBy: [
                { sortOrder: 'asc' },
                { createdAt: 'asc' },
              ],
            },
          }
        : {
            _count: { select: { items: true } },
          },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error al listar templates:', error)
    return NextResponse.json({ error: 'Error al listar templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, projectType, description, sourceFileName, items } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const template = await db.materialTemplates.create({
      data: {
        name,
        projectType: projectType || '',
        description: description || '',
        sourceFileName: sourceFileName || '',
        items: items && items.length > 0
          ? {
              create: items.map((item: { productId: string; plannedQuantity: number; section?: string; sortOrder?: number }) => ({
                productId: item.productId,
                plannedQuantity: item.plannedQuantity,
                section: item.section || '',
                sortOrder: item.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      include: {
        items: { include: { product: true } },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error al crear template:', error)
    return NextResponse.json({ error: 'Error al crear template' }, { status: 500 })
  }
}
