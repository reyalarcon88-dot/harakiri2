import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeDateRange, normalizePhaseStatus, todayDateKey } from '@/lib/project-phases'

function includePhaseType() {
  return { phaseType: true }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const phases = await db.projectPhases.findMany({
      where: { projectId: id },
      include: includePhaseType(),
      orderBy: [{ startDate: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(phases)
  } catch (error) {
    console.error('Error al listar fases:', error)
    return NextResponse.json({ error: 'Error al listar fases' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const phaseTypeId = String(body.phaseTypeId || '').trim()
    if (!phaseTypeId) {
      return NextResponse.json({ error: 'El tipo de fase es obligatorio' }, { status: 400 })
    }

    const { startDate, endDate } = normalizeDateRange(body.startDate, body.endDate)
    const status = normalizePhaseStatus(body.status)
    const phase = await db.projectPhases.create({
      data: {
        projectId: id,
        phaseTypeId,
        startDate,
        endDate,
        status,
        completedAt: status === 'completed' ? todayDateKey() : null,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      },
      include: includePhaseType(),
    })

    return NextResponse.json(phase, { status: 201 })
  } catch (error) {
    console.error('Error al crear fase:', error)
    return NextResponse.json({ error: 'Error al crear fase' }, { status: 500 })
  }
}
