import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { decorateKit, toolKitInclude } from '../../helpers'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const toolId = String(body.toolId || '')
    const quantity = Math.max(1, Number(body.quantity) || 1)

    if (!toolId) {
      return NextResponse.json({ error: 'Selecciona una herramienta' }, { status: 400 })
    }

    await db.toolKitItems.create({
      data: { kitId: id, toolId, quantity },
    })

    const kit = await db.toolKits.findUnique({ where: { id }, include: toolKitInclude })
    if (!kit) return NextResponse.json({ error: 'Kit no encontrado' }, { status: 404 })

    return NextResponse.json(decorateKit(kit), { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add kit item'
    console.error('POST /api/tool-kits/[id]/items error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
