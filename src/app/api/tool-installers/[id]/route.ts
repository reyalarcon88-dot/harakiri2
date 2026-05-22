import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, phone, email, company, role, notes, active } = body

    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const installer = await db.toolInstallers.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(phone !== undefined && { phone: String(phone || '').trim() }),
        ...(email !== undefined && { email: String(email || '').trim() }),
        ...(company !== undefined && { company: String(company || '').trim() }),
        ...(role !== undefined && { role: String(role || 'installer').trim() }),
        ...(notes !== undefined && { notes: String(notes || '').trim() }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    })

    return NextResponse.json(installer)
  } catch (error) {
    console.error('PUT /api/tool-installers/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update installer' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const installer = await db.toolInstallers.findUnique({
      where: { id },
      include: { _count: { select: { currentTools: true } } },
    })

    if (!installer) {
      return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 })
    }

    if (installer._count.currentTools > 0) {
      return NextResponse.json(
        { error: 'No se puede borrar personal con herramientas asignadas. Devuelve o transfiere esas herramientas primero.' },
        { status: 400 }
      )
    }

    await db.toolInstallers.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/tool-installers/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete installer' }, { status: 500 })
  }
}
