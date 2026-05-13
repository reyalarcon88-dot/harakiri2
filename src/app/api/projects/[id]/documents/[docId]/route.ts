import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createStoredDocumentResponse } from '@/lib/server/document-response'
import { runProjectAutomation } from '@/lib/project-automation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const document = await db.projectDocuments.findFirst({
      where: { id: docId, projectId: id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    return createStoredDocumentResponse(request, document)
  } catch (error) {
    console.error('Error al abrir documento:', error)
    return NextResponse.json({ error: 'Error al abrir documento' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const body = await request.json()
    const { category, fileName } = body

    if (!category && !fileName) {
      return NextResponse.json({ error: 'Se requiere al menos un campo para actualizar' }, { status: 400 })
    }

    const document = await db.projectDocuments.update({
      where: { id: docId, projectId: id },
      data: {
        ...(category && { category }),
        ...(fileName && { fileName }),
      },
    })

    runProjectAutomation(id).catch(console.error)

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error al mover documento:', error)
    return NextResponse.json({ error: 'Error al mover documento' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await params
    const document = await db.projectDocuments.delete({ where: { id: docId } })
    runProjectAutomation(document.projectId).catch(console.error)
    return NextResponse.json({ message: 'Documento eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar documento:', error)
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 })
  }
}
