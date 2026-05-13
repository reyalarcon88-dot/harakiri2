import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runProjectAutomation } from '@/lib/project-automation'

// DELETE does not remove the physical file, only the DB record,
// so multiple records can safely reference the same fileUrl.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const { category } = await request.json()

    const source = await db.projectDocuments.findFirst({
      where: { id: docId, projectId: id },
    })

    if (!source) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const duplicate = await db.projectDocuments.create({
      data: {
        projectId: id,
        fileName: source.fileName,
        fileUrl: source.fileUrl,
        fileSize: source.fileSize,
        fileType: source.fileType,
        category: category || source.category,
      },
    })

    runProjectAutomation(id).catch(console.error)

    return NextResponse.json(duplicate, { status: 201 })
  } catch (error) {
    console.error('Error al copiar documento:', error)
    return NextResponse.json({ error: 'Error al copiar documento' }, { status: 500 })
  }
}
