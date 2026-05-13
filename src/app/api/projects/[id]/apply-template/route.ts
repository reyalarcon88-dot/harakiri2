import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isProductCompatibleWithProjectColor } from '@/lib/project-color'
import { autoScheduleProject, runProjectAutomation } from '@/lib/project-automation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { templateId } = body

    if (!templateId) {
      return NextResponse.json({ error: 'El templateId es obligatorio' }, { status: 400 })
    }

    const project = await db.projects.findUnique({
      where: { id },
      select: { id: true, color: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Get template items
    const templateItems = await db.materialTemplateItems.findMany({
      where: { templateId },
      include: { product: true },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    if (templateItems.length === 0) {
      return NextResponse.json({ error: 'Template vacio o no encontrado' }, { status: 404 })
    }

    for (const templateItem of templateItems) {
      if (!isProductCompatibleWithProjectColor(project.color, templateItem.product.color)) {
        return NextResponse.json(
          { error: `El producto ${templateItem.product.name} no coincide con el color del proyecto` },
          { status: 400 }
        )
      }
    }

    // Get existing project materials
    const existingMaterials = await db.projectMaterials.findMany({
      where: { projectId: id },
      select: { productId: true },
    })

    const existingProductIds = new Set(existingMaterials.map((m) => m.productId))

    let createdCount = 0
    let skippedCount = 0

    for (const templateItem of templateItems) {
      if (existingProductIds.has(templateItem.productId)) {
        skippedCount++
        continue
      }

      await db.projectMaterials.create({
        data: {
          projectId: id,
          productId: templateItem.productId,
          plannedQuantity: templateItem.plannedQuantity,
          engineeringSection: templateItem.section || '',
          sortOrder: templateItem.sortOrder ?? createdCount,
        },
      })

      createdCount++
    }

    autoScheduleProject(id)
      .then((scheduled) => {
        if (!scheduled) return runProjectAutomation(id)
      })
      .catch(console.error)

    return NextResponse.json({ createdCount, skippedCount })
  } catch (error) {
    console.error('Error al aplicar template:', error)
    return NextResponse.json({ error: 'Error al aplicar template' }, { status: 500 })
  }
}
