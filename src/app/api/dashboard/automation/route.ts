import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runProjectAutomation } from '@/lib/project-automation'

// GET — dashboard data for the automation layer.
// missingMaterials and readyToDispatch are computed from raw data so they
// work immediately on existing projects without any backfill.
// needingOrders and urgentTasks are task-based — call POST /backfill once
// to generate auto-tasks for all existing projects.
export async function GET() {
  try {
    const [taskBased, activeProjects] = await Promise.all([

      // Task-based queries (require runProjectAutomation to have run at least once)
      Promise.all([
        db.projects.findMany({
          where: {
            status: 'scheduled',
            tasks: { some: { automationKey: 'order_materials', status: 'pending' } },
          },
          select: { id: true, name: true, poNumber: true, startDate: true },
          orderBy: { startDate: 'asc' },
        }),
        db.projects.findMany({
          where: {
            status: { notIn: ['finished'] },
            tasks: { some: { status: 'pending', priority: 1 } },
          },
          select: {
            id: true,
            name: true,
            poNumber: true,
            status: true,
            tasks: {
              where: { status: 'pending', priority: 1 },
              orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
              take: 1,
              select: { id: true, title: true, dueDate: true, automationKey: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]),

      // Raw-data query — works on all projects immediately
      db.projects.findMany({
        where: { status: { notIn: ['finished'] } },
        select: {
          id: true,
          name: true,
          poNumber: true,
          status: true,
          startDate: true,
          materials: { select: { plannedQuantity: true, dispatchedQuantity: true } },
        },
      }),
    ])

    const [needingOrders, urgentTasks] = taskBased

    // missingMaterials: active projects where dispatched < planned (raw data)
    const missingMaterials = activeProjects
      .filter((p) => {
        const planned = p.materials.reduce((s, m) => s + m.plannedQuantity, 0)
        const dispatched = p.materials.reduce((s, m) => s + m.dispatchedQuantity, 0)
        return planned > 0 && dispatched < planned
      })
      .map(({ materials: _m, ...rest }) => rest)

    // readyToDispatch: scheduled projects where ≥80% already dispatched (raw data)
    const readyToDispatch = activeProjects
      .filter((p) => {
        if (p.status !== 'scheduled') return false
        const planned = p.materials.reduce((s, m) => s + m.plannedQuantity, 0)
        const dispatched = p.materials.reduce((s, m) => s + m.dispatchedQuantity, 0)
        return planned > 0 && dispatched / planned >= 0.8
      })
      .map(({ materials: _m, ...rest }) => rest)

    return NextResponse.json({
      needingOrders,
      missingMaterials,
      readyToDispatch,
      urgentTasks,
    })
  } catch (error) {
    console.error('Error fetching automation dashboard data:', error)
    return NextResponse.json({ error: 'Error fetching dashboard data' }, { status: 500 })
  }
}

// POST — one-time backfill.
// Runs runProjectAutomation on every active project so existing projects get
// their automation tasks. Safe to call multiple times — duplicates are blocked
// by automationKey. Call once from the browser or curl:
//   fetch('/api/dashboard/automation', { method: 'POST' })
export async function POST() {
  try {
    const projects = await db.projects.findMany({
      where: { status: { notIn: ['finished'] } },
      select: { id: true },
    })

    const results = await Promise.allSettled(
      projects.map((p) => runProjectAutomation(p.id))
    )

    const failed = results.filter((r) => r.status === 'rejected').length

    return NextResponse.json({
      processed: projects.length,
      failed,
      message: `Processed ${projects.length} projects, ${failed} errors`,
    })
  } catch (error) {
    console.error('Error running automation backfill:', error)
    return NextResponse.json({ error: 'Error running backfill' }, { status: 500 })
  }
}
