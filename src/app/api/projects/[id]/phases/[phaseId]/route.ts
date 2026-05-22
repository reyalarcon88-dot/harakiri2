import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeDateRange, normalizePhaseStatus, todayDateKey } from '@/lib/project-phases'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id, phaseId } = await params
    const body = await request.json()
    const current = await db.projectPhases.findFirst({
      where: { id: phaseId, projectId: id },
    })
    if (!current) return NextResponse.json({ error: 'Fase no encontrada' }, { status: 404 })

    const startInput = body.startDate !== undefined ? body.startDate : current.startDate
    const endInput = body.endDate !== undefined ? body.endDate : current.endDate
    const { startDate, endDate } = normalizeDateRange(startInput, endInput)
    const nextStatus = body.status !== undefined ? normalizePhaseStatus(body.status) : current.status

    const phase = await db.projectPhases.update({
      where: { id: phaseId },
      data: {
        ...(body.phaseTypeId !== undefined && { phaseTypeId: String(body.phaseTypeId) }),
        ...(body.startDate !== undefined || body.endDate !== undefined ? { startDate, endDate } : {}),
        ...(body.status !== undefined && { status: nextStatus }),
        ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) || 0 }),
        ...(body.status !== undefined && {
          completedAt:
            nextStatus === 'completed'
              ? current.completedAt || todayDateKey()
              : null,
        }),
        ...(body.notes !== undefined && { notes: String(body.notes) }),
      },
      include: { phaseType: true },
    })

    return NextResponse.json(phase)
  } catch (error) {
    console.error('Error al actualizar fase:', error)
    return NextResponse.json({ error: 'Error al actualizar fase' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id, phaseId } = await params
    const current = await db.projectPhases.findFirst({ where: { id: phaseId, projectId: id } })
    if (!current) return NextResponse.json({ error: 'Fase no encontrada' }, { status: 404 })

    await db.projectPhases.delete({ where: { id: phaseId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error al eliminar fase:', error)
    return NextResponse.json({ error: 'Error al eliminar fase' }, { status: 500 })
  }
}
