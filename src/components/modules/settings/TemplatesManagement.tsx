'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Edit2, FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

interface TemplateProduct {
  id: string
  name: string
  code: string
}

interface TemplateItem {
  id?: string
  productId: string
  plannedQuantity: number
  section: string
  sortOrder?: number
  product: TemplateProduct
}

interface Template {
  id: string
  name: string
  description?: string
  projectType?: string
  sourceFileName?: string
  items: TemplateItem[]
}

interface EditRow {
  key: string
  productId: string
  productName: string
  productCode: string
  quantity: string
  section: string
}

function createEditRow(): EditRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productId: '',
    productName: '',
    productCode: '',
    quantity: '',
    section: '',
  }
}

function ProductSelectCell({
  products,
  value,
  onChange,
}: {
  products: TemplateProduct[]
  value: string
  onChange: (id: string, name: string, code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = products.find((p) => p.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal text-left h-8 text-sm"
        >
          {selected ? (
            <span className="min-w-0 truncate">
              <span className="font-medium">{selected.name}</span>
              <span className="ml-1 text-xs text-muted-foreground">({selected.code})</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Seleccionar producto…</span>
          )}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar producto…" className="h-8" />
          <CommandList className="max-h-64">
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.code}`}
                  onSelect={() => {
                    onChange(p.id, p.name, p.code)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={`mr-2 h-3 w-3 ${value === p.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.code}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function TemplatesManagement() {
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editRows, setEditRows] = useState<EditRow[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['material-templates-settings'],
    queryFn: () =>
      fetch('/api/material-templates?includeItems=true').then((r) => r.json()),
  })

  const { data: products = [] } = useQuery<TemplateProduct[]>({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
    enabled: editOpen,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const res = await fetch(`/api/material-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error al guardar plantilla')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-templates-settings'] })
      queryClient.invalidateQueries({ queryKey: ['material-templates'] })
      queryClient.invalidateQueries({ queryKey: ['db-stats'] })
      toast.success('Plantilla actualizada')
      setEditOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/material-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar plantilla')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-templates-settings'] })
      queryClient.invalidateQueries({ queryKey: ['material-templates'] })
      queryClient.invalidateQueries({ queryKey: ['db-stats'] })
      toast.success('Plantilla eliminada')
      setDeleteId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(template: Template) {
    setEditingTemplate(template)
    setEditName(template.name)
    setEditType(template.projectType || '')
    setEditDesc(template.description || '')
    setEditRows(
      template.items.length > 0
        ? template.items.map((item) => ({
            key: item.id || `${Date.now()}-${Math.random()}`,
            productId: item.productId,
            productName: item.product.name,
            productCode: item.product.code,
            quantity: String(item.plannedQuantity),
            section: item.section || '',
          }))
        : [createEditRow()]
    )
    setEditOpen(true)
  }

  function handleSave() {
    if (!editingTemplate) return
    if (!editName.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    const validRows = editRows.filter((r) => r.productId && parseFloat(r.quantity) > 0)
    if (validRows.length === 0) {
      toast.error('Agrega al menos un material con producto y cantidad válida')
      return
    }
    updateMutation.mutate({
      id: editingTemplate.id,
      data: {
        name: editName.trim(),
        projectType: editType.trim(),
        description: editDesc.trim(),
        items: validRows.map((r, i) => ({
          productId: r.productId,
          plannedQuantity: parseFloat(r.quantity),
          section: r.section.trim(),
          sortOrder: i,
        })),
      },
    })
  }

  function updateRow(key: string, patch: Partial<EditRow>) {
    setEditRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    setEditRows((rows) => {
      const next = rows.filter((r) => r.key !== key)
      return next.length > 0 ? next : [createEditRow()]
    })
  }

  const deleteTarget = templates.find((t) => t.id === deleteId)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-pink-500" />
            <CardTitle className="text-base">Plantillas de materiales</CardTitle>
          </div>
          <CardDescription>
            Visualiza y edita las plantillas de materiales. Créalas desde el módulo de Proyectos
            usando "Crear plantilla".
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin plantillas creadas aún.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{template.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {template.projectType ? (
                        <Badge
                          variant="outline"
                          className="text-xs border-teal-200 bg-teal-50 text-teal-800"
                        >
                          {template.projectType}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {template.items.length}{' '}
                        {template.items.length === 1 ? 'material' : 'materiales'}
                      </span>
                      {template.description ? (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          · {template.description}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Editar"
                    onClick={() => openEdit(template)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    title="Eliminar"
                    onClick={() => setDeleteId(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-teal-600" />
              Editar plantilla
            </DialogTitle>
            <DialogDescription>
              Modifica el nombre, tipo de proyecto y los materiales de la plantilla.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ej. Materiales de estructura"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de proyecto</Label>
                <Input
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  placeholder="Ej. Aluminio, Vidrio, Estructura"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Notas opcionales"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Materiales</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setEditRows((r) => [...r, createEditRow()])}
                >
                  <Plus className="h-3 w-3" />
                  Agregar fila
                </Button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 px-1">
                <span className="text-xs font-medium text-muted-foreground">Producto</span>
                <span className="text-xs font-medium text-muted-foreground">Sección</span>
                <span className="text-xs font-medium text-muted-foreground">Cantidad</span>
                <span />
              </div>

              <ScrollArea className="max-h-60 pr-1">
                <div className="space-y-2">
                  {editRows.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center"
                    >
                      <ProductSelectCell
                        products={products}
                        value={row.productId}
                        onChange={(id, name, code) =>
                          updateRow(row.key, { productId: id, productName: name, productCode: code })
                        }
                      />
                      <Input
                        className="h-8 text-sm"
                        placeholder="Sección"
                        value={row.section}
                        onChange={(e) => updateRow(row.key, { section: e.target.value })}
                      />
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Cant."
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => removeRow(row.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                Solo se guardan filas con producto y cantidad mayor a 0.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="h-5 w-5" />
              Eliminar plantilla
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar la plantilla <strong>{deleteTarget?.name}</strong>? Esta acción no se puede
              deshacer y no afecta los proyectos que ya la usaron.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
