'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  ExternalLink,
  FolderKanban,
  HardHat,
  ListTodo,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Users,
  Wrench,
} from 'lucide-react'
import { useNavigationStore } from '@/stores/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { EmptyState } from '@/components/shared/EmptyState'
import { ProjectStatusBadge } from '@/components/shared/ProjectStatusBadge'
import { ToolStatusBadge } from '@/components/shared/ToolStatusBadge'

type PersonType = 'contractor' | 'installer'

interface Person {
  type: PersonType
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  role: string
  company: string
  active: boolean
  projectCount: number
  toolCount: number
  taskCount: number
}

interface ProjectRow {
  id: string
  name: string
  poNumber?: string
  status: string
  contractorId?: string | null
  client?: { name: string } | null
}

interface ToolRow {
  id: string
  name: string
  brand: string
  code: string
  serial: string
  status: string
  condition: string
  currentContractorId?: string | null
  currentInstallerId?: string | null
}

interface TaskRow {
  id: string
  title: string
  status: string
  dueDate: string | null
  alarmDate: string | null
  assigneeType?: 'contractor' | 'installer' | null
  assigneeId?: string | null
  project?: { id: string; name: string; poNumber?: string | null } | null
}

function personKey(person: Pick<Person, 'type' | 'id'>) {
  return `${person.type}:${person.id}`
}

const NO_PROJECT_VALUE = '__none__'

const emptyTaskForm = {
  title: '',
  description: '',
  projectId: '',
  dueDate: '',
  alarmDate: '',
}

type SectionKey = 'projects' | 'tools' | 'tasks'

function CollapsibleSection({
  icon: Icon,
  title,
  count,
  isOpen,
  onToggle,
  headerAction,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count: number
  isOpen: boolean
  onToggle: () => void
  headerAction?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        className="-mx-1 flex w-[calc(100%+0.5rem)] cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{title}</h4>
        <Badge variant="secondary" className="text-[10px]">
          {count}
        </Badge>
        <div
          className="ml-auto flex items-center gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          {headerAction}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>
      {isOpen && <div>{children}</div>}
    </div>
  )
}

export function PersonnelModule() {
  const openProject = useNavigationStore((s) => s.openProject)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | PersonType>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    projects: false,
    tools: false,
    tasks: false,
  })

  function toggleSection(key: SectionKey) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }))
  }

  const { data: personnel = [], isLoading: personnelLoading } = useQuery<Person[]>({
    queryKey: ['personnel', search],
    queryFn: () =>
      fetch(`/api/personnel${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((r) => r.json()),
  })

  const { data: tools = [] } = useQuery<ToolRow[]>({
    queryKey: ['tools'],
    queryFn: () => fetch('/api/tools').then((r) => r.json()),
  })

  const { data: projects = [] } = useQuery<ProjectRow[]>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then((r) => r.json()),
  })

  const { data: tasks = [] } = useQuery<TaskRow[]>({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/tasks').then((r) => r.json()),
  })

  const filteredPersonnel = useMemo(
    () => personnel.filter((p) => typeFilter === 'all' || p.type === typeFilter),
    [personnel, typeFilter]
  )

  // Auto-select first person if nothing selected (or filter cleared current selection)
  useEffect(() => {
    if (filteredPersonnel.length === 0) {
      setSelectedKey(null)
      return
    }
    if (!selectedKey || !filteredPersonnel.some((p) => personKey(p) === selectedKey)) {
      setSelectedKey(personKey(filteredPersonnel[0]))
    }
  }, [filteredPersonnel, selectedKey])

  const selectedPerson = useMemo(() => {
    if (!selectedKey) return null
    return filteredPersonnel.find((p) => personKey(p) === selectedKey) || null
  }, [selectedKey, filteredPersonnel])

  const personProjects = useMemo(() => {
    if (!selectedPerson || selectedPerson.type !== 'contractor') return []
    return projects.filter((project) => project.contractorId === selectedPerson.id)
  }, [selectedPerson, projects])

  const personTools = useMemo(() => {
    if (!selectedPerson) return []
    if (selectedPerson.type === 'contractor') {
      return tools.filter((tool) => tool.currentContractorId === selectedPerson.id)
    }
    return tools.filter((tool) => tool.currentInstallerId === selectedPerson.id)
  }, [selectedPerson, tools])

  const personTasks = useMemo(() => {
    if (!selectedPerson) return []
    return tasks.filter(
      (task) => task.assigneeType === selectedPerson.type && task.assigneeId === selectedPerson.id
    )
  }, [selectedPerson, tasks])

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPerson) throw new Error('Selecciona una persona')
      if (!taskForm.title.trim()) throw new Error('El título es obligatorio')
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description,
          projectId: taskForm.projectId || null,
          dueDate: taskForm.dueDate || null,
          alarmDate: taskForm.alarmDate || null,
          assigneeType: selectedPerson.type,
          assigneeId: selectedPerson.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la tarea')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      toast.success('Tarea creada')
      setTaskDialogOpen(false)
      setTaskForm(emptyTaskForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function openNewTaskDialog() {
    setTaskForm(emptyTaskForm)
    setTaskDialogOpen(true)
  }

  const contractorCount = useMemo(() => personnel.filter((p) => p.type === 'contractor').length, [personnel])
  const installerCount = useMemo(() => personnel.filter((p) => p.type === 'installer').length, [personnel])

  function HolderIcon({ type, className }: { type: PersonType; className?: string }) {
    if (type === 'contractor') return <Building2 className={className} />
    return <HardHat className={className} />
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 -mt-4 space-y-3 border-b bg-background px-4 pb-3 pt-4 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar nombre, empresa, especialidad..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={typeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('all')}
            >
              <Users className="mr-2 h-4 w-4" />
              Todos · {personnel.length}
            </Button>
            <Button
              variant={typeFilter === 'contractor' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('contractor')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Contratistas · {contractorCount}
            </Button>
            <Button
              variant={typeFilter === 'installer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('installer')}
            >
              <HardHat className="mr-2 h-4 w-4" />
              Instaladores · {installerCount}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Lista lateral */}
        <Card className="self-start">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {personnelLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : filteredPersonnel.length === 0 ? (
              <div className="p-2">
                <EmptyState
                  icon={Users}
                  title="Sin resultados"
                  description="Ajusta la búsqueda o el filtro para encontrar personal."
                />
              </div>
            ) : (
              (['contractor', 'installer'] as PersonType[]).map((group) => {
                const items = filteredPersonnel.filter((p) => p.type === group)
                if (items.length === 0) return null
                const Icon = group === 'contractor' ? Building2 : HardHat
                const label = group === 'contractor' ? 'Contratistas' : 'Instaladores'
                return (
                  <div key={group} className="space-y-0.5">
                    <div className="flex items-center gap-1.5 px-1 pb-0.5 pt-3 first:pt-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </span>
                    </div>
                    {items.map((person) => {
                      const key = personKey(person)
                      const isSelected = key === selectedKey
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedKey(key)}
                          className={`w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                              {person.name}
                            </span>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {person.toolCount} hrr
                            </Badge>
                          </div>
                          {(person.role || person.company) && (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {[person.role, person.company].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Panel detalle */}
        {selectedPerson ? (
          <Card className="self-start">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                    <HolderIcon type={selectedPerson.type} className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-tight">{selectedPerson.name}</CardTitle>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium">
                        {selectedPerson.type === 'contractor' ? 'Contratista' : 'Instalador'}
                      </span>
                      {selectedPerson.role && (
                        <>
                          <span>·</span>
                          <span>{selectedPerson.role}</span>
                        </>
                      )}
                      {selectedPerson.company && (
                        <>
                          <span>·</span>
                          <span>{selectedPerson.company}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {selectedPerson.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedPerson.phone}
                        </span>
                      )}
                      {selectedPerson.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{selectedPerson.email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {selectedPerson.type === 'contractor' && (
                    <Badge variant="outline" className="font-mono tabular-nums">
                      {personProjects.length} proy.
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-mono tabular-nums">
                    {personTools.length} hrr.
                  </Badge>
                  <Badge variant="outline" className="font-mono tabular-nums">
                    {personTasks.length} tar.
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Proyectos */}
              {selectedPerson.type === 'contractor' && (
                <CollapsibleSection
                  icon={FolderKanban}
                  title="Proyectos asignados"
                  count={personProjects.length}
                  isOpen={openSections.projects}
                  onToggle={() => toggleSection('projects')}
                >
                  {personProjects.length === 0 ? (
                    <div className="rounded-md border border-dashed px-4 py-6 text-center">
                      <FolderKanban className="mx-auto h-6 w-6 text-muted-foreground/30" />
                      <p className="mt-2 text-xs text-muted-foreground">Sin proyectos asignados a este contratista.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {personProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => openProject(project.id)}
                          className="group flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {project.poNumber ? `PO ${project.poNumber} · ` : ''}
                                {project.name}
                              </span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                            {project.client?.name && (
                              <div className="text-xs text-muted-foreground">{project.client.name}</div>
                            )}
                          </div>
                          <ProjectStatusBadge status={project.status} />
                        </button>
                      ))}
                    </div>
                  )}
                </CollapsibleSection>
              )}

              {/* Herramientas */}
              <CollapsibleSection
                icon={Wrench}
                title="Herramientas en posesión"
                count={personTools.length}
                isOpen={openSections.tools}
                onToggle={() => toggleSection('tools')}
              >
                {personTools.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-6 text-center">
                    <Wrench className="mx-auto h-6 w-6 text-muted-foreground/30" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedPerson.name} no tiene herramientas asignadas actualmente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {personTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{tool.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[tool.brand || tool.code, tool.serial ? `SN ${tool.serial}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                        <ToolStatusBadge status={tool.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Tareas */}
              <CollapsibleSection
                icon={ListTodo}
                title="Tareas asignadas"
                count={personTasks.length}
                isOpen={openSections.tasks}
                onToggle={() => toggleSection('tasks')}
                headerAction={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={openNewTaskDialog}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Nueva tarea
                  </Button>
                }
              >
                {personTasks.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-6 text-center">
                    <ListTodo className="mx-auto h-6 w-6 text-muted-foreground/30" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      No hay tareas asignadas a {selectedPerson.name}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {personTasks.map((task) => {
                      const isCompleted = task.status === 'completed'
                      const StatusIcon = isCompleted
                        ? CheckCircle2
                        : task.status === 'in_progress'
                          ? Clock
                          : Circle
                      const statusTone = isCompleted
                        ? 'text-emerald-600'
                        : task.status === 'in_progress'
                          ? 'text-sky-600'
                          : 'text-amber-600'
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-2.5 rounded-md border px-3 py-2"
                        >
                          <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${statusTone}`} />
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm font-medium leading-tight ${isCompleted ? 'text-muted-foreground line-through' : ''}`}
                            >
                              {task.title}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              {task.project && (
                                <span className="inline-flex items-center gap-1">
                                  <FolderKanban className="h-3 w-3" />
                                  <span className="truncate">
                                    {task.project.poNumber ? `PO ${task.project.poNumber}` : task.project.name}
                                  </span>
                                </span>
                              )}
                              {task.alarmDate && (
                                <span className="inline-flex items-center gap-1">
                                  <Bell className="h-3 w-3" />
                                  {task.alarmDate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CollapsibleSection>
            </CardContent>
          </Card>
        ) : (
          <Card className="self-start">
            <CardContent className="p-8">
              <EmptyState
                icon={Users}
                title="Selecciona una persona"
                description="Elige un contratista o instalador de la lista para ver sus proyectos, herramientas y tareas."
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Nueva tarea {selectedPerson ? `para ${selectedPerson.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                placeholder="¿Qué hay que hacer?"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Descripción</Label>
              <Textarea
                id="task-description"
                rows={3}
                value={taskForm.description}
                onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-project">Proyecto</Label>
              <Select
                value={taskForm.projectId || NO_PROJECT_VALUE}
                onValueChange={(value) =>
                  setTaskForm({ ...taskForm, projectId: value === NO_PROJECT_VALUE ? '' : value })
                }
              >
                <SelectTrigger id="task-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT_VALUE}>Sin proyecto</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.poNumber ? `PO ${project.poNumber} - ${project.name}` : project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-due">Fecha límite</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-alarm">Alarma</Label>
                <Input
                  id="task-alarm"
                  type="date"
                  value={taskForm.alarmDate}
                  onChange={(event) => setTaskForm({ ...taskForm, alarmDate: event.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createTaskMutation.mutate()}
              disabled={!taskForm.title.trim() || createTaskMutation.isPending}
            >
              {createTaskMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
