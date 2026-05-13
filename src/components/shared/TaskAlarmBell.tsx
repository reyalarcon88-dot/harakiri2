'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/components/layout/I18nProvider'
import { useNavigationStore } from '@/stores/navigation'
import { formatLocaleDate } from '@/lib/i18n/format'

interface AlarmTask {
  id: string
  title: string
  alarmDate: string | null
  dueDate: string | null
  status: string
  project?: { id: string; name: string; poNumber?: string | null } | null
}

function tomorrowDateKey() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function formatProjectLabel(project: { name: string; poNumber?: string | null }) {
  return project.poNumber ? `PO ${project.poNumber} · ${project.name}` : project.name
}

export function TaskAlarmBell() {
  const { locale, t } = useI18n()
  const qc = useQueryClient()
  const setPage = useNavigationStore((s) => s.setPage)

  const { data: alarms = [] } = useQuery<AlarmTask[]>({
    queryKey: ['task-alarms'],
    queryFn: async () => {
      const response = await fetch('/api/tasks/alarms')
      if (!response.ok) return []

      const data = await response.json()
      return Array.isArray(data) ? data : []
    },
    refetchInterval: 2 * 60 * 1000, // re-check every 2 minutes
    staleTime: 60_000,
  })

  const count = alarms.length

  const patchTask = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(async (r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-alarms'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['calendar-tasks'] })
    },
    onError: () => toast.error(t('tasks.alarm.actionError')),
  })

  function snooze(task: AlarmTask) {
    patchTask.mutate(
      { id: task.id, patch: { alarmDate: tomorrowDateKey() } },
      { onSuccess: () => toast.success(t('tasks.alarm.snoozeSuccess')) }
    )
  }

  function dismiss(task: AlarmTask) {
    patchTask.mutate(
      { id: task.id, patch: { alarmDate: null } },
      { onSuccess: () => toast.success(t('tasks.alarm.dismissSuccess')) }
    )
  }

  function complete(task: AlarmTask) {
    patchTask.mutate(
      { id: task.id, patch: { status: 'completed', alarmDate: null } },
      { onSuccess: () => toast.success(t('tasks.alarm.completeSuccess')) }
    )
  }

  const isActing = patchTask.isPending

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={t('tasks.alarm.bell')}
        >
          {count > 0 ? (
            <BellRing className="h-5 w-5 text-amber-500" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold leading-none text-white tabular-nums">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={6}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BellRing className={`h-4 w-4 ${count > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <span className="text-sm font-semibold">{t('tasks.alarm.bell')}</span>
          </div>
          {count > 0 && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 text-xs tabular-nums"
            >
              {t('tasks.alarm.count', { count: String(count) })}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Body */}
        {count === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Check className="h-8 w-8 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-700">{t('tasks.alarm.none')}</p>
            <p className="text-xs text-muted-foreground">{t('tasks.alarm.noneDesc')}</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto divide-y">
            {alarms.map((task) => (
              <div key={task.id} className="px-4 py-3 space-y-2">
                {/* Task title */}
                <p className="text-sm font-medium leading-snug">{task.title}</p>

                {/* Meta row */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {task.project && (
                    <span className="flex items-center gap-1">
                      <FolderKanban className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[140px]">{formatProjectLabel(task.project)}</span>
                    </span>
                  )}
                  {task.alarmDate && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Bell className="h-3 w-3 shrink-0" />
                      {formatLocaleDate(locale, task.alarmDate, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {t('tasks.alarm.due')}{' '}
                      {formatLocaleDate(locale, task.dueDate, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={isActing}
                    onClick={() => complete(task)}
                  >
                    {isActing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    )}
                    {t('tasks.alarm.complete')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={isActing}
                    onClick={() => snooze(task)}
                  >
                    <Clock className="h-3 w-3 text-sky-500" />
                    {t('tasks.alarm.snooze')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    disabled={isActing}
                    onClick={() => dismiss(task)}
                    title={t('tasks.alarm.dismiss')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Footer */}
        <div className="px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs text-muted-foreground"
            onClick={() => setPage('tasks')}
          >
            {t('tasks.alarm.viewAll')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
