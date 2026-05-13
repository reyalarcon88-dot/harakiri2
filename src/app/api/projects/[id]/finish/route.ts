import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoDispatchOnFinish } from '../route'
import { autoArchiveInvoice } from '@/lib/project-invoice'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const current = await db.projects.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const wasAlreadyFinished = current.status === 'finished'

    const project = await db.$transaction(async (tx) => {
      const updated = await tx.projects.update({
        where: { id },
        data: { status: 'finished' },
      })

      if (!wasAlreadyFinished) {
        await autoDispatchOnFinish(tx, id)
      }
      return updated
    })

    if (!wasAlreadyFinished) {
      await autoArchiveInvoice(id)
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error al finalizar proyecto:', error)
    return NextResponse.json({ error: 'Error al finalizar proyecto' }, { status: 500 })
  }
}
