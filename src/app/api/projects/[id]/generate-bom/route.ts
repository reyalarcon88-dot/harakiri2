import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateBom } from '@/lib/bom-engine'
import type { StructureInput, CatalogProduct } from '@/lib/bom-engine/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const input = body as StructureInput

    if (!input.widthFt || !input.depthFt || !input.wallHeightFt || !input.bayCount || !input.roofType) {
      return NextResponse.json({ error: 'Faltan dimensiones requeridas' }, { status: 400 })
    }

    const project = await db.projects.findUnique({
      where: { id },
      select: { color: true },
    })
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    // Load all products as catalog — filter by engineering section for relevance
    const products = await db.products.findMany({
      where: {
        engineeringSection: { in: ['Structural Frame', 'Fasteners & Hardware', 'Screen'] },
      },
      select: {
        id: true,
        code: true,
        name: true,
        family: true,
        engineeringSection: true,
        color: true,
        unitOfMeasure: true,
      },
    })

    const catalog: CatalogProduct[] = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      family: p.family,
      engineeringSection: p.engineeringSection,
      color: p.color,
      unitOfMeasure: p.unitOfMeasure,
    }))

    const result = generateBom({ ...input, color: project.color }, catalog)

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/projects/[id]/generate-bom error:', error)
    return NextResponse.json({ error: 'Error al generar la lista de materiales' }, { status: 500 })
  }
}
