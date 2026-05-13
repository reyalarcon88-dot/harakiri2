import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supplier = await db.suppliers.findUnique({
      where: { id },
      include: {
        purchases: {
          include: {
            items: { include: { product: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error al obtener proveedor:', error)
    return NextResponse.json({ error: 'Error al obtener proveedor' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, contactName, email, phone, address } = body

    const supplier = await db.suppliers.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(contactName !== undefined && { contactName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error al actualizar proveedor:', error)
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.suppliers.delete({ where: { id } })
    return NextResponse.json({ message: 'Proveedor eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar proveedor:', error)
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 })
  }
}
