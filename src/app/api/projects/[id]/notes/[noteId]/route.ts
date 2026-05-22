import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id, noteId } = await params

    const note = await db.projectNotes.findFirst({
      where: { id: noteId, projectId: id },
      include: { documents: true },
    })

    if (!note) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    }

    // Best-effort delete of physical files; ignore failures (file might already be gone)
    for (const doc of note.documents) {
      if (!doc.fileUrl.startsWith('/uploads/')) continue
      try {
        const filePath = path.join(process.cwd(), 'public', doc.fileUrl.replace(/^\//, ''))
        await unlink(filePath)
      } catch {
        // ignore
      }
    }

    await db.projectNotes.delete({ where: { id: noteId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id]/notes/[noteId] error:', error)
    return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 })
  }
}
