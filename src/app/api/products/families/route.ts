import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const families = await db.products.findMany({
      where: { family: { not: '' } },
      select: { family: true },
      distinct: ['family'],
      orderBy: { family: 'asc' },
    })
    return NextResponse.json(families.map((f) => f.family))
  } catch (error) {
    console.error('Error al obtener familias:', error)
    return NextResponse.json({ error: 'Error al obtener familias' }, { status: 500 })
  }
}
