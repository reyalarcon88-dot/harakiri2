import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { decorateKit, toolKitInclude } from '../../../helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const body = await request.json()
    const quantity = Math.max(1, Number(body.quantity) || 1)

    await db.toolKitItems.updateMany({
      where: { id: itemId, kitId: id },
      data: { quantity },
    })

    const kit = await db.toolKits.findUnique({ where: { id }, include: toolKitInclude })
    if (!kit) return NextResponse.json({ error: 'Kit no encontrado' }, { status: 404 })
    return NextResponse.json(decorateKit(kit))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update kit item'
    console.error('PATCH /api/tool-kits/[id]/items/[itemId] error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    await db.toolKitItems.deleteMany({ where: { id: itemId, kitId: id } })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove kit item'
    console.error('DELETE /api/tool-kits/[id]/items/[itemId] error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
