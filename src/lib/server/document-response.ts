import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

interface StoredDocumentResponseInput {
  fileName: string
  fileType: string
  fileUrl: string
}

function contentTypeFor(fileName: string, fileType: string) {
  if (fileType && fileType.includes('/')) return fileType

  const ext = fileName.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
  }

  return ext ? types[ext] || 'application/octet-stream' : 'application/octet-stream'
}

function dispositionFor(fileName: string, download: boolean) {
  const encodedName = encodeURIComponent(fileName)
  const mode = download ? 'attachment' : 'inline'
  return `${mode}; filename*=UTF-8''${encodedName}`
}

export async function createStoredDocumentResponse(
  request: NextRequest,
  document: StoredDocumentResponseInput
) {
  if (/^https?:\/\//i.test(document.fileUrl)) {
    return NextResponse.redirect(document.fileUrl)
  }

  const publicDir = path.resolve(process.cwd(), 'public')
  const filePath = path.resolve(publicDir, document.fileUrl.replace(/^\/+/, ''))

  if (!filePath.startsWith(publicDir)) {
    return NextResponse.json({ error: 'Ruta de documento invalida' }, { status: 400 })
  }

  const file = await readFile(filePath)
  const download = request.nextUrl.searchParams.get('download') === '1'

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': contentTypeFor(document.fileName, document.fileType),
      'Content-Disposition': dispositionFor(document.fileName, download),
      'Content-Length': String(file.byteLength),
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
