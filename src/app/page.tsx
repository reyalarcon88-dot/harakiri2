'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { SidebarProvider, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { PageHeader } from '@/components/layout/PageHeader'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { useNavigationStore } from '@/stores/navigation'
import { DashboardModule } from '@/components/modules/dashboard/DashboardModule'
import { WarehousesModule } from '@/components/modules/warehouses/WarehousesModule'
import { ProductsModule } from '@/components/modules/products/ProductsModule'
import { PurchasesModule } from '@/components/modules/purchases/PurchasesModule'
import { ProjectsModule } from '@/components/modules/projects/ProjectsModule'
import { RecepcionModule } from '@/components/modules/recepcion/RecepcionModule'
import { ReturnsModule } from '@/components/modules/returns/ReturnsModule'
import { TransfersModule } from '@/components/modules/transfers/TransfersModule'
import { SuppliersModule } from '@/components/modules/people/SuppliersModule'
import { ClientsModule } from '@/components/modules/people/ClientsModule'
import { ContractorsModule } from '@/components/modules/people/ContractorsModule'
import { TasksModule } from '@/components/modules/tasks/TasksModule'
import { CalendarModule } from '@/components/modules/calendar/CalendarModule'
import { ReportsModule } from '@/components/modules/reports/ReportsModule'
import { SettingsModule } from '@/components/modules/settings/SettingsModule'
import { InventoryTimelineModule } from '@/components/modules/inventory-timeline/InventoryTimelineModule'
import { TaskAlarmBell } from '@/components/shared/TaskAlarmBell'

const DocumentViewer = dynamic(
  () => import('@/components/documents/DocumentViewer').then((module) => module.DocumentViewer),
  { ssr: false }
)

function AppContent() {
  const currentPage = useNavigationStore((s) => s.currentPage)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <PageHeader className="min-w-0 flex-1" />
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <TaskAlarmBell />
            <LanguageToggle />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <div className={`min-w-0 flex-1 ${currentPage === 'projects' ? 'p-3 md:p-4' : 'p-4 md:p-6'}`}>
          {currentPage === 'dashboard' && <DashboardModule />}
          {currentPage === 'warehouses' && <WarehousesModule />}
          {currentPage === 'products' && <ProductsModule />}
          {currentPage === 'purchases' && <PurchasesModule />}
          {currentPage === 'recepcion' && <RecepcionModule />}
          {currentPage === 'returns' && <ReturnsModule />}
          {currentPage === 'projects' && <ProjectsModule />}
          {currentPage === 'transfers' && <TransfersModule />}
          {currentPage === 'suppliers' && <SuppliersModule />}
          {currentPage === 'clients' && <ClientsModule />}
          {currentPage === 'contractors' && <ContractorsModule />}
          {currentPage === 'tasks' && <TasksModule />}
          {currentPage === 'calendar' && <CalendarModule />}
          {currentPage === 'reports' && <ReportsModule />}
          {currentPage === 'settings' && <SettingsModule />}
          {currentPage === 'inventory-timeline' && <InventoryTimelineModule />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Home() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <DocumentViewer />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
