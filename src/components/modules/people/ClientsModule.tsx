'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, User } from 'lucide-react'
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

interface Client {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  createdAt: string
  _count: { projects: number }
}

interface ClientFormData {
  name: string
  contactName: string
  email: string
  phone: string
  address: string
}

const emptyForm: ClientFormData = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
}

export function ClientsModule() {
  const { locale, t } = useI18n()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClientFormData>(emptyForm)

  const queryClient = useQueryClient()

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search],
    queryFn: () =>
      fetch(`/api/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((response) =>
        response.json()
      ),
  })

  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) =>
      fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((response) => response.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(t('clients.toast.created'))
      closeDialog()
    },
    onError: () => toast.error(t('clients.toast.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientFormData }) =>
      fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((response) => response.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(t('clients.toast.updated'))
      closeDialog()
    },
    onError: () => toast.error(t('clients.toast.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/clients/${id}`, { method: 'DELETE' }).then((response) => response.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(t('clients.toast.deleted'))
      setDeleteOpen(false)
      setDeletingId(null)
    },
    onError: () => toast.error(t('clients.toast.deleteError')),
  })

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(client: Client) {
    setEditingId(client.id)
    setForm({
      name: client.name,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      address: client.address,
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
            placeholder={t('clients.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('clients.actions.new')}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {t('clients.loading')}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('clients.emptyTitle')}
          description={search ? t('clients.emptySearch') : t('clients.emptyDescription')}
          action={
            !search ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                {t('clients.actions.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%] px-5 py-3">{t('clients.table.name')}</TableHead>
                <TableHead className="px-5 py-3">Contact info</TableHead>
                <TableHead className="w-28 px-5 py-3 text-center">{t('clients.table.projects')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className="align-top">
                  <TableCell className="px-5 py-4">
                    <div className="space-y-1.5">
                      <p className="text-base font-semibold leading-tight">{client.name}</p>
                      {client.contactName ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          {client.contactName}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-4">
                    <div className="space-y-3">
                      <p className={client.address ? 'flex items-start gap-2 text-sm' : 'text-sm text-muted-foreground'}>
                        {client.address ? <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
                        <span className="max-w-[520px] whitespace-normal leading-relaxed">
                          {client.address || 'No address'}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        <span className="flex min-w-[160px] items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {client.phone || 'No phone'}
                        </span>
                        <span className="flex min-w-[220px] items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {client.email || 'No email'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-center align-middle">
                    {formatLocaleInteger(locale, client._count.projects)}
                  </TableCell>
                  <TableCell className="py-4 text-right align-middle">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(client)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDelete(client.id)}
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
            <DialogTitle>{editingId ? t('clients.dialog.editTitle') : t('clients.dialog.createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('clients.fields.name')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">{t('clients.fields.contact')}</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(event) => setForm({ ...form, contactName: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">{t('clients.fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('clients.fields.phone')}</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t('clients.fields.address')}</Label>
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
                {isMutating ? t('clients.actions.saving') : editingId ? t('clients.actions.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        title={t('clients.delete.title')}
        description={t('clients.delete.description')}
      />
    </div>
  )
}
