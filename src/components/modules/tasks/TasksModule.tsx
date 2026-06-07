'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Columns3, ListTodo, Plus, Search, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/components/layout/I18nProvider'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatLocaleDate } from '@/lib/i18n/format'
import {
  bucketEmoji,
  bucketLabel,
  bucketTask,
  getBucketStyle,
  type TaskBucket,
} from '@/lib/task-bucketing'
import { useNavigationStore } from '@/stores/navigation'
import { TaskKpiStrip, type KpiKey } from './TaskKpiStrip'
import { TaskRow, type TaskLike } from './TaskRow'
import { TasksByProjectView } from './TasksByProjectView'

interface TaskProject {
  id: string
  name: string
  poNumber?: string | null
}

interface PersonOption {
  type: 'contractor' | 'installer'
  id: string
  name: string
}

interface TaskFormData {
  title: string
  description: string
  dueDate: string
  alarmDate: string
  completedAt: string
  projectId: string
  status: string
  assigneeKey: string
}

const emptyForm: TaskFormData = {
  title: '',
  description: '',
  dueDate: '',
  alarmDate: '',
  completedAt: '',
  projectId: '',
  status: 'pending',
  assigneeKey: '',
}

const NO_PROJECT_VALUE = '__none__'
const NO_ASSIGNEE_VALUE = '__none__'
const VIEW_STORAGE_KEY = 'tasks-view-mode'

type ViewMode = 'urgency' | 'project'

function makeAssigneeKey(type: 'contractor' | 'installer' | null | undefined, id: string | null | undefined) {
  if (!type || !id) return ''
  return `${type}:${id}`
}

function parseAssigneeKey(key: string) {
  if (!key) return { assigneeType: null as 'contractor' | 'installer' | null, assigneeId: null as string | null }
  const [type, id] = key.split(':')
  if ((type === 'contractor' || type === 'installer') && id) return { assigneeType: type, assigneeId: id }
  return { assigneeType: null, assigneeId: null }
}

function todayDateKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function tomorrowDateKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000 + 24 * 60 * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

function formatProjectLabel(project: TaskProject) {
  const poNumber = project.poNumber?.trim()
  return poNumber ? `PO ${poNumber} - ${project.name}` : project.name
}

const BUCKET_ORDER: TaskBucket[] = ['overdue', 'today', 'this_week', 'later', 'completed']

const KPI_TO_BUCKET: Record<Exclude<KpiKey, 'auto_pending' | 'done7d'>, TaskBucket> = {
  overdue: 'overdue',
  today: 'today',
  this_week: 'this_week',
}

export function TasksModule() {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const openProjectStore = useNavigationStore((s) => s.openProject)

  const [viewMode, setViewMode] = useState<ViewMode>('urgency')
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showAutoOnly, setShowAutoOnly] = useState(false)
  const [showManualOnly, setShowManualOnly] = useState(false)
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<TaskBucket, boolean>>({
    overdue: true,
    today: true,
    this_week: true,
    later: false,
    completed: false,
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<TaskFormData>(emptyForm)
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_STORAGE_KEY) : null
    if (stored === 'urgency' || stored === 'project') setViewMode(stored)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim().toLowerCase()), 200)
    return () => clearTimeout(id)
  }, [searchQuery])

  const { data: tasks = [], isLoading } = useQuery<TaskLike[]>({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/tasks').then((r) => r.json()),
  })

  const { data: projects = [] } = useQuery<TaskProject[]>({
    queryKey: ['tasks-projects'],
    queryFn: () => fetch('/api/projects').then((r) => r.json()),
  })

  const { data: personnel = [] } = useQuery<PersonOption[]>({
    queryKey: ['personnel'],
    queryFn: () => fetch('/api/personnel').then((r) => r.json()),
  })

  const personnelByKey = useMemo(() => {
    const map = new Map<string, PersonOption>()
    for (const person of personnel) map.set(`${person.type}:${person.id}`, person)
    return map
  }, [personnel])

  function buildTaskPayload(data: TaskFormData) {
    const { assigneeKey, ...rest } = data
    const { assigneeType, assigneeId } = parseAssigneeKey(assigneeKey)
    return { ...rest, assigneeType, assigneeId }
  }

  const createMutation = useMutation({
    mutationFn: (data: TaskFormData) =>
      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTaskPayload(data)),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] })
      toast.success(t('tasks.toast.created'))
      closeDialog()
    },
    onError: () => toast.error(t('tasks.toast.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskFormData }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTaskPayload(data)),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] })
      toast.success(t('tasks.toast.updated'))
      closeDialog()
    },
    onError: () => toast.error(t('tasks.toast.updateError')),
  })

  const toggleCompleteMutation = useMutation({
    mutationFn: async (task: TaskLike) => {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
      const r = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!r.ok) throw new Error('toggle')
      return { task, nextStatus }
    },
    onMutate: async (task) => {
      setTogglingTaskId(task.id)
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const prev = queryClient.getQueryData<TaskLike[]>(['tasks']) ?? []
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
      queryClient.setQueryData<TaskLike[]>(['tasks'], (old = []) =>
        old.map((t) =>
          t.id === task.id
            ? { ...t, status: nextStatus, completedAt: nextStatus === 'completed' ? todayDateKey() : null }
            : t,
        ),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['tasks'], ctx.prev)
      toast.error(t('tasks.toast.updateError'))
    },
    onSettled: (result) => {
      setTogglingTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] })
      if (result) {
        toast.success(result.nextStatus === 'completed' ? t('tasks.toast.completed') : t('tasks.toast.reopened'))
      }
    },
  })

  const snoozeMutation = useMutation({
    mutationFn: async (task: TaskLike) => {
      const nextAlarm = tomorrowDateKey()
      const r = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmDate: nextAlarm }),
      })
      if (!r.ok) throw new Error('snooze')
      return r.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      toast.success('Pospuesta a mañana')
    },
    onError: () => toast.error(t('tasks.toast.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] })
      toast.success(t('tasks.toast.deleted'))
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: () => toast.error(t('tasks.toast.deleteError')),
  })

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(task: TaskLike) {
    setEditingId(task.id)
    setForm({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate || '',
      alarmDate: task.alarmDate || '',
      completedAt: task.completedAt || '',
      projectId: task.projectId || '',
      status: task.status,
      assigneeKey: makeAssigneeKey(task.assigneeType, task.assigneeId),
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) return
    const payload = {
      ...form,
      completedAt: form.status === 'completed' ? form.completedAt || todayDateKey() : '',
    }
    if (editingId) updateMutation.mutate({ id: editingId, data: payload })
    else createMutation.mutate(payload)
  }

  function openProject(projectId: string) {
    openProjectStore(projectId)
  }

  // Apply filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (showManualOnly && task.autoGenerated) return false
      if (showAutoOnly && !task.autoGenerated) return false
      if (projectFilter !== 'all') {
        if (projectFilter === '__none__' && task.projectId) return false
        if (projectFilter !== '__none__' && task.projectId !== projectFilter) return false
      }
      if (debouncedSearch) {
        const hay = `${task.title} ${task.description ?? ''} ${task.project?.name ?? ''} ${task.project?.poNumber ?? ''}`.toLowerCase()
        if (!hay.includes(debouncedSearch)) return false
      }
      if (activeKpi) {
        const b = bucketTask(task)
        if (activeKpi === 'auto_pending') {
          if (!task.autoGenerated || task.status === 'completed') return false
        } else if (activeKpi === 'done7d') {
          if (b !== 'completed') return false
          const completedAt = task.completedAt
          if (!completedAt) return false
          const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(completedAt)
          if (!m) return false
          const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
          const today = new Date()
          const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
          const diff = Math.round((t0.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
          if (diff < 0 || diff > 7) return false
        } else {
          const targetBucket = KPI_TO_BUCKET[activeKpi]
          if (b !== targetBucket) return false
        }
      }
      return true
    })
  }, [tasks, showManualOnly, showAutoOnly, projectFilter, debouncedSearch, activeKpi])

  const grouped = useMemo(() => {
    const groups: Record<TaskBucket, TaskLike[]> = {
      overdue: [],
      today: [],
      this_week: [],
      later: [],
      completed: [],
    }
    for (const task of filteredTasks) groups[bucketTask(task)].push(task)

    // Sort within each bucket: priority asc, then due date asc, then alarm date asc
    const sortFn = (a: TaskLike, b: TaskLike) => {
      const pa = a.priority ?? 2
      const pb = b.priority ?? 2
      if (pa !== pb) return pa - pb
      const da = a.dueDate || a.alarmDate || '￿'
      const db = b.dueDate || b.alarmDate || '￿'
      return da.localeCompare(db)
    }
    for (const key of BUCKET_ORDER) groups[key].sort(sortFn)
    return groups
  }, [filteredTasks])

  const recentCompleted = grouped.completed.filter((t) => {
    if (!t.completedAt) return false
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t.completedAt)
    if (!m) return false
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const today = new Date()
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const diff = Math.round((t0.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
    return diff >= 0 && diff <= 7
  })

  const isMutating = createMutation.isPending || updateMutation.isPending
  const hasActiveFilter = activeKpi !== null || showAutoOnly || showManualOnly || projectFilter !== 'all' || debouncedSearch.length > 0

  function clearAllFilters() {
    setActiveKpi(null)
    setShowAutoOnly(false)
    setShowManualOnly(false)
    setProjectFilter('all')
    setSearchQuery('')
  }

  function toggleSection(bucket: TaskBucket) {
    setOpenSections((prev) => ({ ...prev, [bucket]: !prev[bucket] }))
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-muted-foreground">
          {tasks.length > 0 && (
            <>
              <span className="font-semibold tabular-nums text-foreground">{tasks.filter((t) => t.status !== 'completed').length}</span> pendientes
              {' · '}
              <span className="font-semibold tabular-nums text-foreground">{recentCompleted.length}</span> hechas esta semana
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-card p-0.5">
            <Button
              variant={viewMode === 'urgency' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-[11.5px]"
              onClick={() => setViewMode('urgency')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Por urgencia
            </Button>
            <Button
              variant={viewMode === 'project' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-[11.5px]"
              onClick={() => setViewMode('project')}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Por proyecto
            </Button>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t('tasks.actions.new')}
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <TaskKpiStrip tasks={tasks} activeKey={activeKpi} onSelect={setActiveKpi} />

      {/* Search + chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tarea o proyecto…"
            className="h-8 pl-8 text-[12.5px]"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setShowManualOnly((v) => !v)
            if (!showManualOnly) setShowAutoOnly(false)
          }}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${
            showManualOnly ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Solo manuales
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAutoOnly((v) => !v)
            if (!showAutoOnly) setShowManualOnly(false)
          }}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${
            showAutoOnly ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Solo auto
        </button>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-8 w-[200px] text-[12.5px]">
            <SelectValue placeholder={t('tasks.filters.project')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tasks.filters.allProjects')}</SelectItem>
            <SelectItem value="__none__">Sin proyecto</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{formatProjectLabel(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeKpi && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-700">
            Filtro: {activeKpi === 'overdue' ? 'Vencidas' : activeKpi === 'today' ? 'Hoy y mañana' : activeKpi === 'this_week' ? 'Esta semana' : activeKpi === 'done7d' ? 'Hechas (7d)' : 'Auto pendientes'}
            <button type="button" onClick={() => setActiveKpi(null)} className="ml-0.5 opacity-70 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {t('tasks.loading')}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={t('tasks.emptyTitle')}
          description={t('tasks.emptyDescription')}
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('tasks.actions.add')}
            </Button>
          }
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={t('tasks.emptyTitle')}
          description={t('tasks.emptyFiltered')}
          action={
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
          }
        />
      ) : viewMode === 'project' ? (
        <TasksByProjectView
          tasks={filteredTasks}
          personnelByKey={personnelByKey}
          expandedTaskId={expandedTaskId}
          togglingTaskId={togglingTaskId}
          onExpandTask={setExpandedTaskId}
          onToggleComplete={(task) => toggleCompleteMutation.mutate(task)}
          onSnooze={(task) => snoozeMutation.mutate(task)}
          onEdit={(task) => openEdit(task)}
          onDelete={(task) => { setDeletingId(task.id); setDeleteOpen(true) }}
          onOpenProject={openProject}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {BUCKET_ORDER.map((bucket) => {
            const sectionTasks = bucket === 'completed' ? recentCompleted : grouped[bucket]
            if (sectionTasks.length === 0) return null
            const style = getBucketStyle(bucket)
            const open = openSections[bucket]
            return (
              <div key={bucket} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSection(bucket)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left ${style.sectionTint}`}
                >
                  <span>{bucketEmoji(bucket)}</span>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${style.sectionLabel}`}>
                    {bucket === 'completed' ? 'Completadas (últimos 7 días)' : bucketLabel(bucket)}
                  </span>
                  <span className="rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 tabular-nums">
                    {sectionTasks.length}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {open && (
                  <div className="space-y-1 bg-white px-3 py-2">
                    {sectionTasks.map((task) => {
                      const assigneeKey = task.assigneeType && task.assigneeId ? `${task.assigneeType}:${task.assigneeId}` : null
                      const assignee = assigneeKey ? personnelByKey.get(assigneeKey) : undefined
                      return (
                        <TaskRow
                          key={task.id}
                          task={task}
                          expanded={expandedTaskId === task.id}
                          toggling={togglingTaskId === task.id}
                          assigneeName={assignee?.name}
                          onClickRow={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          onToggleComplete={() => toggleCompleteMutation.mutate(task)}
                          onSnooze={() => snoozeMutation.mutate(task)}
                          onEdit={() => openEdit(task)}
                          onDelete={() => { setDeletingId(task.id); setDeleteOpen(true) }}
                          onOpenProject={task.projectId ? () => openProject(task.projectId!) : undefined}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? t('tasks.dialog.editTitle') : t('tasks.dialog.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('tasks.fields.title')}</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('tasks.fields.description')}</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="projectId">{t('tasks.fields.project')}</Label>
                <Select
                  value={form.projectId || NO_PROJECT_VALUE}
                  onValueChange={(value) =>
                    setForm({ ...form, projectId: value === NO_PROJECT_VALUE ? '' : value })
                  }
                >
                  <SelectTrigger id="projectId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT_VALUE}>{t('tasks.fields.noProject')}</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {formatProjectLabel(project)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignee">Asignar a</Label>
                <Select
                  value={form.assigneeKey || NO_ASSIGNEE_VALUE}
                  onValueChange={(value) =>
                    setForm({ ...form, assigneeKey: value === NO_ASSIGNEE_VALUE ? '' : value })
                  }
                >
                  <SelectTrigger id="assignee">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASSIGNEE_VALUE}>Sin asignar</SelectItem>
                    {personnel.filter((p) => p.type === 'contractor').length > 0 && (
                      <>
                        <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Contratistas
                        </div>
                        {personnel
                          .filter((p) => p.type === 'contractor')
                          .map((person) => (
                            <SelectItem key={`contractor:${person.id}`} value={`contractor:${person.id}`}>
                              {person.name}
                            </SelectItem>
                          ))}
                      </>
                    )}
                    {personnel.filter((p) => p.type === 'installer').length > 0 && (
                      <>
                        <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Instaladores
                        </div>
                        {personnel
                          .filter((p) => p.type === 'installer')
                          .map((person) => (
                            <SelectItem key={`installer:${person.id}`} value={`installer:${person.id}`}>
                              {person.name}
                            </SelectItem>
                          ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dueDate">{t('tasks.fields.dueDate')}</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alarmDate">{t('tasks.fields.alarmDate')}</Label>
                <Input
                  id="alarmDate"
                  type="date"
                  value={form.alarmDate}
                  onChange={(event) => setForm({ ...form, alarmDate: event.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">{t('tasks.fields.status')}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      status: value,
                      completedAt: value === 'completed' ? form.completedAt || todayDateKey() : '',
                    })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t('dashboard.status.pending')}</SelectItem>
                    <SelectItem value="in_progress">{t('dashboard.status.inProgress')}</SelectItem>
                    <SelectItem value="completed">{t('dashboard.status.completed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('tasks.fields.completedAt')}</Label>
                <div className="flex min-h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  {form.completedAt
                    ? formatLocaleDate(locale, form.completedAt, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : t('calendar.noDate')}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? t('tasks.actions.saving') : editingId ? t('tasks.actions.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        title={t('tasks.delete.title')}
        description={t('tasks.delete.description')}
      />
    </div>
  )
}
