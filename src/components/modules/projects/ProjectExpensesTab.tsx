'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { useI18n } from '@/components/layout/I18nProvider'
import { formatLocaleCurrency, formatLocaleDate } from '@/lib/i18n/format'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: string
  name: string
  color: string
}

interface ProjectExpense {
  id: string
  projectId: string
  categoryId: string | null
  description: string
  amount: number
  expenseDate: string
  notes: string
  category: ExpenseCategory | null
}

interface CategoryTotal {
  categoryId: string | null
  name: string
  color: string
  total: number
}

interface ExpensesData {
  expenses: ProjectExpense[]
  totals: CategoryTotal[]
  grandTotal: number
}

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
}

function colorClass(color: string) {
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.slate
}

function CategoryBadge({ category }: { category: ExpenseCategory | null }) {
  const { t } = useI18n()
  if (!category) {
    return (
      <span className="text-xs text-muted-foreground">{t('expenses.noCategory')}</span>
    )
  }
  const { bg, text, border } = colorClass(category.color)
  return (
    <Badge variant="outline" className={`${bg} ${text} ${border} text-xs`}>
      {category.name}
    </Badge>
  )
}

// ── Empty form ─────────────────────────────────────────────────────────────────

interface ExpenseForm {
  description: string
  amount: string
  expenseDate: string
  categoryId: string
  notes: string
}

function todayKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const emptyForm = (): ExpenseForm => ({
  description: '',
  amount: '',
  expenseDate: todayKey(),
  categoryId: '',
  notes: '',
})

// ── Main component ─────────────────────────────────────────────────────────────

export function ProjectExpensesTab({ projectId }: { projectId: string }) {
  const { locale, t } = useI18n()
  const qc = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ExpensesData>({
    queryKey: ['project-expenses', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/expenses`).then((r) => r.json()),
  })

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: () => fetch('/api/expense-categories').then((r) => r.json()),
    staleTime: 60_000,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['project-expenses', projectId] })
  }

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`/api/projects/${projectId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => { invalidate(); toast.success(t('expenses.toast.created')); closeDialog() },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('expenses.toast.error')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      fetch(`/api/projects/${projectId}/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => { invalidate(); toast.success(t('expenses.toast.updated')); closeDialog() },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('expenses.toast.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${projectId}/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success(t('expenses.toast.deleted')); setDeleteId(null) },
    onError: () => toast.error(t('expenses.toast.error')),
  })

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(expense: ProjectExpense) {
    setEditingId(expense.id)
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate,
      categoryId: expense.categoryId ?? '',
      notes: expense.notes,
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) {
      toast.error(t('expenses.dialog.amountRequired'))
      return
    }
    const body = {
      description: form.description,
      amount,
      expenseDate: form.expenseDate,
      categoryId: form.categoryId || null,
      notes: form.notes,
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  const expenses = data?.expenses ?? []
  const totals = data?.totals ?? []
  const grandTotal = data?.grandTotal ?? 0

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {(grandTotal > 0 || totals.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {/* Grand total card */}
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4 min-w-[160px]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50">
              <DollarSign className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('expenses.grandTotal')}</p>
              <p className="text-lg font-bold tabular-nums">{formatLocaleCurrency(locale, grandTotal)}</p>
            </div>
          </div>

          {/* Per-category chips */}
          {totals.map((cat) => {
            const { bg, text, border } = colorClass(cat.color)
            return (
              <div
                key={cat.categoryId ?? '__none__'}
                className={`flex items-center gap-2 rounded-lg border ${border} ${bg} px-3 py-2`}
              >
                <span className={`text-xs font-medium ${text}`}>{cat.name}</span>
                <span className={`text-sm font-bold tabular-nums ${text}`}>
                  {formatLocaleCurrency(locale, cat.total)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          {t('expenses.title')} ({expenses.length})
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('expenses.add')}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('expenses.empty')}
          description={t('expenses.emptyDesc')}
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('expenses.add')}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">{t('expenses.table.date')}</TableHead>
                <TableHead>{t('expenses.table.description')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('expenses.table.category')}</TableHead>
                <TableHead className="text-right">{t('expenses.table.amount')}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatLocaleDate(locale, expense.expenseDate, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }) || expense.expenseDate}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{expense.description || '—'}</p>
                    {expense.notes && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{expense.notes}</p>
                    )}
                    <div className="mt-0.5 sm:hidden">
                      <CategoryBadge category={expense.category} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <CategoryBadge category={expense.category} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatLocaleCurrency(locale, expense.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(expense)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(expense.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('expenses.edit') : t('expenses.add')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exp-description">{t('expenses.dialog.description')}</Label>
              <Input
                id="exp-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Flete materiales"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-amount">{t('expenses.dialog.amount')} *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">{t('expenses.dialog.date')}</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-category">{t('expenses.dialog.category')}</Label>
              <Select
                value={form.categoryId || '__none__'}
                onValueChange={(v) => setForm({ ...form, categoryId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger id="exp-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('expenses.dialog.noCategory')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-notes">{t('expenses.dialog.notes')}</Label>
              <Textarea
                id="exp-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? t('common.saveChanges') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('expenses.delete.title')}
        description={t('expenses.delete.description')}
      />
    </div>
  )
}
