import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const suppliers = await db.suppliers.findMany({
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
        _count: { select: { purchases: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contactName, email, phone, address } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const supplier = await db.suppliers.create({
      data: {
        name,
        contactName: contactName ?? '',
        email: email ?? '',
        phone: phone ?? '',
        address: address ?? '',
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Error al crear proveedor:', error)
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 })
  }
}
