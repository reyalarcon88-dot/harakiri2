import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const taskProjectSelect = {
  id: true,
  name: true,
  poNumber: true,
  startDate: true,
  status: true,
  materials: {
    select: { plannedQuantity: true, dispatchedQuantity: true },
  },
} as const

function enrichTaskProject<T extends { project: any | null }>(task: T): T {
  if (!task.project || !Array.isArray(task.project.materials)) return task
  const { materials, ...rest } = task.project as { materials: Array<{ plannedQuantity: number; dispatchedQuantity: number }>; [k: string]: unknown }
  const plannedTotal = materials.reduce((a, m) => a + (Number(m.plannedQuantity) || 0), 0)
  const dispatchedTotal = materials.reduce((a, m) => a + (Number(m.dispatchedQuantity) || 0), 0)
  return {
    ...task,
    project: {
      ...rest,
      materialsPlannedTotal: plannedTotal,
      materialsDispatchedTotal: dispatchedTotal,
    },
  } as T
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function todayDateKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function normalizeAssigneeType(value: unknown): 'contractor' | 'installer' | null {
  if (value === 'contractor' || value === 'installer') return value
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const assigneeType = searchParams.get('assigneeType')
    const assigneeId = searchParams.get('assigneeId')

    const tasks = await db.tasks.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
        ...(assigneeType ? { assigneeType } : {}),
        ...(assigneeId ? { assigneeId } : {}),
      },
      include: {
        project: { select: taskProjectSelect },
      },
      orderBy: [
        { status: 'asc' },
        { alarmDate: 'asc' },
        { dueDate: 'asc' },
      ],
    })
    return NextResponse.json(tasks.map(enrichTaskProject))
  } catch (error) {
    console.error('Error al listar tareas:', error)
    return NextResponse.json({ error: 'Error al listar tareas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, dueDate, alarmDate, projectId, status, assigneeType, assigneeId } = body

    if (!title) {
      return NextResponse.json({ error: 'El titulo es obligatorio' }, { status: 400 })
    }

    const normalizedAssigneeType = normalizeAssigneeType(assigneeType)
    const normalizedAssigneeId = normalizedAssigneeType ? nullableString(assigneeId) : null

    const taskStatus = status || 'pending'
    const task = await db.tasks.create({
      data: {
        title,
        description: description || '',
        dueDate: nullableString(dueDate),
        alarmDate: nullableString(alarmDate),
        projectId: nullableString(projectId),
        status: taskStatus,
        completedAt: taskStatus === 'completed' ? todayDateKey() : null,
        assigneeType: normalizedAssigneeType,
        assigneeId: normalizedAssigneeId,
      },
      include: {
        project: { select: taskProjectSelect },
      },
    })

    return NextResponse.json(enrichTaskProject(task), { status: 201 })
  } catch (error) {
    console.error('Error al crear tarea:', error)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}
