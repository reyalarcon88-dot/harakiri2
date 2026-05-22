import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { decorateKit, toolKitInclude } from '../helpers'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const kit = await db.toolKits.findUnique({ where: { id }, include: toolKitInclude })

    if (!kit) return NextResponse.json({ error: 'Kit no encontrado' }, { status: 404 })

    return NextResponse.json(decorateKit(kit))
  } catch (error) {
    console.error('GET /api/tool-kits/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch tool kit' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, name, notes, status } = body

    if (code !== undefined && !String(code).trim()) {
      return NextResponse.json({ error: 'El codigo es obligatorio' }, { status: 400 })
    }
    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const kit = await db.toolKits.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: String(code).trim() }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(notes !== undefined && { notes: String(notes || '').trim() }),
        ...(status !== undefined && { status: String(status || 'active') }),
      },
      include: toolKitInclude,
    })

    return NextResponse.json(decorateKit(kit))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update tool kit'
    console.error('PUT /api/tool-kits/[id] error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.toolKits.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete tool kit'
    console.error('DELETE /api/tool-kits/[id] error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
