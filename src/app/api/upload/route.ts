import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporciono ningun archivo' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || ''
    const fileName = `${timestamp}-${file.name}`
    const filePath = join(uploadsDir, fileName)

    await writeFile(filePath, buffer)
    const fileUrl = `/uploads/${fileName}`

    return NextResponse.json({
      fileName,
      fileUrl,
      fileSize: file.size,
      fileType: file.type || ext,
    }, { status: 201 })
  } catch (error) {
    console.error('Error al subir archivo:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
