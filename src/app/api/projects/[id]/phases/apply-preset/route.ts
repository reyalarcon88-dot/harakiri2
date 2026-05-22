import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PROJECT_PHASE_PRESETS, normalizeDateRange } from '@/lib/project-phases'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const preset = PROJECT_PHASE_PRESETS.find((item) => item.key === body.presetKey)
    if (!preset) return NextResponse.json({ error: 'Preset no encontrado' }, { status: 404 })

    const project = await db.projects.findUnique({
      where: { id },
      select: { startDate: true, endDate: true, projectDate: true },
    })
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const phaseTypes = await db.projectPhaseTypes.findMany({
      where: { name: { in: [...preset.phaseNames] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    const byName = new Map(phaseTypes.map((type) => [type.name, type]))
    const { startDate, endDate } = normalizeDateRange(
      body.startDate || project.startDate || project.projectDate,
      body.endDate || project.endDate || project.startDate || project.projectDate
    )

    await db.$transaction(async (tx) => {
      await tx.projectPhases.deleteMany({ where: { projectId: id } })
      for (const [index, phaseName] of preset.phaseNames.entries()) {
        const phaseType = byName.get(phaseName)
        if (!phaseType) continue
        await tx.projectPhases.create({
          data: {
            projectId: id,
            phaseTypeId: phaseType.id,
            startDate,
            endDate,
            status: 'pending',
            sortOrder: index,
          },
        })
      }
    })

    const phases = await db.projectPhases.findMany({
      where: { projectId: id },
      include: { phaseType: true },
      orderBy: [{ startDate: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(phases)
  } catch (error) {
    console.error('Error al aplicar preset de fases:', error)
    return NextResponse.json({ error: 'Error al aplicar preset de fases' }, { status: 500 })
  }
}
