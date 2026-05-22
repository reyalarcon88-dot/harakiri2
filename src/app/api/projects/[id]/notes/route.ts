import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']
const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10MB

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const notes = await db.projectNotes.findMany({
      where: { projectId: id },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(notes)
  } catch (error) {
    console.error('GET /api/projects/[id]/notes error:', error)
    return NextResponse.json({ error: 'Error al listar notas' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') || ''

    let body = ''
    let authorType = 'admin'
    let authorId: string | null = null
    let files: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = String(formData.get('body') || '').trim()
      const at = String(formData.get('authorType') || 'admin')
      if (at === 'contractor' || at === 'installer' || at === 'admin') authorType = at
      const aid = String(formData.get('authorId') || '').trim()
      authorId = aid || null
      files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)
    } else {
      const json = await request.json()
      body = String(json.body || '').trim()
      const at = String(json.authorType || 'admin')
      if (at === 'contractor' || at === 'installer' || at === 'admin') authorType = at
      authorId = json.authorId ? String(json.authorId) : null
    }

    if (!body && files.length === 0) {
      return NextResponse.json({ error: 'La nota debe tener texto o fotos.' }, { status: 400 })
    }

    const note = await db.projectNotes.create({
      data: {
        projectId: id,
        authorType,
        authorId,
        body,
      },
    })

    const savedDocuments: Awaited<ReturnType<typeof db.projectDocuments.create>>[] = []
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'projects')
      await mkdir(uploadDir, { recursive: true })

      for (const file of files) {
        if (file.size === 0) continue
        if (file.size > MAX_PHOTO_SIZE) continue
        const originalName = file.name
        const ext = originalName.split('.').pop()?.toLowerCase() || ''
        if (!ALLOWED_PHOTO_EXTS.includes(ext)) continue

        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).slice(2, 10)
        const uniqueFilename = `note-${timestamp}-${randomSuffix}.${ext}`
        const filePath = path.join(uploadDir, uniqueFilename)
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(filePath, buffer)

        const document = await db.projectDocuments.create({
          data: {
            projectId: id,
            noteId: note.id,
            fileName: originalName,
            fileUrl: `/uploads/projects/${uniqueFilename}`,
            fileSize: file.size,
            fileType: file.type || ext,
            category: 'note-photo',
          },
        })
        savedDocuments.push(document)
      }
    }

    return NextResponse.json({ ...note, documents: savedDocuments }, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/notes error:', error)
    return NextResponse.json({ error: 'Error al crear nota' }, { status: 500 })
  }
}
