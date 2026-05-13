import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const contractor = await db.contractors.findUnique({
      where: { id },
      include: {
        projects: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!contractor) {
      return NextResponse.json({ error: 'Contratista no encontrado' }, { status: 404 })
    }

    return NextResponse.json(contractor)
  } catch (error) {
    console.error('Error al obtener contratista:', error)
    return NextResponse.json({ error: 'Error al obtener contratista' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, contactName, email, phone, specialty } = body

    const contractor = await db.contractors.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(contactName !== undefined && { contactName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(specialty !== undefined && { specialty }),
      },
    })

    return NextResponse.json(contractor)
  } catch (error) {
    console.error('Error al actualizar contratista:', error)
    return NextResponse.json({ error: 'Error al actualizar contratista' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.contractors.delete({ where: { id } })
    return NextResponse.json({ message: 'Contratista eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar contratista:', error)
    return NextResponse.json({ error: 'Error al eliminar contratista' }, { status: 500 })
  }
}
