'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  Inbox,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatLocaleDate, formatLocaleInteger } from '@/lib/i18n/format'
import type { MessageKey } from '@/lib/i18n/messages'

interface Project {
  id: string
  name: string
  poNumber?: string
}

interface Product {
  id: string
  code: string
  name: string
  unitOfMeasure: string
}

interface ReturnItem {
  id: string
  returnId: string
  productIdDelivered: string
  productIdReturned: string | null
  quantityDelivered: number
  quantityReturned: number
  specificationDelivered: string
  specificationReturned: string
  changeType: string
  notes: string
  createdAt: string
  productDelivered: Product
  productReturned: Product | null
}

interface Return {
  id: string
  projectId: string
  returnDate: string
  status: string
  notes: string
  createdAt: string
  items: ReturnItem[]
  project: Project
}

const CHANGE_TYPES = [
  { value: 'full_return', label: 'Devolución Completa' },
  { value: 'partial_exchange', label: 'Cambio Parcial' },
  { value: 'damaged_replacement', label: 'Reemplazo por Daño' },
  { value: 'upgrade_downgrade', label: 'Cambio de Especificación' },
]

export function ReturnsModule() {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()

  const [openDialog, setOpenDialog] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedProductDelivered, setSelectedProductDelivered] = useState<string>('')
  const [selectedProductReturned, setSelectedProductReturned] = useState<string>('')
  const [quantityDelivered, setQuantityDelivered] = useState<string>('')
  const [quantityReturned, setQuantityReturned] = useState<string>('')
  const [specificationDelivered, setSpecificationDelivered] = useState<string>('')
  const [specificationReturned, setSpecificationReturned] = useState<string>('')
  const [changeType, setChangeType] = useState<string>('full_return')
  const [notes, setNotes] = useState<string>('')
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0])

  // Data fetching
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects-for-returns'],
    queryFn: () => fetch('/api/projects?status=in_progress,dispatched').then(r => r.json()),
  })

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-for-returns'],
    queryFn: () => fetch('/api/products').then(r => r.json()),
  })

  const { data: returns = [], isLoading } = useQuery<Return[]>({
    queryKey: ['returns'],
    queryFn: () => fetch('/api/returns').then(r => r.json()),
  })

  // Mutations
  const createReturnMutation = useMutation({
    mutationFn: async (data: {
      projectId: string
      returnDate: string
      items: Array<{
        productIdDelivered: string
        productIdReturned?: string | null
        quantityDelivered: number
        quantityReturned: number
        specificationDelivered: string
        specificationReturned: string
        changeType: string
        notes: string
      }>
    }) => {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create return')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      toast.success('Devolución registrada exitosamente')
      resetForm()
      setOpenDialog(false)
    },
    onError: () => toast.error('Error al registrar la devolución'),
  })

  const resetForm = () => {
    setSelectedProject('')
    setSelectedProductDelivered('')
    setSelectedProductReturned('')
    setQuantityDelivered('')
    setQuantityReturned('')
    setSpecificationDelivered('')
    setSpecificationReturned('')
    setChangeType('full_return')
    setNotes('')
    setReturnDate(new Date().toISOString().split('T')[0])
  }

  const handleSubmit = () => {
    if (!selectedProject || !selectedProductDelivered || !quantityDelivered || !quantityReturned) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    const item = {
      productIdDelivered: selectedProductDelivered,
      productIdReturned: changeType === 'full_return' ? selectedProductDelivered : selectedProductReturned,
      quantityDelivered: parseFloat(quantityDelivered),
      quantityReturned: parseFloat(quantityReturned),
      specificationDelivered,
      specificationReturned: specificationReturned || specificationDelivered,
      changeType,
      notes,
    }

    createReturnMutation.mutate({
      projectId: selectedProject,
      returnDate,
      items: [item],
    })
  }

  const getChangeTypeLabel = (type: string) => {
    const found = CHANGE_TYPES.find(ct => ct.value === type)
    return found?.label || type
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Devoluciones</h2>
        </div>
        <Button onClick={() => setOpenDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Devolución
        </Button>
      </div>

      {/* Dialog for creating return */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Nueva Devolución</DialogTitle>
            <DialogDescription>
              Registra devoluciones completas o cambios de productos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Project Selection */}
            <div className="grid gap-2">
              <Label>Proyecto *</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.poNumber ? `PO ${p.poNumber}` : p.name} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Return Date */}
            <div className="grid gap-2">
              <Label>Fecha de Devolución *</Label>
              <Input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
              />
            </div>

            {/* Change Type */}
            <div className="grid gap-2">
              <Label>Tipo de Cambio *</Label>
              <Select value={changeType} onValueChange={setChangeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map(ct => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Producto Entregado vs Devuelto
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Delivered Product */}
                <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900">Entregado</h4>
                  
                  <div className="grid gap-2">
                    <Label className="text-xs">Producto *</Label>
                    <Select value={selectedProductDelivered} onValueChange={setSelectedProductDelivered}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs">Cantidad *</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={quantityDelivered}
                      onChange={e => setQuantityDelivered(e.target.value)}
                      placeholder="5"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs">Especificación</Label>
                    <Input
                      value={specificationDelivered}
                      onChange={e => setSpecificationDelivered(e.target.value)}
                      placeholder="ej: 24 pies"
                    />
                  </div>
                </div>

                {/* Returned Product */}
                <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-orange-900">Devuelto</h4>
                  
                  <div className="grid gap-2">
                    <Label className="text-xs">Producto {changeType !== 'full_return' ? '*' : ''}</Label>
                    <Select 
                      value={selectedProductReturned} 
                      onValueChange={setSelectedProductReturned}
                      disabled={changeType === 'full_return'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={changeType === 'full_return' ? 'Mismo producto' : 'Selecciona producto'} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs">Cantidad *</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={quantityReturned}
                      onChange={e => setQuantityReturned(e.target.value)}
                      placeholder="5"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs">Especificación</Label>
                    <Input
                      value={specificationReturned}
                      onChange={e => setSpecificationReturned(e.target.value)}
                      placeholder="ej: 11 pies"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Detalles sobre la devolución..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createReturnMutation.isPending}>
              {createReturnMutation.isPending ? 'Guardando...' : 'Registrar Devolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Returns List */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Cargando devoluciones...
          </div>
        ) : returns.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay devoluciones registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Producto Entregado</TableHead>
                  <TableHead>Especificación</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Producto Devuelto</TableHead>
                  <TableHead>Cantidad Devuelta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map(ret =>
                  ret.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">
                        {formatLocaleDate(locale, ret.returnDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {ret.project.poNumber ? `PO ${ret.project.poNumber}` : ret.project.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.productDelivered.code} - {item.productDelivered.name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.specificationDelivered}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatLocaleInteger(locale, Number(item.quantityDelivered || 0))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.productReturned
                          ? `${item.productReturned.code} - ${item.productReturned.name}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatLocaleInteger(locale, Number(item.quantityReturned || 0))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getChangeTypeLabel(item.changeType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>
                          {ret.status === 'pending' ? 'Pendiente' : 'Completado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
