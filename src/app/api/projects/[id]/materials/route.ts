import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isProductCompatibleWithProjectColor } from '@/lib/project-color'
import { autoPlanProjectIfNoMaterials, autoScheduleProject, runProjectAutomation } from '@/lib/project-automation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const materials = await db.projectMaterials.findMany({
      where: { projectId: id },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    })
    // Backfill engineeringSection from product when the stored field is empty
    const normalized = materials.map((m) => ({
      ...m,
      engineeringSection: m.engineeringSection || m.product.engineeringSection || '',
    }))
    return NextResponse.json(normalized)
  } catch (error) {
    console.error('Error al listar materiales:', error)
    return NextResponse.json({ error: 'Error al listar materiales' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { productId, plannedQuantity, engineeringSection, sortOrder } = body

    const quantity = Number(plannedQuantity)

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'El producto y la cantidad planificada son obligatorios' },
        { status: 400 }
      )
    }

    const [project, product] = await Promise.all([
      db.projects.findUnique({
        where: { id },
        select: { id: true, color: true },
      }),
      db.products.findUnique({
        where: { id: productId },
        select: { id: true, name: true, color: true, engineeringSection: true },
      }),
    ])

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    if (!isProductCompatibleWithProjectColor(project.color, product.color)) {
      return NextResponse.json(
        { error: `El producto ${product.name} no coincide con el color del proyecto` },
        { status: 400 }
      )
    }

    // Check if product already exists in project
    const existing = await db.projectMaterials.findFirst({
      where: { projectId: id, productId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Este producto ya esta en los materiales del proyecto' },
        { status: 409 }
      )
    }

    const material = await db.projectMaterials.create({
      data: {
        projectId: id,
        productId,
        plannedQuantity: quantity,
        engineeringSection: engineeringSection || product.engineeringSection || '',
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      include: { product: true },
    })

    autoScheduleProject(id)
      .then((scheduled) => {
        if (!scheduled) return runProjectAutomation(id)
      })
      .catch(console.error)

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Error al agregar material:', error)
    return NextResponse.json({ error: 'Error al agregar material' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await db.projects.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const dispatchedMaterials = await db.projectMaterials.findMany({
      where: {
        projectId: id,
        dispatchedQuantity: { gt: 0 },
      },
      select: {
        id: true,
        dispatchedQuantity: true,
        product: { select: { name: true, code: true } },
      },
      take: 5,
    })

    if (dispatchedMaterials.length > 0) {
      const examples = dispatchedMaterials
        .map((material) => `${material.product.code} ${material.product.name}`)
        .join(', ')
      return NextResponse.json(
        {
          error: `No se puede eliminar la lista completa porque ya hay materiales despachados: ${examples}`,
        },
        { status: 400 }
      )
    }

    const result = await db.projectMaterials.deleteMany({
      where: { projectId: id },
    })

    autoPlanProjectIfNoMaterials(id)
      .then((planned) => {
        if (!planned) return runProjectAutomation(id)
      })
      .catch(console.error)

    return NextResponse.json({
      message: 'Lista de materiales eliminada correctamente',
      deleted: result.count,
    })
  } catch (error) {
    console.error('Error al eliminar lista de materiales:', error)
    return NextResponse.json({ error: 'Error al eliminar lista de materiales' }, { status: 500 })
  }
}
