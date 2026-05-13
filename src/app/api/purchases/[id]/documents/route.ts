import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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
    const documents = await db.purchaseDocuments.findMany({
      where: { purchaseId: id },
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
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo de 10MB' },
        { status: 400 }
      )
    }

    // Validate file extension
    const originalName = file.name
    const ext = originalName.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido (.${ext}). Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).slice(2, 10)
    const uniqueFilename = `${timestamp}-${randomSuffix}.${ext}`

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'purchases')
    await mkdir(uploadDir, { recursive: true })

    // Save file using Bun.write (fallback to fs)
    const filePath = path.join(uploadDir, uniqueFilename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Use Bun.write if available, otherwise use fs.writeFile
    if (typeof (globalThis as unknown as { Bun?: { write: (path: string, data: Buffer) => Promise<number> } }).Bun !== 'undefined') {
      await (globalThis as unknown as { Bun: { write: (path: string, data: Buffer) => Promise<number> } }).Bun.write(filePath, buffer)
    } else {
      await writeFile(filePath, buffer)
    }

    const fileUrl = `/uploads/purchases/${uniqueFilename}`

    const document = await db.purchaseDocuments.create({
      data: {
        purchaseId: id,
        fileName: originalName,
        fileUrl,
        fileSize: file.size,
        fileType: file.type,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error al crear documento:', error)
    return NextResponse.json({ error: 'Error al crear documento' }, { status: 500 })
  }
}
