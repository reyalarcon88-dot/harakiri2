import { NextRequest, NextResponse } from 'next/server'
import { autoArchiveInvoice } from '@/lib/project-invoice'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await autoArchiveInvoice(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al archivar factura:', error)
    return NextResponse.json({ error: 'Error al archivar factura' }, { status: 500 })
  }
}
