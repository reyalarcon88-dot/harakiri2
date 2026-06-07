'use client'

import { useMemo } from 'react'
import { CheckCircle2, ClipboardList, Clock, FolderKanban, Truck, CalendarClock, XCircle } from 'lucide-react'
import { TaskRow, type TaskLike } from './TaskRow'
import { bucketTask, formatStartsIn } from '@/lib/task-bucketing'

interface PersonOption {
  type: 'contractor' | 'installer'
  id: string
  name: string
}

interface Props {
  tasks: TaskLike[]
  personnelByKey: Map<string, PersonOption>
  expandedTaskId: string | null
  togglingTaskId: string | null
  onExpandTask: (id: string | null) => void
  onToggleComplete: (task: TaskLike) => void
  onSnooze: (task: TaskLike) => void
  onEdit: (task: TaskLike) => void
  onDelete: (task: TaskLike) => void
  onOpenProject?: (projectId: string) => void
}

interface ProjectBucket {
  projectId: string | null
  projectKey: string
  name: string
  poNumber: string | null
  status: string | null
  startDate: string | null
  materialsPlanned: number
  materialsDispatched: number
  tasks: TaskLike[]
  overdueCount: number
}

function statusVisual(status: string | null) {
  switch (status) {
    case 'planned':
      return { label: 'Planeado', icon: ClipboardList, bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' }
    case 'scheduled':
      return { label: 'Programado', icon: CalendarClock, bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100' }
    case 'in_progress':
      return { label: 'En progreso', icon: Clock, bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-100' }
    case 'dispatched':
      return { label: 'Despachado', icon: Truck, bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
    case 'finished':
      return { label: 'Terminado', icon: CheckCircle2, bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
    case 'cancelled':
      return { label: 'Cancelado', icon: XCircle, bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' }
    default:
      return { label: status || '—', icon: FolderKanban, bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
  }
}

function daysBetweenTodayAnd(dateStr: string | null): number | null {
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((d.getTime() - t.getTime()) / (24 * 60 * 60 * 1000))
}

export function TasksByProjectView({
  tasks,
  personnelByKey,
  expandedTaskId,
  togglingTaskId,
  onExpandTask,
  onToggleComplete,
  onSnooze,
  onEdit,
  onDelete,
  onOpenProject,
}: Props) {
  const buckets = useMemo(() => {
    const byKey = new Map<string, ProjectBucket>()
    for (const t of tasks) {
      const key = t.projectId ?? '__no_project__'
      if (!byKey.has(key)) {
        byKey.set(key, {
          projectId: t.projectId,
          projectKey: key,
          name: t.project?.name ?? 'Sin proyecto',
          poNumber: t.project?.poNumber ?? null,
          status: t.project?.status ?? null,
          startDate: t.project?.startDate ?? null,
          materialsPlanned: t.project?.materialsPlannedTotal ?? 0,
          materialsDispatched: t.project?.materialsDispatchedTotal ?? 0,
          tasks: [],
          overdueCount: 0,
        })
      }
      const bucket = byKey.get(key)!
      bucket.tasks.push(t)
      const b = bucketTask(t)
      if (b === 'overdue') bucket.overdueCount++
    }
    // sort tasks inside each project: overdue → today → this_week → later → completed; within bucket by priority asc then due date asc
    const orderRank: Record<string, number> = { overdue: 0, today: 1, this_week: 2, later: 3, completed: 4 }
    for (const bucket of byKey.values()) {
      bucket.tasks.sort((a, b) => {
        const rb = orderRank[bucketTask(a)] - orderRank[bucketTask(b)]
        if (rb !== 0) return rb
        const pa = a.priority ?? 2
        const pb = b.priority ?? 2
        if (pa !== pb) return pa - pb
        const da = a.dueDate || a.alarmDate || '￿'
        const db = b.dueDate || b.alarmDate || '￿'
        return da.localeCompare(db)
      })
    }
    return Array.from(byKey.values()).sort((a, b) => {
      if (a.projectId === null) return 1
      if (b.projectId === null) return -1
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount
      return b.tasks.length - a.tasks.length
    })
  }, [tasks])

  if (buckets.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => {
        const visual = statusVisual(bucket.status)
        const StatusIcon = visual.icon
        const pct = bucket.materialsPlanned > 0
          ? Math.round((bucket.materialsDispatched / bucket.materialsPlanned) * 100)
          : 0
        const fillColor = pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : pct >= 25 ? 'bg-orange-500' : 'bg-rose-500'
        const daysToStart = daysBetweenTodayAnd(bucket.startDate)
        const pendingCount = bucket.tasks.filter((t) => t.status !== 'completed').length

        return (
          <div key={bucket.projectKey} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-slate-900">{bucket.name}</span>
                  {bucket.poNumber && (
                    <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teal-800">
                      PO {bucket.poNumber}
                    </span>
                  )}
                </div>
                {bucket.startDate && (
                  <div className="mt-0.5 text-[11.5px] text-slate-500">
                    {daysToStart !== null ? formatStartsIn(daysToStart) : bucket.startDate}
                  </div>
                )}
              </div>
              {bucket.projectId && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${visual.bg} ${visual.text} ${visual.border}`}>
                  <StatusIcon className="h-3 w-3" />
                  {visual.label}
                </span>
              )}
              {bucket.materialsPlanned > 0 && (
                <div className="w-[140px]">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${fillColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="mt-1 text-right text-[10.5px] text-slate-500 tabular-nums">{pct}% despachado</div>
                </div>
              )}
              <div className="flex items-center gap-3 text-right">
                {bucket.overdueCount > 0 && (
                  <div>
                    <div className="text-[14px] font-bold text-rose-600 tabular-nums leading-none">{bucket.overdueCount}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">vencidas</div>
                  </div>
                )}
                <div>
                  <div className="text-[14px] font-bold text-slate-800 tabular-nums leading-none">{pendingCount}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">pendientes</div>
                </div>
              </div>
            </div>
            <div className="space-y-1 px-3 py-2">
              {bucket.tasks.map((task) => {
                const assigneeKey = task.assigneeType && task.assigneeId ? `${task.assigneeType}:${task.assigneeId}` : null
                const assignee = assigneeKey ? personnelByKey.get(assigneeKey) : undefined
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    expanded={expandedTaskId === task.id}
                    toggling={togglingTaskId === task.id}
                    hideProjectContext
                    assigneeName={assignee?.name}
                    onClickRow={() => onExpandTask(expandedTaskId === task.id ? null : task.id)}
                    onToggleComplete={() => onToggleComplete(task)}
                    onSnooze={() => onSnooze(task)}
                    onEdit={() => onEdit(task)}
                    onDelete={() => onDelete(task)}
                    onOpenProject={onOpenProject && task.projectId ? () => onOpenProject(task.projectId!) : undefined}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
