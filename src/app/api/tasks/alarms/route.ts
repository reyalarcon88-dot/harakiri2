import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tasks/alarms
// Returns non-completed tasks whose alarmDate is today or earlier.
// alarmDate is stored as YYYY-MM-DD string — lexicographic compare works.
export async function GET() {
  try {
    const today = new Date()
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    const todayKey = local.toISOString().slice(0, 10)

    const tasks = await db.tasks.findMany({
      where: {
        status: { not: 'completed' },
        alarmDate: { lte: todayKey },
      },
      include: {
        project: { select: { id: true, name: true, poNumber: true } },
      },
      orderBy: [{ alarmDate: 'asc' }, { dueDate: 'asc' }],
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('[tasks/alarms]', error)
    return NextResponse.json({ error: 'Error fetching alarms' }, { status: 500 })
  }
}
