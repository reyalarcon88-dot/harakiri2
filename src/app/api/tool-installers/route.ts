import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const installers = await db.toolInstallers.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
              { company: { contains: search } },
              { role: { contains: search } },
            ],
          }
        : undefined,
      include: {
        _count: { select: { currentTools: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(installers)
  } catch (error) {
    console.error('GET /api/tool-installers error:', error)
    return NextResponse.json({ error: 'Failed to fetch installers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, company, role, notes, active } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const installer = await db.toolInstallers.create({
      data: {
        name: String(name).trim(),
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
        company: String(company || '').trim(),
        role: String(role || 'installer').trim(),
        notes: String(notes || '').trim(),
        active: active !== false,
      },
    })

    return NextResponse.json(installer, { status: 201 })
  } catch (error) {
    console.error('POST /api/tool-installers error:', error)
    return NextResponse.json({ error: 'Failed to create installer' }, { status: 500 })
  }
}
