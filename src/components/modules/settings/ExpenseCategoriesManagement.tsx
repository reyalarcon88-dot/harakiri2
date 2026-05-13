'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { useI18n } from '@/components/layout/I18nProvider'

interface ExpenseCategory {
  id: string
  name: string
  color: string
  _count: { expenses: number }
}

const COLORS = [
  'slate', 'blue', 'teal', 'amber', 'rose', 'violet', 'emerald', 'orange',
] as const
type Color = typeof COLORS[number]

const COLOR_CLASSES: Record<Color, { bg: string; text: string; border: string; dot: string }> = {
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-300',   dot: 'bg-slate-500' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-300',    dot: 'bg-teal-500' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-300',  dot: 'bg-violet-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-300',  dot: 'bg-orange-500' },
}

function colorCls(color: string) {
  return COLOR_CLASSES[color as Color] ?? COLOR_CLASSES.slate
}

export function ExpenseCategoriesManagement() {
  const { t } = useI18n()
  const qc = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<Color>('slate')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: categories = [], isLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: () => fetch('/api/expense-categories').then((r) => r.json()),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['expense-categories'] })
  }

  const createMutation = useMutation({
    mutationFn: (body: { name: string; color: string }) =>
      fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(); return r.json() }),
    onSuccess: () => { invalidate(); toast.success(t('expenseCategories.toast.created')); closeDialog() },
    onError: () => toast.error(t('expenseCategories.toast.error')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; color: string } }) =>
      fetch(`/api/expense-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(); return r.json() }),
    onSuccess: () => { invalidate(); toast.success(t('expenseCategories.toast.updated')); closeDialog() },
    onError: () => toast.error(t('expenseCategories.toast.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/expense-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success(t('expenseCategories.toast.deleted')); setDeleteId(null) },
    onError: () => toast.error(t('expenseCategories.toast.error')),
  })

  function openCreate() {
    setEditingId(null)
    setName('')
    setColor('slate')
    setDialogOpen(true)
  }

  function openEdit(cat: ExpenseCategory) {
    setEditingId(cat.id)
    setName(cat.name)
    setColor((cat.color as Color) || 'slate')
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setName('')
    setColor('slate')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const body = { name: name.trim(), color }
    if (editingId) updateMutation.mutate({ id: editingId, body })
    else createMutation.mutate(body)
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{t('expenseCategories.title')}</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('expenseCategories.add')}
          </Button>
        </div>
        <CardDescription>{t('expenseCategories.description')}</CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">…</div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('expenseCategories.empty')}
            description={t('expenseCategories.emptyDesc')}
            action={
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t('expenseCategories.add')}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const { bg, text, border, dot } = colorCls(cat.color)
              return (
                <div
                  key={cat.id}
                  className={`group flex items-center gap-2 rounded-md border ${border} ${bg} px-3 py-2`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${dot} shrink-0`} />
                  <span className={`text-sm font-medium ${text}`}>{cat.name}</span>
                  {cat._count.expenses > 0 && (
                    <Badge variant="outline" className={`text-[10px] font-normal ${border} ${bg} ${text}`}>
                      {t('expenseCategories.inUse', { count: String(cat._count.expenses) })}
                    </Badge>
                  )}
                  <div className="ml-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${text}`}
                      onClick={() => openEdit(cat)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(cat.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('expenseCategories.edit') : t('expenseCategories.add')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">{t('expenseCategories.name')} *</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Transporte"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t('expenseCategories.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => {
                  const { dot, border } = colorCls(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-all ${
                        color === c
                          ? `${border} ring-2 ring-offset-1 ring-offset-background ring-current`
                          : 'border-border bg-background'
                      }`}
                      style={{ color: color === c ? undefined : undefined }}
                    >
                      <span className={`h-3 w-3 rounded-full ${dot}`} />
                      {t(`expenseCategories.color.${c}` as Parameters<typeof t>[0])}
                    </button>
                  )
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {editingId ? t('common.saveChanges') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('expenseCategories.delete.title')}
        description={t('expenseCategories.delete.description')}
      />
    </Card>
  )
}
