'use client'

import Image from 'next/image'
import {
  ArrowRightLeft,
  BarChart3,
  Calendar,
  CheckSquare,
  FolderKanban,
  HardHat,
  Inbox,
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  TrendingDown,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { useI18n } from '@/components/layout/I18nProvider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import type { MessageKey } from '@/lib/i18n/messages'
import { useNavigationStore, type PageKey } from '@/stores/navigation'

interface NavItem {
  labelKey: MessageKey
  page: PageKey
  icon: React.ElementType
}

const mainNavItems: NavItem[] = [
  { labelKey: 'navigation.page.dashboard', page: 'dashboard', icon: LayoutDashboard },
  { labelKey: 'navigation.page.warehouses', page: 'warehouses', icon: Warehouse },
  { labelKey: 'navigation.page.products', page: 'products', icon: Package },
  { labelKey: 'navigation.page.tools', page: 'tools', icon: Wrench },
  { labelKey: 'navigation.page.projects', page: 'projects', icon: FolderKanban },
  { labelKey: 'navigation.page.purchases', page: 'purchases', icon: ShoppingCart },
  { labelKey: 'navigation.page.recepcion', page: 'recepcion', icon: Inbox },
  { labelKey: 'navigation.page.returns', page: 'returns', icon: RotateCcw },
  { labelKey: 'navigation.page.transfers', page: 'transfers', icon: ArrowRightLeft },
]

const peopleNavItems: NavItem[] = [
  { labelKey: 'navigation.page.personnel', page: 'personnel', icon: Users },
  { labelKey: 'navigation.page.suppliers', page: 'suppliers', icon: Truck },
  { labelKey: 'navigation.page.clients', page: 'clients', icon: Users },
  { labelKey: 'navigation.page.contractors', page: 'contractors', icon: HardHat },
]

const otherNavItems: NavItem[] = [
  { labelKey: 'navigation.page.tasks', page: 'tasks', icon: CheckSquare },
  { labelKey: 'navigation.page.calendar', page: 'calendar', icon: Calendar },
  { labelKey: 'navigation.page.reports', page: 'reports', icon: BarChart3 },
  { labelKey: 'navigation.page.inventory-timeline', page: 'inventory-timeline', icon: TrendingDown },
  { labelKey: 'navigation.page.settings', page: 'settings', icon: Settings },
]

function NavMenuGroup({ labelKey, items }: { labelKey: MessageKey; items: NavItem[] }) {
  const { t } = useI18n()
  const currentPage = useNavigationStore((s) => s.currentPage)
  const setPage = useNavigationStore((s) => s.setPage)

  return (
    <SidebarGroup className="p-1.5">
      <SidebarGroupLabel className="h-6 px-2 text-[11px]">{t(labelKey)}</SidebarGroupLabel>
      <SidebarMenu className="gap-0.5">
        {items.map((item) => {
          const label = t(item.labelKey)

          return (
            <SidebarMenuItem key={item.page}>
              <SidebarMenuButton
                tooltip={label}
                isActive={currentPage === item.page}
                onClick={() => setPage(item.page)}
                className="h-8 px-2 text-sm"
              >
                <item.icon />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center px-2 py-1">
          <div className="rounded-md bg-white dark:bg-transparent px-2 py-0.5 ring-1 ring-sidebar-border dark:ring-0 group-data-[collapsible=icon]:hidden">
            <Image
              src="/rmc-logo.png"
              alt="RMC"
              width={136}
              height={33}
              priority
              className="h-7 w-auto object-contain dark:[filter:invert(1)_hue-rotate(180deg)_saturate(1.15)_brightness(0.92)]"
            />
          </div>
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-[11px] font-bold tracking-wide text-sidebar-primary-foreground group-data-[collapsible=icon]:flex">
            RMC
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0.5 py-1">
        <NavMenuGroup labelKey="navigation.group.main" items={mainNavItems} />
        <NavMenuGroup labelKey="navigation.group.people" items={peopleNavItems} />
        <NavMenuGroup labelKey="navigation.group.other" items={otherNavItems} />
      </SidebarContent>

      <SidebarFooter className="p-0" />
      <SidebarRail />
    </Sidebar>
  )
}
