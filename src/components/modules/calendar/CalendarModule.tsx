'use client'

import { useEffect, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isWithinInterval,
  isValid,
  differenceInCalendarDays,
  type Locale as DateFnsLocale,
} from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Pencil,
  Trash2,
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  StickyNote,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/components/layout/I18nProvider'
import { useNavigationStore } from '@/stores/navigation'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Draggable } from '@/components/shared/Draggable'
import { Droppable } from '@/components/shared/Droppable'
import type { Locale as AppLocale, MessageKey } from '@/lib/i18n/messages'
import { PROJECT_PHASE_COLOR_CLASS } from '@/lib/project-phases'

// ─── Types ───────────────────────────────────────────────────────────────────────

interface Task {
  id: string
  title: string
  description: string
  dueDate: string | null
  alarmDate: string | null
  completedAt: string | null
  projectId: string | null
  status: string
  createdAt: string
  project?: { id: string; name: string; poNumber?: string | null } | null
}

interface Project {
  id: string
  name: string
  poNumber?: string
  projectDate: string
  startDate: string | null
  endDate: string | null
  status: string
  client: { id: string; name: string }
  contractor?: { id: string; name: string } | null
  phases?: ProjectPhase[]
}

interface ProjectPhaseType {
  id: string
  name: string
  color: string
  sortOrder: number
  active: boolean
}

interface ProjectPhase {
  id: string
  projectId: string
  phaseTypeId: string
  startDate: string
  endDate: string
  status: string
  sortOrder: number
  completedAt: string | null
  notes?: string
  phaseType: ProjectPhaseType
  project?: Project
}

interface CalendarEvent {
  type: 'task' | 'project' | 'phase'
  data: Task | Project | ProjectPhase
  dateStr: string
  taskDateType?: 'due' | 'alarm'
}

interface MovingProject {
  projectId: string
  sourceDate: string
}

interface MovingPhase {
  phaseId: string
  projectId: string
  sourceDate: string
}

interface DraggedProject {
  project: Project
  sourceDate: string
}

interface DraggedPhase {
  phase: ProjectPhase
  sourceDate: string
}

interface CalendarEventFilters {
  projects: boolean
  phases: boolean
  taskDue: boolean
  taskAlarm: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<string, { className: string; dotColor: string; bg: string; text: string }> = {
  pending: {
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    dotColor: 'bg-amber-500',
    bg: 'rgba(245,158,11,0.15)',
    text: '#d97706',
  },
  in_progress: {
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    dotColor: 'bg-sky-500',
    bg: 'rgba(14,165,233,0.15)',
    text: '#0284c7',
  },
  completed: {
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
    bg: 'rgba(16,185,129,0.15)',
    text: '#059669',
  },
}

const CALENDAR_EVENT_FILTERS_STORAGE_KEY = 'harakiri.calendar.eventFilters'

const DEFAULT_CALENDAR_EVENT_FILTERS: CalendarEventFilters = {
  projects: true,
  phases: true,
  taskDue: true,
  taskAlarm: true,
}

function getStoredCalendarEventFilters(): CalendarEventFilters {
  if (typeof window === 'undefined') return DEFAULT_CALENDAR_EVENT_FILTERS

  try {
    const raw = window.localStorage.getItem(CALENDAR_EVENT_FILTERS_STORAGE_KEY)
    if (!raw) return DEFAULT_CALENDAR_EVENT_FILTERS

    const parsed = JSON.parse(raw) as Partial<CalendarEventFilters>
    return {
      projects: parsed.projects !== false,
      phases: parsed.phases !== false,
      taskDue: parsed.taskDue !== false,
      taskAlarm: parsed.taskAlarm !== false,
    }
  } catch {
    return DEFAULT_CALENDAR_EVENT_FILTERS
  }
}

const PROJECT_STATUS_CONFIG: Record<string, { className: string; dotColor: string; bg: string; text: string; border: string }> = {
  planned: {
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    dotColor: 'bg-violet-500',
    bg: 'rgba(139,92,246,0.1)',
    text: '#7c3aed',
    border: 'border-l-violet-500',
  },
  scheduled: {
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    dotColor: 'bg-sky-500',
    bg: 'rgba(14,165,233,0.1)',
    text: '#0284c7',
    border: 'border-l-sky-500',
  },
  in_progress: {
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    dotColor: 'bg-blue-500',
    bg: 'rgba(59,130,246,0.1)',
    text: '#2563eb',
    border: 'border-l-blue-500',
  },
  dispatched: {
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    dotColor: 'bg-orange-500',
    bg: 'rgba(249,115,22,0.1)',
    text: '#ea580c',
    border: 'border-l-orange-500',
  },
  finished: {
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
    bg: 'rgba(16,185,129,0.1)',
    text: '#059669',
    border: 'border-l-emerald-500',
  },
  cancelled: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    dotColor: 'bg-red-500',
    bg: 'rgba(239,68,68,0.1)',
    text: '#dc2626',
    border: 'border-l-red-500',
  },
}


// ─── Helpers ─────────────────────────────────────────────────────────────────────

function getCalendarDays(date: Date): Date[] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }
  return days
}

function getDateFnsLocale(locale: AppLocale): DateFnsLocale {
  return locale === 'es' ? es : enUS
}

function getTaskStatusKey(status: string): MessageKey {
  switch (status) {
    case 'in_progress':
      return 'dashboard.status.inProgress'
    case 'completed':
      return 'dashboard.status.completed'
    case 'pending':
    default:
      return 'dashboard.status.pending'
  }
}

function getProjectStatusKey(status: string): MessageKey {
  switch (status) {
    case 'in_progress':
      return 'status.project.inProgress'
    case 'scheduled':
      return 'status.project.scheduled'
    case 'dispatched':
      return 'status.project.dispatched'
    case 'finished':
      return 'status.project.finished'
    case 'cancelled':
      return 'status.project.cancelled'
    case 'planned':
    default:
      return 'status.project.planned'
  }
}

function formatDateSafe(dateStr: string | null, locale: DateFnsLocale, fallback: string): string {
  if (!dateStr) return fallback
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
  if (isNaN(d.getTime())) return fallback
  return format(d, 'PPP', { locale })
}

function formatDateShort(dateStr: string | null, locale: DateFnsLocale): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
  if (isNaN(d.getTime())) return ''
  return format(d, 'd MMM', { locale })
}

function parseDateSafe(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const d = parseISO(dateStr)
  return isValid(d) ? d : null
}

function formatTaskProjectLabel(project: NonNullable<Task['project']>) {
  const poNumber = project.poNumber?.trim()
  return poNumber ? `PO ${poNumber} - ${project.name}` : project.name
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getProjectDateRange(project: Project): { start: Date | null; end: Date | null } {
  const start = parseDateSafe(project.startDate)
  let end = parseDateSafe(project.endDate)

  if (start && !end) {
    end = start
  }

  return { start, end }
}

function getPhaseDateRange(phase: ProjectPhase): { start: Date | null; end: Date | null } {
  const start = parseDateSafe(phase.startDate)
  let end = parseDateSafe(phase.endDate)
  if (start && !end) end = start
  return { start, end }
}

function isProjectOnDate(project: Project, day: Date): boolean {
  const { start, end } = getProjectDateRange(project)
  if (!start || !end) return false
  return isWithinInterval(day, { start, end })
}

function getTaskCfg(status: string, t: (key: MessageKey) => string) {
  const config = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.pending
  return {
    ...config,
    label: t(getTaskStatusKey(status)),
  }
}

function getProjectCfg(status: string, t: (key: MessageKey) => string) {
  const config = PROJECT_STATUS_CONFIG[status] || PROJECT_STATUS_CONFIG.planned
  return {
    ...config,
    label: t(getProjectStatusKey(status)),
  }
}

function getPhaseStatusLabel(status: string) {
  if (status === 'completed') return 'Completada'
  if (status === 'in_progress') return 'En progreso'
  return 'Pendiente'
}

function getPhaseStatusClass(status: string) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (status === 'in_progress') return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
}

// ─── Component ───────────────────────────────────────────────────────────────────

export function CalendarModule() {
  const { locale, t } = useI18n()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editStatus, setEditStatus] = useState(false)
  const [editingStatus, setEditingStatus] = useState('')
  const [editDescription, setEditDescription] = useState(false)
  const [editingDescription, setEditingDescription] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [movingProject, setMovingProject] = useState<MovingProject | null>(null)
  const [movingPhase, setMovingPhase] = useState<MovingPhase | null>(null)
  const [draggedProject, setDraggedProject] = useState<DraggedProject | null>(null)
  const [draggedPhase, setDraggedPhase] = useState<DraggedPhase | null>(null)
  const [eventFilters, setEventFilters] = useState<CalendarEventFilters>(getStoredCalendarEventFilters)
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null)
  const [phasePanelOpen, setPhasePanelOpen] = useState(false)
  const [phaseNoteInput, setPhaseNoteInput] = useState('')

  const queryClient = useQueryClient()
  const openProject = useNavigationStore((state) => state.openProject)
  const dateLocale = getDateFnsLocale(locale)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )
  const weekdays = useMemo(
    () => [
      t('calendar.weekdays.mon'),
      t('calendar.weekdays.tue'),
      t('calendar.weekdays.wed'),
      t('calendar.weekdays.thu'),
      t('calendar.weekdays.fri'),
      t('calendar.weekdays.sat'),
      t('calendar.weekdays.sun'),
    ],
    [t]
  )

  // ─── Data Fetching ───

  const { data: tasks = [], isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ['calendar-tasks'],
    queryFn: () => fetch('/api/tasks').then((r) => r.json()),
  })

  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ['calendar-projects'],
    queryFn: () => fetch('/api/projects').then((r) => r.json()),
  })

  const isLoading = loadingTasks || loadingProjects

  useEffect(() => {
    window.localStorage.setItem(CALENDAR_EVENT_FILTERS_STORAGE_KEY, JSON.stringify(eventFilters))
  }, [eventFilters])

  function setEventFilter(filter: keyof CalendarEventFilters, checked: boolean) {
    setEventFilters((current) => ({ ...current, [filter]: checked }))
  }

  const noEventTypesSelected = !eventFilters.projects && !eventFilters.phases && !eventFilters.taskDue && !eventFilters.taskAlarm

  // ─── Group events by date ───

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()

    function addTaskEvent(task: Task, dateStr: string, taskDateType: 'due' | 'alarm') {
      const list = map.get(dateStr) || []
      list.push({ type: 'task', data: task, dateStr, taskDateType })
      map.set(dateStr, list)
    }

    // Tasks appear on their alarm date and due date. If both dates match, keep one event.
    for (const task of tasks) {
      if (eventFilters.taskAlarm && task.alarmDate) addTaskEvent(task, task.alarmDate, 'alarm')
      if (eventFilters.taskDue && task.dueDate && (!eventFilters.taskAlarm || task.dueDate !== task.alarmDate)) {
        addTaskEvent(task, task.dueDate, 'due')
      }
    }

    // For each project, add an event to every day within its date range
    if (eventFilters.projects) {
      for (const p of projects) {
        if ((p.phases || []).length > 0) continue
        const { start, end } = getProjectDateRange(p)
        if (!start || !end) continue
        let day = start
        while (day <= end) {
          const key = format(day, 'yyyy-MM-dd')
          const list = map.get(key) || []
          list.push({ type: 'project', data: p, dateStr: key })
          map.set(key, list)
          day = addDays(day, 1)
        }
      }
    }

    if (eventFilters.phases) {
      for (const project of projects) {
        for (const phase of project.phases || []) {
          const { start, end } = getPhaseDateRange(phase)
          if (!start || !end) continue
          let day = start
          while (day <= end) {
            const key = format(day, 'yyyy-MM-dd')
            const list = map.get(key) || []
            list.push({ type: 'phase', data: { ...phase, project }, dateStr: key })
            map.set(key, list)
            day = addDays(day, 1)
          }
        }
      }
    }

    return map
  }, [tasks, projects, eventFilters])

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth])

  // ─── Day detail sheet data ───

  const dayKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : ''
  const dayTaskEvents = useMemo(() => {
    if (!dayKey) return []
    return (eventsByDate.get(dayKey) || []).filter((e) => e.type === 'task')
  }, [dayKey, eventsByDate])
  const dayTasks = useMemo(() => dayTaskEvents.map((e) => e.data as Task), [dayTaskEvents])

  const dayProjects = useMemo(() => {
    if (!dayKey) return []
    return (eventsByDate.get(dayKey) || []).filter((e) => e.type === 'project').map((e) => e.data as Project)
  }, [dayKey, eventsByDate])

  const dayPhases = useMemo(() => {
    if (!dayKey) return []
    return (eventsByDate.get(dayKey) || []).filter((e) => e.type === 'phase').map((e) => e.data as ProjectPhase)
  }, [dayKey, eventsByDate])

  const dayTotalEvents = dayTasks.length + dayProjects.length + dayPhases.length

  const dayProjectsWithPhases = useMemo(() => {
    if (!dayKey) return []
    const projectMap = new Map<string, { project: Project; phases: ProjectPhase[] }>()
    for (const proj of dayProjects) {
      if (!projectMap.has(proj.id)) projectMap.set(proj.id, { project: proj, phases: [] })
    }
    for (const phase of dayPhases) {
      if (phase.project) {
        if (!projectMap.has(phase.projectId)) projectMap.set(phase.projectId, { project: phase.project, phases: [] })
        projectMap.get(phase.projectId)!.phases.push(phase)
      }
    }
    return Array.from(projectMap.values())
  }, [dayKey, dayProjects, dayPhases])

  // ─── Month navigation ───

  function prevMonth() { setCurrentMonth(subMonths(currentMonth, 1)) }
  function nextMonth() { setCurrentMonth(addMonths(currentMonth, 1)) }
  function goToday() { setCurrentMonth(new Date()) }

  // ─── Day click handler ───

  function openDaySheet(day: Date) {
    setSelectedDay(day)
    setDaySheetOpen(true)
  }

  function closeDaySheet() {
    setDaySheetOpen(false)
    setTimeout(() => setSelectedDay(null), 200)
  }

  function openPhasePanel(phase: ProjectPhase) {
    setSelectedPhase(phase)
    setPhaseNoteInput(phase.notes || '')
    setPhasePanelOpen(true)
  }

  function closePhasePanel() {
    setPhasePanelOpen(false)
    setTimeout(() => setSelectedPhase(null), 200)
  }

  function openProjectFromCalendar(projectId: string) {
    closeDaySheet()
    openProject(projectId)
  }

  // ─── Task detail sheet ───

  function openDetail(task: Task) {
    setSelectedTask(task)
    setEditStatus(false)
    setEditDescription(false)
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
    setTimeout(() => setSelectedTask(null), 200)
  }

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(t('calendar.toast.statusUpdated'))
      setEditStatus(false)
      closeDetail()
    },
    onError: () => toast.error(t('calendar.toast.statusUpdateError')),
  })

  const updateDescriptionMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(t('calendar.toast.descriptionUpdated'))
      setEditDescription(false)
      closeDetail()
    },
    onError: () => toast.error(t('calendar.toast.descriptionUpdateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/tasks/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(t('calendar.toast.taskDeleted'))
      setDeleteOpen(false)
      closeDetail()
    },
    onError: () => toast.error(t('calendar.toast.taskDeleteError')),
  })

  const updateProjectDatesMutation = useMutation({
    mutationFn: ({
      project,
      startDate,
      endDate,
    }: {
      project: Project
      startDate: string
      endDate: string
    }) =>
      fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDate: startDate,
          startDate,
          endDate,
        }),
      }).then((r) => {
        if (!r.ok) return r.json().then((payload) => { throw new Error(payload?.error || t('projects.toast.updateError')) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      toast.success(t('calendar.toast.projectDatesUpdated'))
    },
    onError: (err: Error) => toast.error(err.message || t('calendar.toast.projectDatesUpdateError')),
  })

  const updatePhaseMutation = useMutation({
    mutationFn: ({ phase, data }: { phase: ProjectPhase; data: Record<string, unknown> }) =>
      fetch(`/api/projects/${phase.projectId}/phases/${phase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((payload) => { throw new Error(payload?.error || 'Could not update phase') })
        return r.json()
      }),
    onSuccess: (updatedPhase) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      toast.success('Fase actualizada')
      setSelectedPhase((prev) =>
        prev && prev.id === updatedPhase.id ? { ...updatedPhase, project: prev.project } : prev
      )
    },
    onError: (err: Error) => toast.error(err.message || 'No se pudo actualizar la fase'),
  })

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('No se pudo actualizar la tarea'),
  })

  function startEditStatus() {
    if (selectedTask) {
      setEditingStatus(selectedTask.status)
      setEditStatus(true)
    }
  }

  function saveStatus() {
    if (selectedTask && editingStatus !== selectedTask.status) {
      updateStatusMutation.mutate({ id: selectedTask.id, status: editingStatus })
    } else {
      setEditStatus(false)
    }
  }

  function startEditDescription() {
    if (selectedTask) {
      setEditingDescription(selectedTask.description || '')
      setEditDescription(true)
    }
  }

  function saveDescription() {
    if (selectedTask) {
      updateDescriptionMutation.mutate({ id: selectedTask.id, description: editingDescription })
    }
  }

  function getProjectRangeDateKeys(project: Project) {
    const { start, end } = getProjectDateRange(project)
    const fallback = parseDateSafe(project.projectDate) ?? new Date()
    const startDate = start ?? fallback
    const endDate = end ?? startDate

    return {
      startDate: toDateKey(startDate),
      endDate: toDateKey(endDate),
    }
  }

  function moveProjectByDays(project: Project, dayDelta: number) {
    const { start, end } = getProjectDateRange(project)
    const fallback = parseDateSafe(project.projectDate) ?? new Date()
    const startDate = start ?? fallback
    const endDate = end ?? startDate

    updateProjectDatesMutation.mutate({
      project,
      startDate: toDateKey(addDays(startDate, dayDelta)),
      endDate: toDateKey(addDays(endDate, dayDelta)),
    })
  }

  function movePhaseByDays(phase: ProjectPhase, dayDelta: number) {
    const { start, end } = getPhaseDateRange(phase)
    if (!start) return
    const endDate = end ?? start
    updatePhaseMutation.mutate({
      phase,
      data: {
        startDate: toDateKey(addDays(start, dayDelta)),
        endDate: toDateKey(addDays(endDate, dayDelta)),
      },
    })
  }

  function updatePhaseDateField(phase: ProjectPhase, field: 'startDate' | 'endDate', value: string) {
    if (!value) return
    let nextStart = field === 'startDate' ? value : phase.startDate
    let nextEnd = field === 'endDate' ? value : phase.endDate
    const parsedStart = parseDateSafe(nextStart)
    const parsedEnd = parseDateSafe(nextEnd)
    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      if (field === 'startDate') nextEnd = nextStart
      else nextStart = nextEnd
    }
    updatePhaseMutation.mutate({ phase, data: { startDate: nextStart, endDate: nextEnd } })
  }

  function updateProjectDateField(project: Project, field: 'startDate' | 'endDate', value: string) {
    if (!value) return
    const current = getProjectRangeDateKeys(project)
    let nextStart = field === 'startDate' ? value : current.startDate
    let nextEnd = field === 'endDate' ? value : current.endDate

    const parsedStart = parseDateSafe(nextStart)
    const parsedEnd = parseDateSafe(nextEnd)
    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      if (field === 'startDate') nextEnd = nextStart
      else nextStart = nextEnd
    }

    updateProjectDatesMutation.mutate({
      project,
      startDate: nextStart,
      endDate: nextEnd,
    })
  }

  function handleProjectMoveTarget(targetDay: Date) {
    if (!movingProject) return
    const project = projects.find((item) => item.id === movingProject.projectId)
    if (!project) {
      setMovingProject(null)
      return
    }

    const source = parseDateSafe(movingProject.sourceDate)
    if (!source) {
      setMovingProject(null)
      return
    }

    const dayDelta = differenceInCalendarDays(targetDay, source)
    if (dayDelta !== 0) {
      moveProjectByDays(project, dayDelta)
    }
    setMovingProject(null)
  }

  function handlePhaseMoveTarget(targetDay: Date) {
    if (!movingPhase) return
    const project = projects.find((item) => item.id === movingPhase.projectId)
    const phase = project?.phases?.find((item) => item.id === movingPhase.phaseId)
    if (!phase) {
      setMovingPhase(null)
      return
    }
    const source = parseDateSafe(movingPhase.sourceDate)
    if (!source) {
      setMovingPhase(null)
      return
    }
    const dayDelta = differenceInCalendarDays(targetDay, source)
    if (dayDelta !== 0) movePhaseByDays({ ...phase, project }, dayDelta)
    setMovingPhase(null)
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const activeId = String(active.id)
    if (activeId.startsWith('phase:')) {
      const phaseId = activeId.slice('phase:'.length)
      for (const project of projects) {
        const phase = project.phases?.find((item) => item.id === phaseId)
        if (phase) {
          setDraggedPhase({ phase: { ...phase, project }, sourceDate: format(new Date(), 'yyyy-MM-dd') })
          return
        }
      }
    }
    const projectId = activeId.startsWith('project:') ? activeId.slice('project:'.length) : activeId
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      setDraggedProject({
        project,
        sourceDate: format(new Date(), 'yyyy-MM-dd'), // Current date as source
      })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggedProject(null)
    setDraggedPhase(null)

    if (!over) return

    const activeId = String(active.id)
    const targetDateStr = over.id as string
    const targetDate = parseISO(targetDateStr)

    if (!isValid(targetDate)) return

    if (activeId.startsWith('phase:')) {
      const phaseId = activeId.slice('phase:'.length)
      for (const project of projects) {
        const phase = project.phases?.find((item) => item.id === phaseId)
        if (!phase) continue
        const { start, end } = getPhaseDateRange(phase)
        if (!start) return
        const endDate = end ?? start
        const dayDelta = differenceInCalendarDays(targetDate, start)
        if (dayDelta === 0) return
        updatePhaseMutation.mutate({
          phase: { ...phase, project },
          data: {
            startDate: toDateKey(addDays(start, dayDelta)),
            endDate: toDateKey(addDays(endDate, dayDelta)),
          },
        })
        return
      }
    }

    const projectId = activeId.startsWith('project:') ? activeId.slice('project:'.length) : activeId
    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    const { start, end } = getProjectDateRange(project)
    const fallback = parseDateSafe(project.projectDate) ?? new Date()
    const startDate = start ?? fallback
    const endDate = end ?? startDate

    // Calculate how many days to move based on the dragged project's start date
    const dayDelta = differenceInCalendarDays(targetDate, startDate)

    if (dayDelta === 0) return // No movement needed

    updateProjectDatesMutation.mutate({
      project,
      startDate: toDateKey(addDays(startDate, dayDelta)),
      endDate: toDateKey(addDays(endDate, dayDelta)),
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        {t('calendar.loading')}
      </div>
    )
  }

  if (tasks.length === 0 && projects.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t('calendar.emptyTitle')}
        description={t('calendar.emptyDescription')}
      />
    )
  }

  const selectedTaskCfg = selectedTask ? getTaskCfg(selectedTask.status, t) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[180px] text-center font-semibold capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
          </h3>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {movingProject || movingPhase ? (
            <>
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                {movingPhase ? 'Escoge el nuevo dia para esta fase' : t('calendar.project.pickMoveDay')}
              </div>
              <Button variant="outline" size="sm" onClick={() => { setMovingProject(null); setMovingPhase(null) }}>
                {t('common.cancel')}
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={goToday}>
            {t('calendar.actions.today')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('calendar.filters.title')}
        </span>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-background">
          <Checkbox
            checked={eventFilters.projects}
            onCheckedChange={(checked) => setEventFilter('projects', checked === true)}
            aria-label={t('calendar.filters.projects')}
          />
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t('calendar.filters.projects')}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-background">
          <Checkbox
            checked={eventFilters.phases}
            onCheckedChange={(checked) => setEventFilter('phases', checked === true)}
            aria-label="Fases"
          />
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Fases</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-background">
          <Checkbox
            checked={eventFilters.taskDue}
            onCheckedChange={(checked) => setEventFilter('taskDue', checked === true)}
            aria-label={t('calendar.filters.taskDue')}
          />
          <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t('calendar.filters.taskDue')}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-background">
          <Checkbox
            checked={eventFilters.taskAlarm}
            onCheckedChange={(checked) => setEventFilter('taskAlarm', checked === true)}
            aria-label={t('calendar.filters.taskAlarm')}
          />
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t('calendar.filters.taskAlarm')}</span>
        </label>
      </div>

      {noEventTypesSelected && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {t('calendar.filters.noneSelected')}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="rounded-lg border">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekdays.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDate.get(dayKey) || []
            const dayTasksEvents = dayEvents.filter((e) => e.type === 'task')
            const dayProjectEvents = dayEvents.filter((e) => e.type === 'project')
            const dayPhaseEvents = dayEvents.filter((e) => e.type === 'phase')
            const inMonth = isSameMonth(day, currentMonth)
            const today = isToday(day)
            const hasEvents = dayEvents.length > 0

            // Keep the month grid focused on projects. Tasks stay available from the day sheet.
            const displayCalendarItems = [...dayProjectEvents, ...dayPhaseEvents].slice(0, 3)
            const remainingCalendarItems = dayProjectEvents.length + dayPhaseEvents.length - displayCalendarItems.length

            return (
              <Droppable key={i} id={dayKey} className={`min-h-[80px] border-b border-r p-1 transition-colors sm:min-h-[100px] ${
                !inMonth ? 'bg-muted/30' : ''
              } ${today ? 'bg-primary/5' : ''} ${movingProject || movingPhase ? 'outline outline-1 outline-primary/10 hover:bg-primary/5' : ''}`}>
                <button
                  onClick={() => {
                    if (movingProject) {
                      handleProjectMoveTarget(day)
                      return
                    }
                    if (movingPhase) {
                      handlePhaseMoveTarget(day)
                      return
                    }
                    openDaySheet(day)
                  }}
                  className="mx-auto flex items-center justify-center w-full cursor-pointer"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      today
                        ? 'bg-primary text-primary-foreground'
                        : !inMonth
                          ? 'text-muted-foreground/50'
                          : hasEvents
                            ? 'text-foreground font-bold'
                            : 'text-foreground'
                    } ${hasEvents && !today ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    {format(day, 'd')}
                  </span>
                </button>
                <div className="mt-1 space-y-0.5">
                  {displayCalendarItems.map((event) => {
                    if (event.type === 'task') {
                      const task = event.data as Task
                      const cfg = getTaskCfg(task.status, t)
                      return (
                        <button
                          key={`task-${task.id}-${event.taskDateType || 'due'}`}
                          onClick={(e) => { e.stopPropagation(); openDetail(task) }}
                          className="w-full truncate rounded-sm px-1 py-0.5 text-left text-[10px] leading-tight font-medium transition-opacity hover:opacity-80 sm:text-xs cursor-pointer"
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}
                          title={task.title}
                        >
                          {event.taskDateType === 'alarm' ? (
                            <Bell className="mr-0.5 inline h-2.5 w-2.5 -mt-px" />
                          ) : (
                            <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.text }} />
                          )}
                          {task.title}
                        </button>
                      )
                    } else {
                      if (event.type === 'phase') {
                        const phase = event.data as ProjectPhase
                        const color = PROJECT_PHASE_COLOR_CLASS[phase.phaseType.color] || PROJECT_PHASE_COLOR_CLASS.teal
                        const project = phase.project
                        return (
                          <Draggable key={`phase-${phase.id}`} id={`phase:${phase.id}`}>
                            <button
                              onClick={(e) => { e.stopPropagation(); openPhasePanel({ ...phase, project }) }}
                              className={`w-full truncate rounded-sm border-l-2 px-1 py-0.5 text-left text-[10px] leading-tight font-bold transition-opacity hover:opacity-80 sm:text-xs cursor-pointer ${color.border}`}
                              style={{ backgroundColor: color.bg, color: color.text }}
                              title={`${phase.phaseType.name}${project ? ` · ${project.name}` : ''}`}
                            >
                              <Layers className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
                              {phase.phaseType.name}{project ? ` · ${project.name}` : ''}
                            </button>
                          </Draggable>
                        )
                      }
                      const p = event.data as Project
                      const cfg = getProjectCfg(p.status, t)
                      const label = p.poNumber?.trim() || p.name
                      const tooltipParts = [
                        p.poNumber ? `PO ${p.poNumber}` : p.name,
                        cfg.label,
                        p.contractor?.name,
                      ].filter(Boolean)
                      return (
                        <Draggable key={`proj-${p.id}`} id={`project:${p.id}`}>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDaySheet(day) }}
                            className={`w-full truncate rounded-sm border-l-2 px-1 py-0.5 text-left text-[10px] leading-tight font-bold transition-opacity hover:opacity-80 sm:text-xs cursor-pointer ${cfg.border}`}
                            style={{ backgroundColor: cfg.bg, color: cfg.text }}
                            title={tooltipParts.join(' · ')}
                          >
                            <FolderKanban className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
                            {label}
                          </button>
                        </Draggable>
                      )
                    }
                  })}
                  {remainingCalendarItems > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openDaySheet(day) }}
                      className="w-full px-1 text-left text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium"
                    >
                      {t('calendar.moreEvents', { count: remainingCalendarItems })}
                    </button>
                  )}
                  {dayTasksEvents.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openDaySheet(day) }}
                      className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100"
                      title={t('calendar.day.tasksCount', { count: dayTasksEvents.length })}
                    >
                      <ListTodo className="h-2.5 w-2.5" />
                      {t('calendar.tasksCompact', { count: dayTasksEvents.length })}
                    </button>
                  )}
                </div>
              </Droppable>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium">{t('calendar.legend.title')}</span>
        {Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => {
          const label = t(getTaskStatusKey(key))
          return (
          <div key={`task-${key}`} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${cfg.dotColor}`} />
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>
              {label}
            </Badge>
          </div>
          )
        })}
        <Separator orientation="vertical" className="h-4" />
        {Object.entries(PROJECT_STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([key, cfg]) => (
          <div key={`proj-${key}`} className="flex items-center gap-1.5">
            <FolderKanban className="h-3 w-3" style={{ color: cfg.text }} />
            <span className="text-[10px]">{t(getProjectStatusKey(key))}</span>
          </div>
        ))}
      </div>

      {/* ─── Day Summary Sheet ─── */}
      <Sheet open={daySheetOpen} onOpenChange={setDaySheetOpen}>
        <SheetContent className="sm:max-w-md p-0">
          {selectedDay && (
            <>
              {/* Header with gradient */}
              <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
                <SheetHeader>
                  <SheetTitle className="text-left">
                    <div className="text-2xl font-bold">
                      {format(selectedDay, 'd', { locale: dateLocale })}
                    </div>
                    <div className="text-sm font-normal text-muted-foreground capitalize mt-0.5">
                      {format(selectedDay, 'PPPP', { locale: dateLocale })}
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 rounded-full px-3 py-1">
                    <ListTodo className="h-3.5 w-3.5" />
                    {t('calendar.day.tasksCount', { count: dayTasks.length })}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 rounded-full px-3 py-1">
                    <FolderKanban className="h-3.5 w-3.5" />
                    {dayProjectsWithPhases.length} proyecto(s)
                  </div>
                  {dayPhases.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 rounded-full px-3 py-1">
                      <Layers className="h-3.5 w-3.5" />
                      {dayPhases.length} fase(s)
                    </div>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[calc(100vh-260px)] px-6 pb-6">
                {dayTotalEvents === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('calendar.day.empty')}</p>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    {/* Tasks Section */}
                    {dayTasks.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <ListTodo className="h-4 w-4 text-muted-foreground" />
                          <h4 className="text-sm font-semibold">{t('navigation.page.tasks')}</h4>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {dayTasks.length}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {dayTaskEvents.map((event) => {
                            const task = event.data as Task
                            const cfg = getTaskCfg(task.status, t)
                            return (
                              <button
                                key={`${task.id}-${event.taskDateType || 'due'}`}
                                onClick={() => { closeDaySheet(); setTimeout(() => openDetail(task), 250) }}
                                className="w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm hover:border-primary/30 cursor-pointer"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      {task.status === 'completed' ? (
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                      ) : task.status === 'in_progress' ? (
                                        <Clock className="h-4 w-4 shrink-0 text-sky-500" />
                                      ) : (
                                        <Circle className="h-4 w-4 shrink-0 text-amber-500" />
                                      )}
                                      <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                        {task.title}
                                      </span>
                                    </div>
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-6">
                                        {task.description}
                                      </p>
                                    )}
                                    <div className="mt-2 ml-6 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="inline-flex items-center gap-1">
                                        {event.taskDateType === 'alarm' ? (
                                          <>
                                            <Bell className="h-3 w-3" />
                                            {t('calendar.task.alarm')}
                                          </>
                                        ) : (
                                          <>
                                            <CalendarDays className="h-3 w-3" />
                                            {t('calendar.task.due')}
                                          </>
                                        )}
                                      </span>
                                      {task.project && (
                                        <span className="inline-flex min-w-0 items-center gap-1">
                                          <FolderKanban className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{formatTaskProjectLabel(task.project)}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className={`shrink-0 text-[10px] ${cfg.className}`}>
                                    {cfg.label}
                                  </Badge>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Projects + Phases grouped section */}
                    {dayProjectsWithPhases.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-muted-foreground" />
                          <h4 className="text-sm font-semibold">{t('navigation.page.projects')}</h4>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {dayProjectsWithPhases.length}
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {dayProjectsWithPhases.map(({ project, phases: projectPhases }) => {
                            const cfg = getProjectCfg(project.status, t)
                            const { start, end } = getProjectDateRange(project)
                            const isStart = start && isSameDay(selectedDay, start)
                            const isEnd = end && isSameDay(selectedDay, end)
                            const isSame = isStart && isEnd
                            const poLabel = project.poNumber?.trim()
                            return (
                              <div
                                key={project.id}
                                className={`rounded-lg border border-l-4 p-3 ${cfg.border}`}
                                style={{ backgroundColor: cfg.bg }}
                              >
                                {/* Project header */}
                                <div className="flex items-center gap-2">
                                  <FolderKanban className="h-4 w-4 shrink-0" style={{ color: cfg.text }} />
                                  <span className="text-base font-bold truncate" style={{ color: cfg.text }}>
                                    {poLabel ? `PO ${poLabel}` : project.name}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 ml-6">
                                  <Badge variant="secondary" className={`text-[10px] ${cfg.className}`}>
                                    {cfg.label}
                                  </Badge>
                                  {project.contractor?.name && (
                                    <span className="text-xs font-medium text-foreground">
                                      {project.contractor.name}
                                    </span>
                                  )}
                                </div>
                                {poLabel && (
                                  <div className="mt-1 ml-6 text-[11px] text-muted-foreground truncate">
                                    {project.name} · {project.client.name}
                                  </div>
                                )}
                                {!poLabel && (
                                  <div className="mt-1 ml-6 text-[11px] text-muted-foreground">
                                    {project.client.name}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1 ml-6">
                                  {isSame && (
                                    <span className="text-[10px] font-medium" style={{ color: cfg.text }}>
                                      {t('calendar.project.sameDay')}
                                    </span>
                                  )}
                                  {isStart && !isEnd && (
                                    <span className="text-[10px] font-medium" style={{ color: cfg.text }}>
                                      {t('calendar.project.startDate')}
                                    </span>
                                  )}
                                  {isEnd && !isStart && (
                                    <span className="text-[10px] font-medium" style={{ color: cfg.text }}>
                                      {t('calendar.project.endDate')}
                                    </span>
                                  )}
                                  {!isStart && !isEnd && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {t('calendar.project.range', {
                                        start: formatDateShort(project.startDate, dateLocale),
                                        end: formatDateShort(project.endDate, dateLocale),
                                      })}
                                    </span>
                                  )}
                                </div>

                                {/* Phases on this day for this project */}
                                {projectPhases.length > 0 && (
                                  <div className="mt-3 ml-6 space-y-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                                      <Layers className="inline h-3 w-3 mr-1 -mt-px" />
                                      Fases hoy
                                    </p>
                                    {projectPhases.map((phase) => {
                                      const color = PROJECT_PHASE_COLOR_CLASS[phase.phaseType.color] || PROJECT_PHASE_COLOR_CLASS.teal
                                      const { start: ps, end: pe } = getPhaseDateRange(phase)
                                      const phaseIsStart = ps && isSameDay(selectedDay, ps)
                                      const phaseIsEnd = pe && isSameDay(selectedDay, pe)
                                      return (
                                        <button
                                          key={phase.id}
                                          className={`w-full rounded-md border-l-2 px-2 py-1.5 text-left transition-colors hover:opacity-80 ${color.border}`}
                                          style={{ backgroundColor: `${color.bg}cc` }}
                                          onClick={() => { closeDaySheet(); setTimeout(() => openPhasePanel({ ...phase, project }), 250) }}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <Layers className="h-3 w-3 shrink-0" style={{ color: color.text }} />
                                              <span className="text-xs font-semibold truncate" style={{ color: color.text }}>
                                                {phase.phaseType.name}
                                              </span>
                                              <Badge variant="secondary" className={`text-[10px] px-1 py-0 shrink-0 ${getPhaseStatusClass(phase.status)}`}>
                                                {getPhaseStatusLabel(phase.status)}
                                              </Badge>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                              {phaseIsStart && phaseIsEnd ? 'Hoy' : phaseIsStart ? 'Inicio' : phaseIsEnd ? 'Fin' : `${formatDateShort(phase.startDate, dateLocale)}–${formatDateShort(phase.endDate, dateLocale)}`}
                                            </span>
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Project actions */}
                                <div className="mt-3 ml-6 space-y-2 rounded-md border bg-background/70 p-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => openProjectFromCalendar(project.id)}
                                    >
                                      <FolderKanban className="mr-1 h-3.5 w-3.5" />
                                      {t('calendar.project.openProject')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => moveProjectByDays(project, -1)}
                                      disabled={updateProjectDatesMutation.isPending}
                                    >
                                      <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                      {t('calendar.project.moveBack')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => moveProjectByDays(project, 1)}
                                      disabled={updateProjectDatesMutation.isPending}
                                    >
                                      {t('calendar.project.moveForward')}
                                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => {
                                        setMovingProject({
                                          projectId: project.id,
                                          sourceDate: format(selectedDay, 'yyyy-MM-dd'),
                                        })
                                        closeDaySheet()
                                      }}
                                      disabled={updateProjectDatesMutation.isPending}
                                    >
                                      {t('calendar.project.moveToDay')}
                                    </Button>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                                      {t('calendar.project.editStart')}
                                      <input
                                        type="date"
                                        value={getProjectRangeDateKeys(project).startDate}
                                        onChange={(event) => updateProjectDateField(project, 'startDate', event.target.value)}
                                        disabled={updateProjectDatesMutation.isPending}
                                        className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                                      />
                                    </label>
                                    <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                                      {t('calendar.project.editEnd')}
                                      <input
                                        type="date"
                                        value={getProjectRangeDateKeys(project).endDate}
                                        onChange={(event) => updateProjectDateField(project, 'endDate', event.target.value)}
                                        disabled={updateProjectDatesMutation.isPending}
                                        className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Task Detail Sheet ─── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedTask && selectedTaskCfg && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg leading-tight pr-6">
                  {selectedTask.title}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('tasks.fields.status')}</Label>
                  {editStatus ? (
                    <div className="flex items-center gap-2">
                      <Select value={editingStatus} onValueChange={setEditingStatus}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">{t('dashboard.status.pending')}</SelectItem>
                          <SelectItem value="in_progress">{t('dashboard.status.inProgress')}</SelectItem>
                          <SelectItem value="completed">{t('dashboard.status.completed')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={saveStatus} disabled={updateStatusMutation.isPending}>
                        {updateStatusMutation.isPending ? '...' : '✓'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditStatus(false)}>
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={startEditStatus}
                      className="group flex items-center gap-2 cursor-pointer"
                    >
                      <Badge variant="secondary" className={selectedTaskCfg.className}>
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${selectedTaskCfg.dotColor}`} />
                        {selectedTaskCfg.label}
                      </Badge>
                      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                <Separator />

                {/* Project */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('tasks.fields.project')}</Label>
                  <p className="text-sm font-medium">
                    {selectedTask.project ? formatTaskProjectLabel(selectedTask.project) : t('tasks.fields.noProject')}
                  </p>
                </div>

                <Separator />

                {/* Due Date */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('tasks.fields.dueDate')}</Label>
                  <p className="text-sm font-medium">
                    {formatDateSafe(selectedTask.dueDate, dateLocale, t('calendar.noDate'))}
                  </p>
                </div>

                <Separator />

                {/* Alarm Date */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('tasks.fields.alarmDate')}</Label>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Bell className="h-4 w-4 text-amber-600" />
                    {formatDateSafe(selectedTask.alarmDate, dateLocale, t('calendar.noDate'))}
                  </p>
                </div>

                <Separator />

                {/* Completed Date */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('tasks.fields.completedAt')}</Label>
                  <p className="text-sm font-medium">
                    {formatDateSafe(selectedTask.completedAt, dateLocale, t('calendar.noDate'))}
                  </p>
                </div>

                <Separator />

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('tasks.fields.description')}</Label>
                    {!editDescription && (
                      <button
                        onClick={startEditDescription}
                        className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('common.edit')}
                      </button>
                    )}
                  </div>
                  {editDescription ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        rows={4}
                        placeholder={t('calendar.descriptionPlaceholder')}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditDescription(false)}>
                          {t('common.cancel')}
                        </Button>
                        <Button size="sm" onClick={saveDescription} disabled={updateDescriptionMutation.isPending}>
                          {updateDescriptionMutation.isPending ? t('calendar.actions.saving') : t('common.saveChanges')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm ${selectedTask.description ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                      {selectedTask.description || t('calendar.noDescription')}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Created Date */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('calendar.createdDate')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDateSafe(selectedTask.createdAt, dateLocale, t('calendar.noDate'))}
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <SheetFooter className="mt-8 flex-row gap-2 sm:flex-row">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.delete')}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => selectedTask && deleteMutation.mutate(selectedTask.id)}
        title={t('tasks.delete.title')}
        description={t('calendar.deleteDescription', { title: selectedTask?.title ?? '' })}
      />

      {/* ─── Phase Detail Panel ─── */}
      <Sheet open={phasePanelOpen} onOpenChange={setPhasePanelOpen}>
        <SheetContent className="sm:max-w-lg p-0 flex flex-col h-full">
          {selectedPhase && (() => {
            const phase = selectedPhase
            const project = phase.project
            const color = PROJECT_PHASE_COLOR_CLASS[phase.phaseType.color] || PROJECT_PHASE_COLOR_CLASS.teal
            const phaseProjectTasks = tasks.filter((t) => t.projectId === phase.projectId)
            return (
              <>
                {/* Panel header */}
                <div className="p-5 pb-4 shrink-0" style={{ backgroundColor: `${color.bg}cc`, borderBottom: `2px solid ${color.text}25` }}>
                  <SheetHeader>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border" style={{ backgroundColor: `${color.text}15`, borderColor: `${color.text}30` }}>
                        <Layers className="h-5 w-5" style={{ color: color.text }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <SheetTitle className="text-left text-base leading-tight" style={{ color: color.text }}>
                          {phase.phaseType.name}
                        </SheetTitle>
                        {project && (
                          <div className="mt-0.5 text-sm font-medium text-foreground truncate">
                            {project.poNumber ? `PO ${project.poNumber} · ` : ''}{project.name}
                          </div>
                        )}
                        {project?.client && (
                          <div className="text-xs text-muted-foreground">{project.client.name}</div>
                        )}
                      </div>
                    </div>
                  </SheetHeader>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${getPhaseStatusClass(phase.status)}`}>
                      {getPhaseStatusLabel(phase.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateShort(phase.startDate, dateLocale)} → {formatDateShort(phase.endDate, dateLocale)}
                    </span>
                    {project && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] ml-auto bg-background/70"
                        onClick={() => { closePhasePanel(); openProject(project.id) }}
                      >
                        <FolderKanban className="mr-1 h-3 w-3" />
                        Abrir proyecto
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 px-5 pb-6">
                  <div className="space-y-6 pt-5">

                    {/* Phase controls */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Controles de fase</p>
                      <div className="rounded-md border p-3 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                            {t('calendar.project.editStart')}
                            <input
                              type="date"
                              value={phase.startDate}
                              onChange={(e) => updatePhaseDateField(phase, 'startDate', e.target.value)}
                              disabled={updatePhaseMutation.isPending}
                              className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                            />
                          </label>
                          <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                            {t('calendar.project.editEnd')}
                            <input
                              type="date"
                              value={phase.endDate}
                              onChange={(e) => updatePhaseDateField(phase, 'endDate', e.target.value)}
                              disabled={updatePhaseMutation.isPending}
                              className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                            />
                          </label>
                        </div>
                        <Select
                          value={phase.status}
                          onValueChange={(status) => updatePhaseMutation.mutate({ phase, data: { status } })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="in_progress">En progreso</SelectItem>
                            <SelectItem value="completed">Completada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Project tasks */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ListTodo className="h-4 w-4 text-muted-foreground" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tareas del proyecto</p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{phaseProjectTasks.length}</Badge>
                      </div>
                      {phaseProjectTasks.length === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-center">
                          <ListTodo className="mx-auto h-6 w-6 text-muted-foreground/30 mb-2" />
                          <p className="text-xs text-muted-foreground">Sin tareas para este proyecto</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {phaseProjectTasks.map((task) => {
                            const cfg = getTaskCfg(task.status, t)
                            const isCompleted = task.status === 'completed'
                            return (
                              <div key={task.id} className="flex items-start gap-2.5 rounded-md border px-3 py-2 transition-colors hover:bg-muted/30">
                                <button
                                  className="mt-0.5 shrink-0"
                                  onClick={() => toggleTaskMutation.mutate({
                                    id: task.id,
                                    status: isCompleted ? 'pending' : 'completed',
                                  })}
                                >
                                  {isCompleted
                                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    : <Circle className="h-4 w-4 text-muted-foreground" />
                                  }
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium leading-tight ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                    {task.title}
                                  </p>
                                  {task.dueDate && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      <CalendarDays className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
                                      {formatDateShort(task.dueDate, dateLocale)}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="secondary" className={`shrink-0 text-[10px] ${cfg.className}`}>
                                  {cfg.label}
                                </Badge>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Phase notes */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-muted-foreground" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notas de fase</p>
                      </div>
                      <Textarea
                        value={phaseNoteInput}
                        onChange={(e) => setPhaseNoteInput(e.target.value)}
                        placeholder="Agrega notas sobre esta fase: materiales pendientes, recordatorios, condiciones especiales..."
                        rows={4}
                        className="text-sm resize-none"
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => updatePhaseMutation.mutate({ phase, data: { notes: phaseNoteInput } })}
                        disabled={updatePhaseMutation.isPending || phaseNoteInput === (phase.notes || '')}
                      >
                        {updatePhaseMutation.isPending ? 'Guardando...' : 'Guardar notas'}
                      </Button>
                    </div>

                  </div>
                </ScrollArea>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>

    {/* Drag Overlay */}
    <DragOverlay>
      {draggedPhase ? (
        <div className="rounded-sm border-l-2 border-primary bg-background px-1 py-0.5 text-left text-[10px] leading-tight font-bold opacity-90 shadow-lg sm:text-xs">
          <Layers className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
          {draggedPhase.phase.phaseType.name}
        </div>
      ) : draggedProject ? (
        <div className="rounded-sm border-l-2 px-1 py-0.5 text-left text-[10px] leading-tight font-bold sm:text-xs opacity-90 shadow-lg bg-background border-primary">
          <FolderKanban className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
          {draggedProject.project.poNumber?.trim() || draggedProject.project.name}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}
