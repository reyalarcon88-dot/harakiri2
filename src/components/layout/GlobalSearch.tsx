'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckSquare,
  FolderKanban,
  Loader2,
  Package,
  Search,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNavigationStore, type PageKey } from '@/stores/navigation'

type SearchItem = {
  id: string
  type: 'project' | 'product' | 'purchase' | 'client' | 'supplier' | 'task'
  title: string
  subtitle: string
  page: PageKey
  code?: string
}

type SearchGroup = {
  label: string
  items: SearchItem[]
}

const iconByType = {
  project: FolderKanban,
  product: Package,
  purchase: ShoppingCart,
  client: Users,
  supplier: Truck,
  task: CheckSquare,
}

function useDebouncedValue(value: string, delay = 220) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeout)
  }, [delay, value])

  return debouncedValue
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debouncedQuery = useDebouncedValue(query)
  const setPage = useNavigationStore((state) => state.setPage)
  const openPurchase = useNavigationStore((state) => state.openPurchase)
  const openProject = useNavigationStore((state) => state.openProject)

  useEffect(() => {
    if (!open) return

    const trimmedQuery = debouncedQuery.trim()
    if (trimmedQuery.length < 2) {
      setGroups([])
      setHasSearched(false)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setHasSearched(true)

    fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Search request failed')
        return response.json()
      })
      .then((data: { groups?: SearchGroup[] }) => {
        setGroups(data.groups || [])
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Global search failed:', error)
          setGroups([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [debouncedQuery, open])

  const resultCount = useMemo(
    () => groups.reduce((total, group) => total + group.items.length, 0),
    [groups]
  )

  const handleSelect = (item: SearchItem) => {
    if (item.type === 'purchase') {
      openPurchase(item.id)
    } else if (item.type === 'project') {
      openProject(item.id)
    } else {
      setPage(item.page)
    }

    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-9 justify-center px-0 md:w-[340px] md:justify-start md:px-3"
        >
          <Search className="size-4 text-muted-foreground" />
          <span className="hidden truncate text-muted-foreground md:inline">
            Search projects, products, PO...
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(620px,calc(100vw-1rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search projects, products, purchases..."
          />
          <CommandList className="max-h-[460px]">
            {query.trim().length < 2 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Type at least 2 letters to search the system.
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching...
              </div>
            ) : hasSearched && resultCount === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => {
                    const Icon = iconByType[item.type]

                    return (
                      <CommandItem
                        key={`${item.type}-${item.id}`}
                        value={`${item.type}-${item.id}-${item.title}-${item.code || ''}`}
                        onSelect={() => handleSelect(item)}
                        className="items-start gap-3 py-2"
                      >
                        <Icon className="mt-0.5 size-4 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{item.title}</span>
                            {item.code ? (
                              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {item.code}
                              </span>
                            ) : null}
                          </div>
                          {item.subtitle ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </div>
                          ) : null}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
