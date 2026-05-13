import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const templates = await db.materialTemplates.findMany({
      include: {
        items: {
          include: { product: { select: { id: true, name: true, code: true } } },
          orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error('GET /api/templates error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, projectType, description, sourceFileName, items } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const template = await db.materialTemplates.create({
      data: {
        name,
        projectType: projectType || '',
        description: description || '',
        sourceFileName: sourceFileName || '',
        items: {
          create: items.map((item: { productId: string; plannedQuantity: number; section?: string; sortOrder?: number }) => ({
            productId: item.productId,
            plannedQuantity: item.plannedQuantity,
            section: item.section || '',
            sortOrder: item.sortOrder ?? 0,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, code: true } } } },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('POST /api/templates error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
