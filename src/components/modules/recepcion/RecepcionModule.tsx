'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Inbox,
  Layers,
  MapPin,
  Package,
  RotateCcw,
  Send,
  Truck,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatLocaleDate, formatLocaleInteger } from '@/lib/i18n/format'
import type { MessageKey } from '@/lib/i18n/messages'
import { useNavigationStore } from '@/stores/navigation'

interface RecepcionItem {
  id: string
  productId: string
  quantity: number
  purchaseId: string | null
  returnId: string | null
  notes: string
  createdAt: string
  product: {
    id: string
    name: string
    code: string
    unitOfMeasure: string
    unitQuantity: string
    preferredShelfId: string | null
  }
  purchase: {
    id: string
    purchaseCode: string
    poNumber?: string
    supplier: { id: string; name: string }
    project?: { id: string; name: string; poNumber?: string } | null
  } | null
  return: {
    id: string
    project: { id: string; name: string }
  } | null
}

interface Shelf {
  id: string
  name: string
  rackName: string
  warehouseName: string
}

interface Warehouse {
  id: string
  name: string
  racks: {
    id: string
    name: string
    shelves: { id: string; name: string }[]
  }[]
}

interface Project {
  id: string
  name: string
  poNumber?: string
}

interface Group {
  key: string
  type: 'purchase' | 'return' | 'orphan'
  title: string
  subtitle: string
  projectId?: string
  items: RecepcionItem[]
  totalQuantity: number
}

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string

async function fetchRecepcion(errorMessage: string): Promise<RecepcionItem[]> {
  const response = await fetch('/api/recepcion')
  if (!response.ok) throw new Error(errorMessage)
  return response.json()
}

async function fetchWarehouses(errorMessage: string): Promise<Warehouse[]> {
  const response = await fetch('/api/warehouses')
  if (!response.ok) throw new Error(errorMessage)
  return response.json()
}

async function fetchProjects(errorMessage: string): Promise<Project[]> {
  const response = await fetch('/api/projects')
  if (!response.ok) throw new Error(errorMessage)
  return response.json()
}

async function placeItem(id: string, shelfId: string, quantity: number, fallbackMessage: string) {
  const response = await fetch(`/api/recepcion/${id}/place`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shelfId, quantity }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? fallbackMessage)
  }

  return response.json()
}

async function dispatchFromRecepcion(
  id: string,
  projectId: string,
  quantity: number,
  fallbackMessage: string
) {
  const response = await fetch(`/api/recepcion/${id}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, quantity }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? fallbackMessage)
  }

  return response.json()
}

async function returnFromRecepcion(
  id: string,
  quantity: number,
  reason: string,
  notes: string,
  fallbackMessage: string
) {
  const response = await fetch(`/api/recepcion/${id}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity, reason, notes }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? fallbackMessage)
  }

  return response.json()
}

async function bulkPlace(
  items: { id: string; shelfId: string; quantity: number }[],
  fallbackMessage: string
) {
  const response = await fetch('/api/recepcion/bulk-place', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? fallbackMessage)
  }

  return response.json()
}

async function bulkDispatch(
  projectId: string,
  items: { id: string; quantity: number }[],
  fallbackMessage: string
) {
  const response = await fetch('/api/recepcion/bulk-dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, items }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? fallbackMessage)
  }

  return response.json()
}

function buildGroups(items: RecepcionItem[], t: Translate): Group[] {
  const groups = new Map<string, Group>()

  for (const item of items) {
    let key: string
    let group: Group

    if (item.purchase) {
      key = `p:${item.purchase.id}`
      const po = item.purchase.poNumber || item.purchase.project?.poNumber || ''
      const title = po ? `${po} · ${item.purchase.purchaseCode}` : item.purchase.purchaseCode
      const subtitle = item.purchase.supplier.name

      group = groups.get(key) || {
        key,
        type: 'purchase',
        title,
        subtitle,
        projectId: item.purchase.project?.id,
        items: [],
        totalQuantity: 0,
      }
    } else if (item.return) {
      key = `r:${item.return.id}`
      group = groups.get(key) || {
        key,
        type: 'return',
        title: t('receiving.group.returnTitle'),
        subtitle: item.return.project.name,
        projectId: item.return.project.id,
        items: [],
        totalQuantity: 0,
      }
    } else {
      key = 'orphan'
      group = groups.get(key) || {
        key,
        type: 'orphan',
        title: t('receiving.group.orphanTitle'),
        subtitle: '',
        items: [],
        totalQuantity: 0,
      }
    }

    group.items.push(item)
    group.totalQuantity += item.quantity
    groups.set(key, group)
  }

  return Array.from(groups.values())
}

function AcomodarDialog({
  item,
  shelves,
  onClose,
}: {
  item: RecepcionItem
  shelves: Shelf[]
  onClose: () => void
}) {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const [shelfId, setShelfId] = useState(item.product.preferredShelfId ?? '')
  const [quantity, setQuantity] = useState(String(item.quantity))

  const { mutate, isPending } = useMutation({
    mutationFn: () => placeItem(item.id, shelfId, Number(quantity), t('receiving.toast.placeError')),
    onSuccess: () => {
      toast.success(t('receiving.toast.placed', { product: item.product.name }))
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const qty = Number(quantity)
  const isValid = !!shelfId && qty > 0 && qty <= item.quantity

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          {t('receiving.place.title')}
        </DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-1 pt-1">
            <p className="font-medium text-foreground">{item.product.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('common.code')}: {item.product.code}
            </p>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('receiving.place.availableLabel')} </span>
          <span className="font-semibold">
            {formatLocaleInteger(locale, item.quantity)} {item.product.unitOfMeasure}
          </span>
        </div>

        <div className="space-y-2">
          <Label>{t('receiving.place.destination')}</Label>
          <Select value={shelfId} onValueChange={setShelfId}>
            <SelectTrigger>
              <SelectValue placeholder={t('receiving.place.selectShelf')} />
            </SelectTrigger>
            <SelectContent>
              {shelves.map((shelf) => (
                <SelectItem key={shelf.id} value={shelf.id}>
                  {shelf.name} / {shelf.rackName} / {shelf.warehouseName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {item.product.preferredShelfId && shelfId === item.product.preferredShelfId ? (
            <p className="text-xs text-muted-foreground">{t('receiving.place.preferredShelfHint')}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{t('receiving.place.quantity')}</Label>
          <Input
            type="number"
            min={1}
            max={item.quantity}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {qty > item.quantity ? (
            <p className="text-xs text-destructive">
              {t('receiving.place.maxAvailable', {
                count: formatLocaleInteger(locale, item.quantity),
              })}
            </p>
          ) : null}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!isValid || isPending} onClick={() => mutate()}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {isPending ? t('receiving.place.submitting') : t('receiving.place.button')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function DespacharDialog({
  item,
  projects,
  onClose,
}: {
  item: RecepcionItem
  projects: Project[]
  onClose: () => void
}) {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const preselected = item.purchase?.project?.id || ''
  const [projectId, setProjectId] = useState(preselected)
  const [quantity, setQuantity] = useState(String(item.quantity))

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      dispatchFromRecepcion(item.id, projectId, Number(quantity), t('receiving.toast.dispatchError')),
    onSuccess: () => {
      toast.success(t('receiving.toast.dispatched', { product: item.product.name }))
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const qty = Number(quantity)
  const isValid = !!projectId && qty > 0 && qty <= item.quantity

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-emerald-600" />
          {t('receiving.dispatch.title')}
        </DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-1 pt-1">
            <p className="font-medium text-foreground">{item.product.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('common.code')}: {item.product.code}
            </p>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('receiving.dispatch.availableLabel')} </span>
          <span className="font-semibold">
            {formatLocaleInteger(locale, item.quantity)} {item.product.unitOfMeasure}
          </span>
        </div>

        <div className="space-y-2">
          <Label>{t('receiving.dispatch.project')}</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder={t('receiving.dispatch.selectProject')} />
            </SelectTrigger>
            <SelectContent>
              {projects.length === 0 ? (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  {t('receiving.dispatch.noProjects')}
                </div>
              ) : (
                projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.poNumber ? `${project.poNumber} · ${project.name}` : project.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {preselected ? (
            <p className="text-xs text-muted-foreground">
              {t('receiving.dispatch.preselectedProject')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{t('receiving.dispatch.quantity')}</Label>
          <Input
            type="number"
            min={1}
            max={item.quantity}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {qty > item.quantity ? (
            <p className="text-xs text-destructive">
              {t('receiving.dispatch.maxAvailable', {
                count: formatLocaleInteger(locale, item.quantity),
              })}
            </p>
          ) : null}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          disabled={!isValid || isPending}
          onClick={() => mutate()}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Send className="mr-2 h-4 w-4" />
          {isPending ? t('receiving.dispatch.submitting') : t('receiving.dispatch.button')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function BulkAcomodarDialog({
  group,
  shelves,
  onClose,
}: {
  group: Group
  shelves: Shelf[]
  onClose: () => void
}) {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const [rows, setRows] = useState(
    group.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      productCode: item.product.code,
      unit: item.product.unitOfMeasure,
      max: item.quantity,
      shelfId: item.product.preferredShelfId ?? '',
      quantity: String(item.quantity),
    }))
  )
  const [defaultShelfId, setDefaultShelfId] = useState('')

  function applyDefaultShelf() {
    if (!defaultShelfId) return
    setRows((current) => current.map((row) => ({ ...row, shelfId: defaultShelfId })))
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      bulkPlace(
        rows
          .filter((row) => row.shelfId && Number(row.quantity) > 0)
          .map((row) => ({ id: row.id, shelfId: row.shelfId, quantity: Number(row.quantity) })),
        t('receiving.toast.bulkPlaceError')
      ),
    onSuccess: (data: { count: number }) => {
      toast.success(
        data.count === 1
          ? t('receiving.toast.bulkPlacedOne', {
              count: formatLocaleInteger(locale, data.count),
            })
          : t('receiving.toast.bulkPlacedOther', {
              count: formatLocaleInteger(locale, data.count),
            })
      )
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const readyRows = rows.filter(
    (row) => row.shelfId && Number(row.quantity) > 0 && Number(row.quantity) <= row.max
  )
  const canSubmit = readyRows.length > 0 && !isPending
  const readyCount = formatLocaleInteger(locale, readyRows.length)
  const totalCount = formatLocaleInteger(locale, rows.length)

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          {t('receiving.bulkPlace.title', { origin: group.title })}
        </DialogTitle>
        <DialogDescription>{group.subtitle}</DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="flex items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">{t('receiving.bulkPlace.defaultShelf')}</Label>
            <Select value={defaultShelfId} onValueChange={setDefaultShelfId}>
              <SelectTrigger>
                <SelectValue placeholder={t('receiving.bulkPlace.selectShelf')} />
              </SelectTrigger>
              <SelectContent>
                {shelves.map((shelf) => (
                  <SelectItem key={shelf.id} value={shelf.id}>
                    {shelf.name} / {shelf.rackName} / {shelf.warehouseName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={applyDefaultShelf} disabled={!defaultShelfId}>
            {t('receiving.bulkPlace.applyAll')}
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t('receiving.table.product')}</TableHead>
                <TableHead className="w-24">{t('receiving.bulk.available')}</TableHead>
                <TableHead className="w-[280px]">{t('receiving.bulkPlace.shelf')}</TableHead>
                <TableHead className="w-28">{t('common.quantity')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{row.productName}</span>
                      <span className="text-xs text-muted-foreground">{row.productCode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatLocaleInteger(locale, row.max)} {row.unit}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.shelfId}
                      onValueChange={(value) =>
                        setRows((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, shelfId: value } : entry
                          )
                        )
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={t('receiving.bulkPlace.selectOne')} />
                      </SelectTrigger>
                      <SelectContent>
                        {shelves.map((shelf) => (
                          <SelectItem key={shelf.id} value={shelf.id}>
                            {shelf.name} / {shelf.rackName} / {shelf.warehouseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={row.max}
                      value={row.quantity}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, quantity: event.target.value } : entry
                          )
                        )
                      }
                      className="h-9 tabular-nums"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('receiving.bulkPlace.readySummary', { ready: readyCount, total: totalCount })}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!canSubmit} onClick={() => mutate()}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {isPending
            ? t('receiving.bulkPlace.submitting')
            : readyRows.length === 1
              ? t('receiving.bulkPlace.buttonOne', { count: readyCount })
              : t('receiving.bulkPlace.buttonOther', { count: readyCount })}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function ReturnDialog({
  item,
  onClose,
}: {
  item: RecepcionItem
  onClose: () => void
}) {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [reason, setReason] = useState('damaged')
  const [notes, setNotes] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      returnFromRecepcion(
        item.id,
        Number(quantity),
        reason,
        notes,
        t('receiving.toast.returnError')
      ),
    onSuccess: () => {
      toast.success(t('receiving.toast.returned', { product: item.product.name }))
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-forecast'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const qty = Number(quantity)
  const isValid = qty > 0 && qty <= item.quantity

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-amber-600" />
          {t('receiving.return.title')}
        </DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-1 pt-1">
            <p className="font-medium text-foreground">{item.product.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('common.code')}: {item.product.code}
            </p>
            {item.purchase ? (
              <p className="text-xs text-muted-foreground">
                {t('receiving.return.supplierLabel')}: {item.purchase.supplier.name}
              </p>
            ) : null}
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('receiving.return.availableLabel')} </span>
          <span className="font-semibold">
            {formatLocaleInteger(locale, item.quantity)} {item.product.unitOfMeasure}
          </span>
        </div>

        <div className="space-y-2">
          <Label>{t('receiving.return.quantity')}</Label>
          <Input
            type="number"
            min={1}
            max={item.quantity}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {qty > item.quantity ? (
            <p className="text-xs text-destructive">
              {t('receiving.return.maxAvailable', {
                count: formatLocaleInteger(locale, item.quantity),
              })}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{t('receiving.return.reason')}</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="damaged">{t('receiving.return.reason.damaged')}</SelectItem>
              <SelectItem value="wrong_item">{t('receiving.return.reason.wrongItem')}</SelectItem>
              <SelectItem value="supplier_issue">{t('receiving.return.reason.supplierIssue')}</SelectItem>
              <SelectItem value="other">{t('receiving.return.reason.other')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('receiving.return.helper')}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('receiving.return.notes')}</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('receiving.return.notesPlaceholder')}
            rows={2}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          disabled={!isValid || isPending}
          onClick={() => mutate()}
          className="bg-amber-600 text-white hover:bg-amber-700"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {isPending ? t('receiving.return.submitting') : t('receiving.return.button')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function BulkDespacharDialog({
  group,
  projects,
  onClose,
}: {
  group: Group
  projects: Project[]
  onClose: () => void
}) {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const [projectId, setProjectId] = useState(group.projectId || '')
  const [rows, setRows] = useState(
    group.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      productCode: item.product.code,
      unit: item.product.unitOfMeasure,
      max: item.quantity,
      quantity: String(item.quantity),
    }))
  )

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      bulkDispatch(
        projectId,
        rows
          .filter((row) => Number(row.quantity) > 0)
          .map((row) => ({ id: row.id, quantity: Number(row.quantity) })),
        t('receiving.toast.bulkDispatchError')
      ),
    onSuccess: (data: { count: number }) => {
      toast.success(
        data.count === 1
          ? t('receiving.toast.bulkDispatchedOne', {
              count: formatLocaleInteger(locale, data.count),
            })
          : t('receiving.toast.bulkDispatchedOther', {
              count: formatLocaleInteger(locale, data.count),
            })
      )
      queryClient.invalidateQueries({ queryKey: ['recepcion'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const readyRows = rows.filter((row) => Number(row.quantity) > 0 && Number(row.quantity) <= row.max)
  const canSubmit = !!projectId && readyRows.length > 0 && !isPending
  const readyCount = formatLocaleInteger(locale, readyRows.length)
  const totalCount = formatLocaleInteger(locale, rows.length)

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-emerald-600" />
          {t('receiving.bulkDispatch.title', { origin: group.title })}
        </DialogTitle>
        <DialogDescription>{group.subtitle}</DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label>{t('receiving.dispatch.project')}</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder={t('receiving.dispatch.selectProject')} />
            </SelectTrigger>
            <SelectContent>
              {projects.length === 0 ? (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  {t('receiving.dispatch.noProjects')}
                </div>
              ) : (
                projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.poNumber ? `${project.poNumber} · ${project.name}` : project.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {group.projectId ? (
            <p className="text-xs text-muted-foreground">
              {t('receiving.dispatch.preselectedProject')}
            </p>
          ) : null}
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t('receiving.table.product')}</TableHead>
                <TableHead className="w-24">{t('receiving.bulk.available')}</TableHead>
                <TableHead className="w-28">{t('common.quantity')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{row.productName}</span>
                      <span className="text-xs text-muted-foreground">{row.productCode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatLocaleInteger(locale, row.max)} {row.unit}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={row.max}
                      value={row.quantity}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, quantity: event.target.value } : entry
                          )
                        )
                      }
                      className="h-9 tabular-nums"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('receiving.bulkDispatch.readySummary', { ready: readyCount, total: totalCount })}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          disabled={!canSubmit}
          onClick={() => mutate()}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Send className="mr-2 h-4 w-4" />
          {isPending
            ? t('receiving.bulkDispatch.submitting')
            : readyRows.length === 1
              ? t('receiving.bulkDispatch.buttonOne', { count: readyCount })
              : t('receiving.bulkDispatch.buttonOther', { count: readyCount })}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function GroupCard({
  group,
  focusProjectId,
  onBulkAcomodar,
  onBulkDespachar,
  onItemAcomodar,
  onItemDespachar,
  onItemReturn,
}: {
  group: Group
  focusProjectId: string | null
  onBulkAcomodar: (group: Group) => void
  onBulkDespachar: (group: Group) => void
  onItemAcomodar: (item: RecepcionItem) => void
  onItemDespachar: (item: RecepcionItem) => void
  onItemReturn: (item: RecepcionItem) => void
}) {
  const { locale, t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const isPurchase = group.type === 'purchase'
  const isReturn = group.type === 'return'
  const itemCount = formatLocaleInteger(locale, group.items.length)
  const totalQuantity = formatLocaleInteger(locale, group.totalQuantity)

  useEffect(() => {
    if (focusProjectId && group.projectId === focusProjectId) {
      setExpanded(true)
    }
  }, [focusProjectId, group.projectId])

  return (
    <div className={`rounded-lg border bg-card ${focusProjectId && group.projectId === focusProjectId ? 'ring-2 ring-teal-400 ring-offset-2' : ''}`}>
      <div
        className={`sticky top-0 z-10 flex items-center justify-between gap-3 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 ${expanded ? 'border-b' : ''}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <Badge
            variant="outline"
            className={`gap-1 font-mono ${
              isPurchase
                ? 'border-blue-200 bg-blue-50 text-blue-600'
                : isReturn
                  ? 'border-amber-200 bg-amber-50 text-amber-600'
                  : ''
            }`}
          >
            {isPurchase ? <Truck className="h-3 w-3" /> : null}
            {isReturn ? <RotateCcw className="h-3 w-3" /> : null}
            {group.title}
          </Badge>
          {group.subtitle ? (
            <span className="min-w-0 truncate text-sm text-muted-foreground">{group.subtitle}</span>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {group.items.length === 1
                ? t('receiving.group.itemOne', { count: itemCount })
                : t('receiving.group.itemOther', { count: itemCount })}
            </Badge>
            <Badge variant="secondary" className="tabular-nums">
              {t('receiving.group.units', { count: totalQuantity })}
            </Badge>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onBulkAcomodar(group)}>
            <MapPin className="h-3.5 w-3.5" />
            {t('receiving.actions.placeAll')}
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => onBulkDespachar(group)}
          >
            <Send className="h-3.5 w-3.5" />
            {t('receiving.actions.dispatchAll')}
          </Button>
        </div>
      </div>

      {expanded ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('receiving.table.product')}</TableHead>
              <TableHead>{t('receiving.table.quantity')}</TableHead>
              <TableHead>{t('receiving.table.receivedDate')}</TableHead>
              <TableHead className="text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{item.product.name}</span>
                    <span className="text-xs text-muted-foreground">{item.product.code}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-semibold">{formatLocaleInteger(locale, item.quantity)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{item.product.unitOfMeasure}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatLocaleDate(locale, item.createdAt, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.purchaseId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        onClick={() => onItemReturn(item)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t('receiving.actions.return')}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => onItemAcomodar(item)}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {t('receiving.actions.place')}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => onItemDespachar(item)}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {t('receiving.actions.dispatch')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}

export function RecepcionModule() {
  const { locale, t } = useI18n()
  const targetRecepcionProjectId = useNavigationStore((state) => state.targetRecepcionProjectId)
  const clearNavigationTargets = useNavigationStore((state) => state.clearTargets)
  const [filter, setFilter] = useState<'all' | 'purchases' | 'returns'>('all')
  const [selectedItem, setSelectedItem] = useState<RecepcionItem | null>(null)
  const [returnItem, setReturnItem] = useState<RecepcionItem | null>(null)
  const [dispatchItem, setDispatchItem] = useState<RecepcionItem | null>(null)
  const [bulkAcomodarGroup, setBulkAcomodarGroup] = useState<Group | null>(null)
  const [bulkDespacharGroup, setBulkDespacharGroup] = useState<Group | null>(null)
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!targetRecepcionProjectId) return
    setFilter('all')
    setFocusedProjectId(targetRecepcionProjectId)
    clearNavigationTargets()
  }, [clearNavigationTargets, targetRecepcionProjectId])

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['recepcion'],
    queryFn: () => fetchRecepcion(t('receiving.error.loadReceiving')),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => fetchWarehouses(t('receiving.error.loadWarehouses')),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(t('receiving.error.loadProjects')),
  })

  const shelves = useMemo<Shelf[]>(
    () =>
      warehouses.flatMap((warehouse) =>
        warehouse.racks.flatMap((rack) =>
          rack.shelves.map((shelf) => ({
            id: shelf.id,
            name: shelf.name,
            rackName: rack.name,
            warehouseName: warehouse.name,
          }))
        )
      ),
    [warehouses]
  )

  const filtered = useMemo(() => {
    if (filter === 'purchases') return items.filter((item) => item.purchaseId)
    if (filter === 'returns') return items.filter((item) => item.returnId)
    return items
  }, [items, filter])

  const groups = useMemo(() => {
    const builtGroups = buildGroups(filtered, t)
    if (!focusedProjectId) return builtGroups

    return [...builtGroups].sort((a, b) => {
      const aMatch = a.projectId === focusedProjectId ? 0 : 1
      const bMatch = b.projectId === focusedProjectId ? 0 : 1
      return aMatch - bMatch
    })
  }, [filtered, focusedProjectId, t])

  const counts = useMemo(
    () => ({
      all: items.length,
      purchases: items.filter((item) => item.purchaseId).length,
      returns: items.filter((item) => item.returnId).length,
    }),
    [items]
  )

  const totalItems = formatLocaleInteger(locale, items.length)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('navigation.page.recepcion')}</h2>
            <p className="text-sm text-muted-foreground">{t('receiving.header.description')}</p>
          </div>
        </div>
        {items.length > 0 ? (
          <Badge variant="secondary" className="px-3 py-1 text-base">
            {items.length === 1
              ? t('receiving.header.countOne', { count: totalItems })
              : t('receiving.header.countOther', { count: totalItems })}
          </Badge>
        ) : null}
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            {t('receiving.filters.all')}
            {counts.all > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {formatLocaleInteger(locale, counts.all)}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2">
            <Truck className="h-3.5 w-3.5" />
            {t('receiving.filters.purchases')}
            {counts.purchases > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {formatLocaleInteger(locale, counts.purchases)}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('receiving.filters.returns')}
            {counts.returns > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {formatLocaleInteger(locale, counts.returns)}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          {t('receiving.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-muted-foreground">{t('receiving.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('receiving.emptyDescription')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              focusProjectId={focusedProjectId}
              onBulkAcomodar={setBulkAcomodarGroup}
              onBulkDespachar={setBulkDespacharGroup}
              onItemAcomodar={setSelectedItem}
              onItemDespachar={setDispatchItem}
              onItemReturn={setReturnItem}
            />
          ))}
        </div>
      )}

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        {selectedItem ? (
          <AcomodarDialog
            item={selectedItem}
            shelves={shelves}
            onClose={() => setSelectedItem(null)}
          />
        ) : null}
      </Dialog>

      <Dialog open={!!dispatchItem} onOpenChange={(open) => !open && setDispatchItem(null)}>
        {dispatchItem ? (
          <DespacharDialog
            item={dispatchItem}
            projects={projects}
            onClose={() => setDispatchItem(null)}
          />
        ) : null}
      </Dialog>

      <Dialog open={!!returnItem} onOpenChange={(open) => !open && setReturnItem(null)}>
        {returnItem ? (
          <ReturnDialog
            item={returnItem}
            onClose={() => setReturnItem(null)}
          />
        ) : null}
      </Dialog>

      <Dialog open={!!bulkAcomodarGroup} onOpenChange={(open) => !open && setBulkAcomodarGroup(null)}>
        {bulkAcomodarGroup ? (
          <BulkAcomodarDialog
            group={bulkAcomodarGroup}
            shelves={shelves}
            onClose={() => setBulkAcomodarGroup(null)}
          />
        ) : null}
      </Dialog>

      <Dialog open={!!bulkDespacharGroup} onOpenChange={(open) => !open && setBulkDespacharGroup(null)}>
        {bulkDespacharGroup ? (
          <BulkDespacharDialog
            group={bulkDespacharGroup}
            projects={projects}
            onClose={() => setBulkDespacharGroup(null)}
          />
        ) : null}
      </Dialog>
    </div>
  )
}
