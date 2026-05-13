import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const contractors = await db.contractors.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { contactName: { contains: search } },
              { email: { contains: search } },
              { specialty: { contains: search } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        specialty: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(contractors)
  } catch (error) {
    console.error('GET /api/contractors error:', error)
    return NextResponse.json({ error: 'Failed to fetch contractors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contactName, email, phone, specialty } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const contractor = await db.contractors.create({
      data: {
        name: name.trim(),
        contactName: contactName?.trim() || '',
        email: email?.trim() || '',
        phone: phone?.trim() || '',
        specialty: specialty?.trim() || '',
      },
    })
    return NextResponse.json(contractor, { status: 201 })
  } catch (error) {
    console.error('POST /api/contractors error:', error)
    return NextResponse.json({ error: 'Failed to create contractor' }, { status: 500 })
  }
}
