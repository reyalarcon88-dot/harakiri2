'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/components/layout/I18nProvider'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatLocaleInteger } from '@/lib/i18n/format'

interface Supplier {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  createdAt: string
  _count: { purchases: number }
}

interface SupplierFormData {
  name: string
  contactName: string
  email: string
  phone: string
  address: string
}

const emptyForm: SupplierFormData = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
}

export function SuppliersModule() {
  const { locale, t } = useI18n()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)

  const queryClient = useQueryClient()

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers', search],
    queryFn: () =>
      fetch(`/api/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((response) =>
        response.json()
      ),
  })

  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) =>
      fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((response) => response.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(t('suppliers.toast.created'))
      closeDialog()
    },
    onError: () => toast.error(t('suppliers.toast.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierFormData }) =>
      fetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((response) => response.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(t('suppliers.toast.updated'))
      closeDialog()
    },
    onError: () => toast.error(t('suppliers.toast.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/suppliers/${id}`, { method: 'DELETE' }).then((response) => response.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(t('suppliers.toast.deleted'))
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: () => toast.error(t('suppliers.toast.deleteError')),
  })

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setEditingId(supplier.id)
    setForm({
      name: supplier.name,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
    })
    setDialogOpen(true)
  }

  function openDelete(id: string) {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('suppliers.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('suppliers.actions.new')}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {t('suppliers.loading')}
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('suppliers.emptyTitle')}
          description={search ? t('suppliers.emptySearch') : t('suppliers.emptyDescription')}
          action={
            !search ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                {t('suppliers.actions.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('suppliers.table.name')}</TableHead>
                <TableHead>{t('suppliers.table.contact')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('suppliers.table.email')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('suppliers.table.phone')}</TableHead>
                <TableHead className="text-center">{t('suppliers.table.purchases')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contactName || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell">{supplier.email || '-'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{supplier.phone || '-'}</TableCell>
                  <TableCell className="text-center">
                    {formatLocaleInteger(locale, supplier._count.purchases)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(supplier)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDelete(supplier.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('suppliers.dialog.editTitle') : t('suppliers.dialog.createTitle')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('suppliers.fields.name')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">{t('suppliers.fields.contact')}</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(event) => setForm({ ...form, contactName: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">{t('suppliers.fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('suppliers.fields.phone')}</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t('suppliers.fields.address')}</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating
                  ? t('suppliers.actions.saving')
                  : editingId
                    ? t('suppliers.actions.update')
                    : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        title={t('suppliers.delete.title')}
        description={t('suppliers.delete.description')}
      />
    </div>
  )
}
