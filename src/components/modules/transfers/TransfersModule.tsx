'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowRightLeft, Check, ChevronsUpDown, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/components/layout/I18nProvider'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

interface Product {
  id: string
  name: string
  code: string
  _totalShelfStock: number
}

interface ShelfWithStock {
  id: string
  name: string
  rackId: string
  rack: { id: string; name: string; warehouseId: string; warehouse: { id: string; name: string } }
  _stock?: number
}

interface Warehouse {
  id: string
  name: string
  racks: { id: string; name: string; shelves: { id: string; name: string }[] }[]
}

interface TransferRecord {
  id: string
  quantity: number
  transferDate: string
  notes: string
  createdAt: string
  product: { id: string; name: string; code: string }
  fromShelf: {
    id: string
    name: string
    rack: { id: string; name: string; warehouse: { id: string; name: string } }
  }
  toShelf: {
    id: string
    name: string
    rack: { id: string; name: string; warehouse: { id: string; name: string } }
  }
}

interface TransferFormData {
  productId: string
  fromShelfId: string
  toShelfId: string
  quantity: number | ''
  notes: string
}

const emptyForm: TransferFormData = {
  productId: '',
  fromShelfId: '',
  toShelfId: '',
  quantity: '',
  notes: '',
}

export function TransfersModule() {
  const { locale, t } = useI18n()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<TransferFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [productPopoverOpen, setProductPopoverOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data: transfers = [], isLoading: loadingTransfers } = useQuery<TransferRecord[]>({
    queryKey: ['transfers'],
    queryFn: () => fetch('/api/transfers').then((response) => response.json()),
  })

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['transfer-products'],
    queryFn: () => fetch('/api/products').then((response) => response.json()),
  })

  const { data: sourceShelves = [] } = useQuery<ShelfWithStock[]>({
    queryKey: ['source-shelves', form.productId],
    queryFn: () => fetch(`/api/shelves?productId=${form.productId}`).then((response) => response.json()),
    enabled: !!form.productId,
  })

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: () => fetch('/api/warehouses').then((response) => response.json()),
  })

  const shelvesWithStock = useMemo(
    () => sourceShelves.filter((shelf) => (shelf._stock ?? 0) > 0),
    [sourceShelves]
  )

  const sourceShelfStock = useMemo(() => {
    if (!form.fromShelfId) return 0
    const shelf = sourceShelves.find((item) => item.id === form.fromShelfId)
    return shelf?._stock ?? 0
  }, [form.fromShelfId, sourceShelves])

  const createMutation = useMutation({
    mutationFn: (data: { productId: string; fromShelfId: string; toShelfId: string; quantity: number; notes: string }) =>
      fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || t('transfers.toast.createError'))
        }

        return response.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['transfer-products'] })
      queryClient.invalidateQueries({ queryKey: ['source-shelves'] })
      toast.success(t('transfers.toast.created'))
      closeDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('transfers.toast.createError'))
    },
  })

  const destGroups = useMemo(() => {
    const groups: {
      warehouseId: string
      warehouseName: string
      rackId: string
      rackName: string
      shelves: { id: string; name: string }[]
    }[] = []

    for (const warehouse of warehouses) {
      for (const rack of warehouse.racks) {
        groups.push({
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          rackId: rack.id,
          rackName: rack.name,
          shelves: rack.shelves,
        })
      }
    }

    return groups
  }, [warehouses])

  function openCreate() {
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setForm(emptyForm)
    setFormError('')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')

    if (!form.productId || !form.fromShelfId || !form.toShelfId || !form.quantity) {
      setFormError(t('transfers.validation.required'))
      return
    }

    if (form.fromShelfId === form.toShelfId) {
      setFormError(t('transfers.validation.sameShelf'))
      return
    }

    if (Number(form.quantity) > sourceShelfStock) {
      setFormError(
        t('transfers.validation.exceedsStock', {
          count: formatLocaleInteger(locale, sourceShelfStock),
        })
      )
      return
    }

    createMutation.mutate({
      productId: form.productId,
      fromShelfId: form.fromShelfId,
      toShelfId: form.toShelfId,
      quantity: Number(form.quantity),
      notes: form.notes,
    })
  }

  function shelfLocation(shelf: { name: string; rack: { name: string; warehouse: { name: string } } }) {
    return `${shelf.name} / ${shelf.rack.name} / ${shelf.rack.warehouse.name}`
  }

  const transferCount = formatLocaleInteger(locale, transfers.length)
  const selectedProduct = products.find((product) => product.id === form.productId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm text-muted-foreground">
          {transfers.length === 1
            ? t('transfers.summary.one', { count: transferCount })
            : t('transfers.summary.other', { count: transferCount })}
        </h3>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('transfers.actions.new')}
        </Button>
      </div>

      {loadingTransfers ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {t('transfers.loading')}
        </div>
      ) : transfers.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title={t('transfers.emptyTitle')}
          description={t('transfers.emptyDescription')}
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('transfers.actions.register')}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('transfers.table.date')}</TableHead>
                <TableHead>{t('transfers.table.product')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('transfers.table.source')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('transfers.table.destination')}</TableHead>
                <TableHead className="text-center">{t('transfers.table.quantity')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('transfers.table.notes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatLocaleDate(locale, transfer.createdAt, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{transfer.product.name}</div>
                    <div className="text-xs text-muted-foreground">{transfer.product.code}</div>
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {shelfLocation(transfer.fromShelf)}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {shelfLocation(transfer.toShelf)}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatLocaleInteger(locale, transfer.quantity)}
                  </TableCell>
                  <TableCell className="hidden max-w-[150px] truncate text-sm text-muted-foreground md:table-cell">
                    {transfer.notes || t('transfers.table.noNotes')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('transfers.dialog.title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label>{t('transfers.fields.product')}</Label>
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={productPopoverOpen}
                    disabled={loadingProducts}
                    className="w-full justify-between font-normal"
                  >
                    {selectedProduct
                      ? `${selectedProduct.name} (${selectedProduct.code}) · ${t('common.stock')}: ${formatLocaleInteger(locale, selectedProduct._totalShelfStock)}`
                      : loadingProducts
                        ? t('transfers.placeholders.loadingProducts')
                        : t('transfers.placeholders.searchProduct')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      if (!search) return 1
                      return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }}
                  >
                    <CommandInput placeholder={t('transfers.placeholders.commandSearch')} />
                    <CommandList>
                      <CommandEmpty>{t('transfers.command.noMatches')}</CommandEmpty>
                      <CommandGroup>
                        {products.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.name} ${product.code}`}
                            onSelect={() => {
                              setForm({
                                ...form,
                                productId: product.id,
                                fromShelfId: '',
                                toShelfId: '',
                                quantity: '',
                              })
                              setProductPopoverOpen(false)
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${form.productId === product.id ? 'opacity-100' : 'opacity-0'}`}
                            />
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate">{product.name}</span>
                                <span className="text-xs text-muted-foreground">{product.code}</span>
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {t('common.stock')}: {formatLocaleInteger(locale, product._totalShelfStock)}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {form.productId ? (
              <div className="space-y-2">
                <Label>{t('transfers.fields.sourceShelf')}</Label>
                <Select
                  value={form.fromShelfId}
                  onValueChange={(value) => setForm({ ...form, fromShelfId: value, quantity: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('transfers.placeholders.selectSource')} />
                  </SelectTrigger>
                  <SelectContent>
                    {shelvesWithStock.length === 0 ? (
                      <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                        {t('transfers.placeholders.noSourceStock')}
                      </div>
                    ) : (
                      shelvesWithStock.map((shelf) => (
                        <SelectItem key={shelf.id} value={shelf.id}>
                          {`${shelf.name} · ${shelf.rack.warehouse.name} / ${shelf.rack.name} (${t('common.stock')}: ${formatLocaleInteger(locale, shelf._stock ?? 0)})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.fromShelfId ? (
                  <p className="text-xs text-muted-foreground">
                    {t('transfers.stockAvailable')}{' '}
                    <span className="font-medium text-foreground">
                      {formatLocaleInteger(locale, sourceShelfStock)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {form.productId ? (
              <div className="space-y-2">
                <Label>{t('transfers.fields.destination')}</Label>
                <Select
                  value={form.toShelfId}
                  onValueChange={(value) => setForm({ ...form, toShelfId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('transfers.placeholders.selectDestination')} />
                  </SelectTrigger>
                  <SelectContent>
                    {destGroups.map((group) => (
                      <SelectItem key={`group-${group.rackId}`} value={`__group_${group.rackId}`} disabled>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {group.warehouseName} / {group.rackName}
                        </span>
                      </SelectItem>
                    ))}
                    {destGroups.map((group) =>
                      group.shelves.map((shelf) => (
                        <SelectItem key={shelf.id} value={shelf.id}>
                          {shelf.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {form.fromShelfId ? (
              <div className="space-y-2">
                <Label>{t('transfers.fields.quantity')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={sourceShelfStock}
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      quantity: event.target.value === '' ? '' : Number(event.target.value),
                    })
                  }
                  required
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t('transfers.fields.notes')}</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={2}
                placeholder={t('transfers.placeholders.notes')}
              />
            </div>

            {formError ? (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('transfers.actions.submitting') : t('transfers.actions.register')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
