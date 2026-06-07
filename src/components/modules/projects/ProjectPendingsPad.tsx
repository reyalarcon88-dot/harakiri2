'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pin, Plus, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parsePendingText } from '@/lib/parse-pending-text'

interface ProjectTask {
  id: string
  title: string
  dueDate: string | null
  status: string
  priority: number
  projectId: string | null
}

interface Material {
  productId: string
  product: { id: string; name: string; code: string }
}

interface Props {
  projectId: string
  projectMaterials: Material[]
  slim?: boolean
}

function formatDue(due: string): string {
  const [y, m, d] = due.split('-').map(Number)
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d))
}

async function apiFetchTasks(projectId: string): Promise<ProjectTask[]> {
  const r = await fetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}`)
  if (!r.ok) throw new Error('fetch tasks')
  return r.json()
}

async function apiCreateTask(data: { title: string; dueDate: string | null; priority: number; projectId: string }): Promise<ProjectTask> {
  const r = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, status: 'pending' }),
  })
  if (!r.ok) throw new Error('create task')
  return r.json()
}

async function apiUpdateTask(id: string, data: Partial<ProjectTask>): Promise<ProjectTask> {
  const r = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error('update task')
  return r.json()
}

async function apiDeleteTask(id: string): Promise<void> {
  const r = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete task')
}

interface TaskRowProps {
  task: ProjectTask
  editingId: string | null
  editValue: string
  editRef: React.RefObject<HTMLInputElement | null>
  onToggle: (t: ProjectTask) => void
  onStartEdit: (t: ProjectTask) => void
  onCommitEdit: (t: ProjectTask) => void
  onEditChange: (v: string) => void
  onDelete: (id: string) => void
}

function TaskRow({ task, editingId, editValue, editRef, onToggle, onStartEdit, onCommitEdit, onEditChange, onDelete }: TaskRowProps) {
  const isCompleted = task.status === 'completed'
  const isEditing = editingId === task.id
  const isUrgent = task.priority === 1

  return (
    <div className="group flex items-start gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-amber-100/60">
      <button
        type="button"
        onClick={() => onToggle(task)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-amber-200/60"
        aria-label={isCompleted ? 'Marcar como pendiente' : 'Marcar como hecho'}
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
            isCompleted
              ? 'border-amber-500 bg-amber-500'
              : 'border-amber-300 bg-white group-hover:border-amber-500'
          }`}
        >
          {isCompleted && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
        </span>
      </button>

      <div className="min-w-0 flex-1 py-1">
        {isEditing ? (
          <Input
            ref={editRef}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommitEdit(task) }
              if (e.key === 'Escape') { e.preventDefault(); onCommitEdit(task) }
            }}
            onBlur={() => onCommitEdit(task)}
            className="h-5 border-amber-300 bg-white/90 px-1 py-0 text-xs focus-visible:ring-amber-300"
          />
        ) : (
          <button
            type="button"
            onClick={() => isCompleted ? onToggle(task) : onStartEdit(task)}
            className={`block w-full text-left text-xs leading-snug ${
              isCompleted
                ? 'cursor-pointer text-amber-500/60 line-through hover:text-amber-700'
                : 'cursor-text text-amber-900 hover:text-amber-700'
            }`}
            title={isCompleted ? 'Click para re-abrir' : 'Click para editar'}
          >
            {isUrgent && !isCompleted && <span className="mr-1 text-rose-500">!!</span>}
            {task.title}
          </button>
        )}
        {task.dueDate && !isEditing && (
          <span className="mt-0.5 inline-block rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            {formatDue(task.dueDate)}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="mt-0.5 shrink-0 text-amber-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
        aria-label="Eliminar pendiente"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export function ProjectPendingsPad({ projectId, projectMaterials, slim = false }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const editRef = useRef<HTMLInputElement | null>(null)
  const qc = useQueryClient()

  const queryKey = ['project-tasks', projectId]

  const { data: tasks = [], isLoading } = useQuery<ProjectTask[]>({
    queryKey,
    queryFn: () => apiFetchTasks(projectId),
    refetchOnMount: 'always',
  })

  const createMutation = useMutation({
    mutationFn: apiCreateTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setInput('')
    },
    onError: () => toast.error('Error al crear pendiente'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProjectTask> }) => apiUpdateTask(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<ProjectTask[]>(queryKey) ?? []
      qc.setQueryData<ProjectTask[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === id ? { ...t, ...data } : t)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev)
      toast.error('Error al actualizar pendiente')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: apiDeleteTask,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<ProjectTask[]>(queryKey) ?? []
      qc.setQueryData<ProjectTask[]>(queryKey, (old = []) => old.filter((t) => t.id !== id))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev)
      toast.error('Error al eliminar pendiente')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (editingId) {
      const t = setTimeout(() => {
        editRef.current?.focus()
        editRef.current?.select()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [editingId])

  function handleAdd() {
    const t = input.trim()
    if (!t) return
    const p = parsePendingText(t, projectMaterials)
    createMutation.mutate({
      title: p.title,
      dueDate: p.dueDate,
      priority: p.priority,
      projectId,
    })
  }

  function handleToggle(task: ProjectTask) {
    updateMutation.mutate({
      id: task.id,
      data: { status: task.status === 'completed' ? 'pending' : 'completed' },
    })
  }

  function startEdit(task: ProjectTask) {
    setEditingId(task.id)
    setEditValue(task.title)
  }

  function commitEdit(task: ProjectTask) {
    const next = editValue.trim()
    setEditingId(null)
    if (next && next !== task.title) {
      updateMutation.mutate({ id: task.id, data: { title: next } })
    }
  }

  const pending = tasks.filter((t) => t.status !== 'completed')
  const completed = tasks.filter((t) => t.status === 'completed')
  const count = pending.length

  const preview = input.trim() ? parsePendingText(input.trim(), projectMaterials) : null
  const hints: string[] = []
  if (preview?.dueDate) hints.push(`📅 ${formatDue(preview.dueDate)}`)
  if (preview?.priority === 1) hints.push('🔴 Urgente')
  if (preview?.linkedMaterial) hints.push(`📦 ${preview.linkedMaterial.code}`)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 ${
            slim ? 'h-7 px-1.5 text-[11px]' : 'h-8 px-2.5 text-xs'
          }`}
          title="Mis pendientes del proyecto"
        >
          <Pin className="h-3.5 w-3.5 shrink-0" />
          {count > 0 ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold tabular-nums text-white">
              {count}
            </span>
          ) : (
            !slim && <span>Pendientes</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 border-amber-200 p-0 shadow-lg"
        style={{ background: 'linear-gradient(160deg, #fffbeb 0%, #fef3c7 100%)' }}
        align="end"
        sideOffset={6}
      >
        <div className="flex items-center gap-1.5 border-b border-amber-200/70 px-3 py-2">
          <Pin className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-900">Mis pendientes</span>
          {count > 0 && (
            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </div>

        <div className="border-b border-amber-100 px-3 py-2.5">
          <div className="flex gap-1.5">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Anotar pendiente… (Enter)"
              className="h-7 flex-1 border-amber-200 bg-white/85 text-xs placeholder:text-amber-400 focus-visible:ring-amber-300"
              disabled={createMutation.isPending}
            />
            <Button
              type="button"
              size="icon"
              onClick={handleAdd}
              disabled={!input.trim() || createMutation.isPending}
              className="h-7 w-7 shrink-0 bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-200"
              aria-label="Agregar pendiente"
            >
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
          {hints.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {hints.map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[10px] text-amber-600/70">
            Tip: usa <span className="font-semibold">mañana</span>, <span className="font-semibold">viernes</span>, <span className="font-semibold">el 15</span> o <span className="font-semibold">!!</span> para urgentes.
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto px-2 py-2">
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            </div>
          )}

          {!isLoading && tasks.length === 0 && (
            <p className="py-4 text-center text-xs text-amber-600/60">
              Sin pendientes. Anota uno arriba.
            </p>
          )}

          {pending.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              editingId={editingId}
              editValue={editValue}
              editRef={editRef}
              onToggle={handleToggle}
              onStartEdit={startEdit}
              onCommitEdit={commitEdit}
              onEditChange={setEditValue}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}

          {completed.length > 0 && (
            <>
              {pending.length > 0 && <div className="my-1.5 border-t border-amber-200/50" />}
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  editingId={editingId}
                  editValue={editValue}
                  editRef={editRef}
                  onToggle={handleToggle}
                  onStartEdit={startEdit}
                  onCommitEdit={commitEdit}
                  onEditChange={setEditValue}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
