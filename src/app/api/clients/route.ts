import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const clients = await db.clients.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { contactName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(clients)
  } catch (error) {
    console.error('GET /api/clients error:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contactName, email, phone, address } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const client = await db.clients.create({
      data: {
        name: name.trim(),
        contactName: contactName?.trim() || '',
        email: email?.trim() || '',
        phone: phone?.trim() || '',
        address: address?.trim() || '',
      },
    })
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('POST /api/clients error:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
