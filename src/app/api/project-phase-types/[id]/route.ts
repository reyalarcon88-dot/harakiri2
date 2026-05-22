import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: { name?: string; color?: string; sortOrder?: number; active?: boolean } = {}

    if (body.name !== undefined) {
      const name = String(body.name || '').trim()
      if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
      data.name = name
    }
    if (body.color !== undefined) data.color = String(body.color || 'teal')
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    if (body.active !== undefined) data.active = Boolean(body.active)

    const phaseType = await db.projectPhaseTypes.update({ where: { id }, data })
    return NextResponse.json(phaseType)
  } catch (error) {
    console.error('Error al actualizar tipo de fase:', error)
    return NextResponse.json({ error: 'Error al actualizar tipo de fase' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const usedCount = await db.projectPhases.count({ where: { phaseTypeId: id } })
    if (usedCount > 0) {
      const phaseType = await db.projectPhaseTypes.update({
        where: { id },
        data: { active: false },
      })
      return NextResponse.json({ ...phaseType, deactivated: true })
    }

    await db.projectPhaseTypes.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error al eliminar tipo de fase:', error)
    return NextResponse.json({ error: 'Error al eliminar tipo de fase' }, { status: 500 })
  }
}
