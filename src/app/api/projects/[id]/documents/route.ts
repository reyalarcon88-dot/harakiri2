import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { runProjectAutomation } from '@/lib/project-automation'

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
  'pdf',
  'xls', 'xlsx',
  'doc', 'docx',
  'txt', 'csv',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const documents = await db.projectDocuments.findMany({
      where: { projectId: id },
      orderBy: { uploadedAt: 'desc' },
    })
    return NextResponse.json(documents)
  } catch (error) {
    console.error('Error al listar documentos:', error)
    return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json(
          { error: 'No se proporciono ningun archivo' },
          { status: 400 }
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'El archivo excede el tamano maximo de 10MB' },
          { status: 400 }
        )
      }

      const originalName = file.name
      const ext = originalName.split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Tipo de archivo no permitido (.${ext}). Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(', ')}` },
          { status: 400 }
        )
      }

      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).slice(2, 10)
      const uniqueFilename = `${timestamp}-${randomSuffix}.${ext}`
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'projects')
      await mkdir(uploadDir, { recursive: true })

      const filePath = path.join(uploadDir, uniqueFilename)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      const category = (formData.get('category') as string) || 'other'

      const document = await db.projectDocuments.create({
        data: {
          projectId: id,
          fileName: originalName,
          fileUrl: `/uploads/projects/${uniqueFilename}`,
          fileSize: file.size,
          fileType: file.type || ext,
          category,
        },
      })

      runProjectAutomation(id).catch(console.error)
      return NextResponse.json(document, { status: 201 })
    }

    const body = await request.json()
    const { fileName, fileUrl, fileSize, fileType, category } = body

    if (!fileName || !fileUrl) {
      return NextResponse.json(
        { error: 'El nombre y la URL del archivo son obligatorios' },
        { status: 400 }
      )
    }

    const document = await db.projectDocuments.create({
      data: {
        projectId: id,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        fileType: fileType || '',
        category: category || 'other',
      },
    })

    runProjectAutomation(id).catch(console.error)
    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error al crear documento:', error)
    return NextResponse.json({ error: 'Error al crear documento' }, { status: 500 })
  }
}
