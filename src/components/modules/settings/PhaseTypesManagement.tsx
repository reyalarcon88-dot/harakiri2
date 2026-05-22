'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Layers, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PROJECT_PHASE_COLOR_CLASS } from '@/lib/project-phases'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PhaseType {
  id: string
  name: string
  color: string
  sortOrder: number
  active: boolean
}

const PHASE_COLORS = ['rose', 'amber', 'sky', 'emerald', 'violet', 'teal', 'slate']

export function PhaseTypesManagement() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PhaseType | null>(null)
  const [form, setForm] = useState({ name: '', color: 'teal', sortOrder: '0', active: true })

  const { data: phaseTypes = [], isLoading } = useQuery<PhaseType[]>({
    queryKey: ['project-phase-types-settings'],
    queryFn: () => fetch('/api/project-phase-types').then((response) => response.json()),
  })

  function resetForm() {
    setEditing(null)
    setForm({ name: '', color: 'teal', sortOrder: '0', active: true })
  }

  function openCreate() {
    resetForm()
    setOpen(true)
  }

  function openEdit(type: PhaseType) {
    setEditing(type)
    setForm({
      name: type.name,
      color: type.color || 'teal',
      sortOrder: String(type.sortOrder || 0),
      active: type.active,
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        color: form.color,
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      }
      const res = await fetch(editing ? `/api/project-phase-types/${editing.id}` : '/api/project-phase-types', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el tipo de fase')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-phase-types-settings'] })
      queryClient.invalidateQueries({ queryKey: ['project-phase-types'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(editing ? 'Tipo de fase actualizado' : 'Tipo de fase creado')
      setOpen(false)
      resetForm()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (type: PhaseType) => {
      const res = await fetch(`/api/project-phase-types/${type.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo eliminar el tipo de fase')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-phase-types-settings'] })
      queryClient.invalidateQueries({ queryKey: ['project-phase-types'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(data?.deactivated ? 'Tipo de fase desactivado' : 'Tipo de fase eliminado')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-teal-600" />
                <CardTitle className="text-base">Tipos de fases</CardTitle>
              </div>
              <CardDescription>Administra las fases operativas disponibles para proyectos.</CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {phaseTypes.map((type) => {
                const color = PROJECT_PHASE_COLOR_CLASS[type.color] || PROJECT_PHASE_COLOR_CLASS.teal
                return (
                  <div key={type.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{type.name}</p>
                      <p className="text-xs text-muted-foreground">Orden {type.sortOrder}</p>
                    </div>
                    <Badge variant="secondary" className={type.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>
                      {type.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(type)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(type)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tipo de fase' : 'Nuevo tipo de fase'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={form.color} onValueChange={(color) => setForm((current) => ({ ...current, color }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PHASE_COLORS.map((color) => (
                      <SelectItem key={color} value={color}>{color}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              Activo para nuevos proyectos
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
