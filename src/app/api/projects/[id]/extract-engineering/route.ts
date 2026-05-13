import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'fs/promises'
import path from 'path'
import type { StructureInput } from '@/lib/bom-engine/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 503 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { documentId } = body as { documentId?: string }

    const project = await db.projects.findUnique({
      where: { id },
      select: { color: true },
    })
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    if (!documentId) {
      return NextResponse.json({ error: 'Se requiere documentId' }, { status: 400 })
    }

    const doc = await db.projectDocuments.findUnique({ where: { id: documentId } })
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    // Build absolute path — fileUrl is stored as "/uploads/projects/filename.pdf"
    const relativePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl
    const filePath = path.join(process.cwd(), 'public', relativePath)

    let fileBuffer: Buffer
    try {
      fileBuffer = await readFile(filePath)
    } catch {
      return NextResponse.json({ error: `Archivo no encontrado en disco: ${filePath}` }, { status: 404 })
    }

    const pdfBase64 = fileBuffer.toString('base64')

    const prompt = `Analiza este plano de ingeniería de una estructura de screen enclosure / pool cage en Florida.

Extrae la siguiente información y responde SOLO con un objeto JSON válido (sin markdown, sin texto extra):

{
  "widthFt": <número — ancho total de la estructura en pies>,
  "depthFt": <número — profundidad total en pies>,
  "wallHeightFt": <número — altura de las paredes en pies>,
  "roofType": <"hip" | "gable" | "flat">,
  "bayCount": <número — cantidad de bahías en el lado más largo>,
  "roofPitchFt": <número — altura del pico del techo en pies, o null si no aplica>,
  "confidence": <"high" | "medium" | "low">,
  "notes": <string — observaciones relevantes del plano>
}

Si un valor no puede determinarse con certeza, usa null para ese campo.
Archivo: ${doc.fileName}`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create(
      {
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              } as Anthropic.DocumentBlockParam,
              { type: 'text', text: prompt },
            ],
          },
        ],
      },
      { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } }
    )

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No se obtuvo respuesta de texto de la IA' }, { status: 500 })
    }

    const rawText = textContent.text.trim()
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'La IA no devolvió JSON válido', rawText }, { status: 500 })
    }

    const extracted = JSON.parse(jsonMatch[0]) as Partial<StructureInput> & {
      confidence?: string
      notes?: string
    }

    return NextResponse.json({
      extracted: {
        widthFt: extracted.widthFt ?? null,
        depthFt: extracted.depthFt ?? null,
        wallHeightFt: extracted.wallHeightFt ?? null,
        roofType: extracted.roofType ?? null,
        bayCount: extracted.bayCount ?? null,
        roofPitchFt: extracted.roofPitchFt ?? null,
        color: project.color,
      },
      confidence: extracted.confidence ?? 'low',
      notes: extracted.notes ?? '',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('POST /api/projects/[id]/extract-engineering error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
