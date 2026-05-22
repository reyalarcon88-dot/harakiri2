'use client'

import { useI18n } from '@/components/layout/I18nProvider'
import { cn } from '@/lib/utils'
import { useNavigationStore, type PageKey } from '@/stores/navigation'
import type { MessageKey } from '@/lib/i18n/messages'

const pageTitleKeys: Record<PageKey, MessageKey> = {
  dashboard: 'navigation.page.dashboard',
  warehouses: 'navigation.page.warehouses',
  products: 'navigation.page.products',
  tools: 'navigation.page.tools',
  purchases: 'navigation.page.purchases',
  recepcion: 'navigation.page.recepcion',
  projects: 'navigation.page.projects',
  transfers: 'navigation.page.transfers',
  returns: 'navigation.page.returns',
  personnel: 'navigation.page.personnel',
  suppliers: 'navigation.page.suppliers',
  clients: 'navigation.page.clients',
  contractors: 'navigation.page.contractors',
  tasks: 'navigation.page.tasks',
  calendar: 'navigation.page.calendar',
  reports: 'navigation.page.reports',
  settings: 'navigation.page.settings',
  'inventory-timeline': 'navigation.page.inventory-timeline',
}

export function PageHeader({ className }: { className?: string }) {
  const { t } = useI18n()
  const currentPage = useNavigationStore((s) => s.currentPage)
  const title = t(pageTitleKeys[currentPage] ?? 'navigation.page.dashboard')

  return (
    <h1 className={cn('min-w-0 truncate text-xl font-semibold tracking-tight md:text-2xl', className)}>
      {title}
    </h1>
  )
}
