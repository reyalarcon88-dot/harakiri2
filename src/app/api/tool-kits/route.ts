import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { decorateKit, toolKitInclude } from './helpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const kits = await db.toolKits.findMany({
      where: search
        ? {
            OR: [
              { code: { contains: search } },
              { name: { contains: search } },
              { notes: { contains: search } },
            ],
          }
        : undefined,
      include: toolKitInclude,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(kits.map(decorateKit))
  } catch (error) {
    console.error('GET /api/tool-kits error:', error)
    return NextResponse.json({ error: 'Failed to fetch tool kits' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const code = String(body.code || '').trim()
    const name = String(body.name || '').trim()

    if (!code || !name) {
      return NextResponse.json({ error: 'Codigo y nombre son obligatorios' }, { status: 400 })
    }

    const kit = await db.toolKits.create({
      data: {
        code,
        name,
        notes: String(body.notes || '').trim(),
        status: String(body.status || 'active'),
      },
      include: toolKitInclude,
    })

    return NextResponse.json(decorateKit(kit), { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create tool kit'
    console.error('POST /api/tool-kits error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
