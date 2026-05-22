import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_PROJECT_PHASE_TYPES } from '@/lib/project-phases'

async function ensureDefaultPhaseTypes() {
  const count = await db.projectPhaseTypes.count()
  if (count > 0) return

  await db.projectPhaseTypes.createMany({
    data: DEFAULT_PROJECT_PHASE_TYPES.map((type) => ({
      name: type.name,
      color: type.color,
      sortOrder: type.sortOrder,
      active: true,
    })),
  })
}

export async function GET() {
  try {
    await ensureDefaultPhaseTypes()
    const phaseTypes = await db.projectPhaseTypes.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(phaseTypes)
  } catch (error) {
    console.error('Error al listar tipos de fase:', error)
    return NextResponse.json({ error: 'Error al listar tipos de fase' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const phaseType = await db.projectPhaseTypes.create({
      data: {
        name,
        color: String(body.color || 'teal'),
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        active: body.active !== false,
      },
    })

    return NextResponse.json(phaseType, { status: 201 })
  } catch (error) {
    console.error('Error al crear tipo de fase:', error)
    return NextResponse.json({ error: 'Error al crear tipo de fase' }, { status: 500 })
  }
}
