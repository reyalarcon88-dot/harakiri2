import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createStoredDocumentResponse } from '@/lib/server/document-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const document = await db.purchaseDocuments.findFirst({
      where: { id: docId, purchaseId: id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    return createStoredDocumentResponse(request, document)
  } catch (error) {
    console.error('Error al abrir documento de compra:', error)
    return NextResponse.json({ error: 'Error al abrir documento' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await params
    await db.purchaseDocuments.delete({ where: { id: docId } })
    return NextResponse.json({ message: 'Documento eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar documento:', error)
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 })
  }
}
