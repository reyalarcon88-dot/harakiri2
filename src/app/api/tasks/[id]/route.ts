import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const taskProjectSelect = {
  id: true,
  name: true,
  poNumber: true,
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function todayDateKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = await db.tasks.findUnique({
      where: { id },
      include: {
        project: { select: taskProjectSelect },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error al obtener tarea:', error)
    return NextResponse.json({ error: 'Error al obtener tarea' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, dueDate, alarmDate, projectId, status, completedAt } = body

    const currentTask = await db.tasks.findUnique({
      where: { id },
      select: { status: true, completedAt: true },
    })

    if (!currentTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    const nextStatus = status !== undefined ? status : currentTask.status
    const completionData =
      status === undefined && completedAt === undefined
        ? {}
        : {
            completedAt:
              nextStatus === 'completed'
                ? nullableString(completedAt) || currentTask.completedAt || todayDateKey()
                : null,
          }

    const task = await db.tasks.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: nullableString(dueDate) }),
        ...(alarmDate !== undefined && { alarmDate: nullableString(alarmDate) }),
        ...(projectId !== undefined && { projectId: nullableString(projectId) }),
        ...(status !== undefined && { status }),
        ...completionData,
      },
      include: {
        project: { select: taskProjectSelect },
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error al actualizar tarea:', error)
    return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.tasks.delete({ where: { id } })
    return NextResponse.json({ message: 'Tarea eliminada correctamente' })
  } catch (error) {
    console.error('Error al eliminar tarea:', error)
    return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 })
  }
}
